// src/services/email.service.ts
import "dotenv/config"; // Ensure environment variables are loaded
import nodemailer from 'nodemailer';
import axios from 'axios';

import { TUserSelect } from "../drizzle/schema";
import { ReceiptData } from "../utils/receipt";

// =========================================================================
// === Nodemailer Transporter Configuration ================================
// =========================================================================

const transporter = nodemailer.createTransport({
  // Explicitly specify the transport type as SMTP
  // This ensures the correct typing for SMTP options
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587), // Default to 587 if not set
  secure: Number(process.env.SMTP_PORT || 587) === 465, // true for 465, false for other ports (like 587)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Optional: Add a timeout to prevent indefinite hanging
  // 10 seconds should be sufficient for most SMTP connections
  timeout: 10000, 
} as nodemailer.TransportOptions);

// =========================================================================
// === Generic Email Sending Function (with Enhanced Logging) ==============
// =========================================================================

const sendEmail = async (to: string, subject: string, html: string, attachments?: Array<{ filename: string; content: any; contentType?: string; }>) => {
  try {
    // Log the configuration and mail options (for debugging, remove in production if too verbose)
    console.log('--- Attempting to Send Email ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('From:', `"${process.env.APP_NAME || 'Murigu & Co. Advocates'}" <${process.env.SMTP_USER}>`);
    // console.log('HTML content length:', html.length); // Useful for very large emails
    // console.log('Attachments count:', attachments ? attachments.length : 0);

    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'Murigu & Co. Advocates'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`✅ Email sent successfully to ${to}! Message ID: ${info.messageId}`);
    if (info.response) {
      console.log('SMTP Response:', info.response);
    }
    return info; // Return info object for potential external logging or status checks
  } catch (error: any) {
    console.error('--- ⚠️ Detailed Error Sending Email ---');
    console.error('Target Email:', to);
    console.error('Email Subject:', subject);
    console.error('Error Object:', error); // Log the full error object
    console.error('Error Message:', error.message);
    if (error.code) console.error('Error Code (SMTP or Nodemailer):', error.code);
    if (error.responseCode) console.error('SMTP Response Code:', error.responseCode);
    if (error.response) console.error('SMTP Response:', error.response);
    
    // Re-throw a simplified error for the calling function/API
    throw new Error('Failed to send email due to an internal server error.');
  }
};


// =========================================================================
// === STYLISH EMAIL TEMPLATES =============================================
// =========================================================================

// --- Main Email Template Frame (Refined) ---
const createStyledEmailFrame = (title: string, content: string): string => {
  const companyName = process.env.COMPANY_NAME || 'Murigu & Co. Advocates';
  const companyAddress = process.env.COMPANY_ADDRESS || 'Advocate Plaza, Nairobi, Kenya';
  const companyContact = process.env.COMPANY_CONTACT || 'info@muriguco.com';
  const appUrl = process.env.FRONTEND_URL || '#';

  return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{margin:0;padding:0;background-color:#f4f7f9;font-family:Arial,sans-serif;box-sizing:border-box}.container{max-width:600px;margin:0 auto}.content{background-color:#ffffff;padding:40px;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.08);border:1px solid #e9ecef}.header{text-align:center;padding:20px 0;border-bottom:1px solid #e9ecef}.footer{text-align:center;padding:20px 0;font-size:12px;color:#777}.header h1{color:#2c3e50;margin:0}.content h2{color:#2c3e50;text-align:center}.content p{color:#555;line-height:1.6}.button{background-color:#3498db;color:#ffffff!important;padding:15px 30px;text-decoration:none;border-radius:5px;display:inline-block;font-weight:bold}.event-details{background-color:#f8f9fa;border-left:4px solid #3498db;padding:15px;margin:20px 0;border-radius:4px}</style></head><body><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;"><tr><td style="padding:20px 0;text-align:center;"><div class="container"><div class="header"><a href="${appUrl}" style="text-decoration:none;"><h1 style="color:#2c3e50;margin:0">${companyName}</h1></a></div><div class="content"><h2>${title}</h2>${content}</div><div class="footer"><p style="margin:0;color:#777">${companyName}</p><p style="margin:0;color:#777">${companyAddress}</p><p style="margin:0;color:#777">Contact us at <a href="mailto:${companyContact}" style="color:#3498db">${companyContact}</a></p></div></div></td></tr></table></body></html>
  `;
};

// --- [NEW] User Onboarding / Welcome Email ---
export const sendUserOnboardingEmail = async (user: TUserSelect, temporaryPassword?: string): Promise<void> => {
  const loginLink = `${process.env.FRONTEND_URL}/login`;
  const title = `👋 Welcome to ${process.env.APP_NAME || 'Our Platform'}!`;
  
  let passwordInfo = temporaryPassword 
    ? `<p>Your account has been created. You can log in using your email and the temporary password below:</p>
       <div style="text-align:center; margin: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 5px; font-size: 18px; font-weight: bold; color: #e67e22;">${temporaryPassword}</div>
       <p>We highly recommend changing your password after your first login.</p>`
    : `<p>Your account has been successfully created. You can now log in using the credentials you set up.</p>`;

  const content = `
    <p>Hello ${user.full_name},</p>
    <p>We are thrilled to have you with us. Our platform is designed to streamline communication and case management, making your experience seamless and efficient.</p>
    ${passwordInfo}
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginLink}" class="button" style="background-color: #27ae60; color: #ffffff !important;">Go to Login</a>
    </div>
    <p style="font-size: 14px; text-align: center;">If you have any questions, feel free to contact our support team.</p>
  `;
  const emailBody = createStyledEmailFrame(title, content);
  await sendEmail(user.email, `Welcome Aboard, ${user.full_name}!`, emailBody);
};


// // --- [REPLACED] Event Reminder Email (More Detailed & Fancy) ---
// export const sendEventReminderEmail = async (reminder_id: number): Promise<void> => {
//   try {
//     con
//     if (!reminder || !reminder.event || !reminder.event.user) {
//         console.warn(`⚠️ Skipping reminder ID ${reminder_id}: Incomplete data (reminder, event, or user not found).`);
//         return;
//     }

//     const { event } = reminder;
//     const { user } = event;

//     const eventLink = `${process.env.FRONTEND_URL}/dashboard/events`;
//     const eventType = event.event_type === 'meeting' ? 'meeting' : 'event';
//     const title = `📅 Reminder for Your Upcoming ${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`;
//     const startTime = new Date(event.start_time);

//     const content = `
//       <p>Hello ${user?.full_name ?? 'User'},</p>
//       <p>${reminder.reminder_message}</p>
//       <div class="event-details">
//         <h3 style="margin-top: 0; color: #2c3e50;">${event.event_title}</h3>
//         <p style="margin: 5px 0;"><strong>Date:</strong> ${startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
//         <p style="margin: 5px 0;"><strong>Time:</strong> ${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
//         ${event.event_description ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${event.event_description}</p>` : ''}
//       </div>
//       <div style="text-align: center; margin: 30px 0;">
//           <a href="${eventLink}" class="button" style="background-color: #8e44ad; color: #ffffff !important;">View ${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Details</a>
//       </div>
//       <p>If you have any questions, please don't hesitate to contact us.</p>
//     `;

//     const emailBody = createStyledEmailFrame(title, content);
//     if (user && user.email) {
//       await sendEmail(user.email, `Reminder: ${event.event_title}`, emailBody);
//     } else {
//       console.warn(`⚠️ Cannot send reminder email: user or user.email is undefined for reminder ID ${reminder_id}.`);
//     }
//   } catch (error: any) {
//     console.error(`⚠️ Error sending detailed event reminder for ID ${reminder_id}:`, error?.message);
//     // Note: The sendEmail function already logs detailed errors, so this might be redundant
//     // unless you need to catch and handle specifically here.
//   }
// };


// --- Password Reset Email ---
export const sendPasswordResetEmail = async (user: TUserSelect, token: string): Promise<void> => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const title = "🔑 Password Reset Request";
  const content = `
    <p style="font-family: Arial, sans-serif; color: #555555; line-height: 1.6;">Hello, ${user.full_name},</p>
    <p style="font-family: Arial, sans-serif; color: #555555; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new one. This link is valid for <strong>15 minutes</strong>.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" class="button" style="background-color: #3498db; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Your Password</a>
    </div>
    <p style="font-family: Arial, sans-serif; color: #555555; line-height: 1.6; font-size: 14px; text-align: center;">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
  `;
  const emailBody = createStyledEmailFrame(title, content);
  await sendEmail(user.email, title, emailBody);
};

// --- Password Change Confirmation Email ---
export const sendPasswordChangeRequestEmail = async (user: TUserSelect, token: string): Promise<void> => {
  const changeLink = `${process.env.FRONTEND_URL}/change-password?token=${token}`;
  const title = "🔒 Confirm Your Password Change";
  const content = `
    <p style="font-family: Arial, sans-serif; color: #555555; line-height: 1.6;">Hello, ${user.full_name},</p>
    <p style="font-family: Arial, sans-serif; color: #555555; line-height: 1.6;">To complete your password change, please confirm the request by clicking the button below. This link is valid for <strong>15 minutes</strong>.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${changeLink}" class="button" style="background-color: #e67e22; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Confirm Password Change</a>
    </div>
    <p style="font-family: Arial, sans-serif; color: #555555; line-height: 1.6; font-size: 14px; text-align: center;">If you did not request this change, please ignore this email and secure your account.</p>
  `;
  const emailBody = createStyledEmailFrame(title, content);
  await sendEmail(user.email, title, emailBody);
};


// =========================================================================
// === PAYMENT RECEIPT EMAIL ===============================================
// =========================================================================

const generateReceiptHtmlPage = (receiptData: ReceiptData): string => {
  const companyName = process.env.COMPANY_NAME || 'Murigu and Co-Advocates Ltd';
  const companyAddress = process.env.COMPANY_ADDRESS || '123 Law Street, Advocate Plaza, Nairobi, Kenya';
  const companyContact = process.env.COMPANY_CONTACT || 'info@muriguco.com';
  const formattedAmount = `${receiptData.currency || 'KES'} ${receiptData.payment_amount.toFixed(2)}`;
  const paymentDate = new Date(receiptData.payment_date || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment Receipt - ${receiptData.transaction_id}</title><style>body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f0f2f5; color: #1c1e21; } .receipt-container { max-width: 800px; margin: 40px auto; background-color: #ffffff; border: 1px solid #dddfe2; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 40px; } .receipt-header { text-align: center; border-bottom: 2px solid #e9ecef; padding-bottom: 20px; margin-bottom: 30px; } .receipt-header h1 { color: #0056b3; margin: 0; font-size: 28px; } .receipt-header p { color: #606770; font-size: 16px; } .receipt-details { display: flex; justify-content: space-between; margin-bottom: 30px; } .details-box { width: 48%; } .details-box h3 { border-bottom: 1px solid #e9ecef; padding-bottom: 8px; margin-top: 0; font-size: 16px; color: #4b4f56; } .details-box p { margin: 6px 0; font-size: 14px; } .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; } .items-table th, .items-table td { border: 1px solid #dddfe2; padding: 12px; text-align: left; font-size: 14px; } .items-table th { background-color: #f6f7f8; font-weight: 600; } .items-table .text-right { text-align: right; } .receipt-total { text-align: right; } .receipt-total p { margin: 8px 0; font-size: 16px; font-weight: 600; } .receipt-total .grand-total { font-size: 24px; color: #27ae60; } .receipt-footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef; font-size: 12px; color: #8a8d91; }</style></head><body><div class="receipt-container"><div class="receipt-header"><h1>Payment Receipt</h1><p>Transaction ID: ${receiptData.transaction_id}</p></div><div class="receipt-details"><div class="details-box"><h3>Billed To</h3><p><strong>${receiptData.clientName || 'Valued Client'}</strong></p><p>${receiptData.caseNumber || ''}</p></div><div class="details-box" style="text-align: right;"><h3>Payment Details</h3><p><strong>Payment Date:</strong> ${paymentDate}</p><p><strong>Payment Method:</strong> ${receiptData.payment_gateway || 'Online'}</p></div></div><table class="items-table"><thead><tr><th>Case / Service Description</th><th class="text-right">Amount</th></tr></thead><tbody><tr><td>Payment for legal services related to Case Number: <strong>${receiptData.caseNumber || receiptData.case_id}</strong></td><td class="text-right">${formattedAmount}</td></tr></tbody></table><div class="receipt-total"><p>Subtotal: <span style="float: right;">${formattedAmount}</span></p><p>Tax (0%): <span style="float: right;">KES 0.00</span></p><p class="grand-total">Total Paid: <span style="float: right;">${formattedAmount}</span></p></div><div class="receipt-footer"><p>Thank you for your business!</p><p><strong>${companyName}</strong><br>${companyAddress}<br>${companyContact}</p></div></div></body></html>`;
};

export const sendPaymentReceiptEmail = async (
  toEmail: string,
  receiptUrl: string,
  receiptData: ReceiptData,
  receiptHtmlContent?: string
): Promise<void> => {
  const receiptHtmlPage = generateReceiptHtmlPage(receiptData);
  const base64Html = Buffer.from(receiptHtmlPage).toString('base64');
  const viewableDataUri = `data:text/html;base64,${base64Html}`;
  const formattedAmount = `${receiptData.currency || 'KES'} ${receiptData.payment_amount.toFixed(2)}`;
  const paymentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = "✅ Payment Successful!";

  const content = `
    <p style="font-family: Arial, sans-serif; color: #555555; line-height: 1.6; text-align: center; font-size: 18px;">Thank you for your payment, ${receiptData.clientName || 'Customer'}!</p>
    <div style="text-align: center; margin: 20px 0;">
      <p style="font-size: 16px; color: #7f8c8d; margin: 0; font-family: Arial, sans-serif;">Total Amount Paid</p>
      <p style="font-size: 36px; color: #27ae60; margin: 5px 0; font-weight: bold; font-family: Arial, sans-serif;">${formattedAmount}</p>
    </div>
    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
    <h3 style="font-family: Arial, sans-serif; color: #2c3e50;">Transaction Summary</h3>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-family: Arial, sans-serif; font-size: 14px;">
      <tr><td style="padding: 8px 0; color: #7f8c8d;">Case Number:</td><td style="padding: 8px 0; text-align: right; color: #2c3e50;"><strong>${receiptData.caseNumber || receiptData.case_id}</strong></td></tr>
      <tr><td style="padding: 8px 0; color: #7f8c8d;">Transaction ID:</td><td style="padding: 8px 0; text-align: right; color: #2c3e50;"><strong>${receiptData.transaction_id}</strong></td></tr>
      <tr><td style="padding: 8px 0; color: #7f8c8d;">Payment Date:</td><td style="padding: 8px 0; text-align: right; color: #2c3e50;"><strong>${paymentDate}</strong></td></tr>
    </table>
    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
    <p style="font-family: Arial, sans-serif; color: #555555; line-height: 1.6;">Your official receipt is attached as a PDF. You can also view a readable version in your browser by clicking the button below.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${viewableDataUri}" target="_blank" class="button" style="background-color: #27ae60; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Receipt in Browser</a>
    </div>
  `;

  const emailBody = createStyledEmailFrame(title, content);
  const emailSubject = `Your Receipt for Case ${receiptData.caseNumber || receiptData.case_id}`;
  const attachments: Array<{ filename: string; content: any; contentType: string; }> = [];
  
  try {
    const response = await axios.get(receiptUrl, { responseType: 'arraybuffer' });
    attachments.push({
      filename: `Receipt_${receiptData.transaction_id}.pdf`,
      content: Buffer.from(response.data),
      contentType: 'application/pdf'
    });
  } catch (error: any) {
    console.error(`⚠️ Failed to fetch PDF for attachment. Error: ${error.message}`);
    // If PDF fetch fails, attempt to attach the HTML content if provided
    if (receiptHtmlContent) {
      attachments.push({
        filename: `Receipt_${receiptData.transaction_id}.html`,
        content: receiptHtmlContent,
        contentType: 'text/html'
      });
    }
  }

  await sendEmail(toEmail, emailSubject, emailBody, attachments.length > 0 ? attachments : undefined);
};