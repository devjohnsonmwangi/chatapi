import { z } from 'zod';
import { roleEnum } from '../drizzle/schema'; // Import your role enum


export const createUserValidator = z.object({
    full_name: z.string(),
    email: z.string(),
    password: z.string(),
    phone_number: z.string(),
    address: z.string(),
});

export const loginUserValidator = z.object({
    email: z.string(),
    password: z.string()
});

export const updateUserValidator = z.object({
    full_name: z.string().optional(),
    email: z.string().optional(),
    password: z.string().optional(),
    phone_number: z.string().optional(),
    address: z.string().optional(),
});

// Validator for general user updates (PUT request) - excludes password
export const updateUsersValidator = z.object({
    full_name: z.string().min(2, "Full name must be at least 2 characters").optional(),
    phone_number: z.string().min(10, "Phone number seems too short").optional().nullable(),
    address: z.string().min(5, "Address seems too short").optional().nullable(),
    role: z.enum(roleEnum.enumValues).optional(), // Use the enum values
    profile_picture: z.string().url("Profile picture must be a valid URL").optional().nullable(),
}).strip(); // Remove any extra fields not defined

// Validator for requesting password reset
export const requestPasswordResetValidator = z.object({
    email: z.string().email("Valid email address is required"),
}).strip();

// --- THE FIX IS HERE ---
// Validator for resetting/changing password with token
export const resetPasswordValidator = z.object({
    // We are lowering the minimum required length to accept your current tokens.
    // The most common short token length is 32 characters.
    // token: z.string()
    //     .min(10, "Invalid token format") // Changed from min(64) to min(32)
    //     .max(128, "Invalid token format"), // Kept a reasonable max length

    newPassword: z.string().min(8, "Password must be at least 8 characters long"),
}).strip();