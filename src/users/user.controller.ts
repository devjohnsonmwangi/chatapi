import "dotenv/config";
import { Context } from "hono";
import { z } from "zod";
import {
    deleteUserService,
    getUserByIdService,
    getUsersService,
    updateUserService, // This service will now handle profile_picture too
    getUsersByRoleService,
    getUserByEmailService,
    createPasswordTokenService,
    getValidPasswordTokenByTokenService,
    updateUserPasswordService,
    deletePasswordTokenService,
} from "./user.service";
import { TUserSelect } from "../drizzle/schema";
import { sendPasswordResetEmail, sendPasswordChangeRequestEmail } from "../utils/nodemailer";

// --- Zod Schema for User Update Payload (user.controller.ts) ---
const userUpdateSchema = z.object({
    full_name: z.string().min(1, "Full name is required.").optional(),
    // email: z.string().email("Invalid email format.").optional(), // Consider email update implications
    phone_number: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    profile_picture: z.string().url("Profile picture must be a valid URL.").optional().nullable(), // MOVED HERE
    role: z.enum(["admin", "user", "lawyer", "client", "clerks", "manager", "supports"]).optional(),
}).strict(); // Disallow any fields not defined here.

const emailSchema = z.object({
    email: z.string().email("A valid email is required."),
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token is required."),
    newPassword: z.string().min(6, "New password must be at least 6 characters."),
});


// List all users
export const listUsers = async (c: Context) => {
    console.log("\n--- Hono: listUsers controller ---");
    // Authorization check removed
    // const authenticatedUserRole = c.get('userRole') as string | undefined;
    // if (authenticatedUserRole !== 'admin') {
    //     console.log(`Hono controller: listUsers - Unauthorized access attempt by role: ${authenticatedUserRole}`);
    //     return c.json({ error: "Unauthorized to list users." }, 403);
    // }
    // console.log("Hono controller: listUsers - Admin access granted."); // Related log removed

    try {
        const data = await getUsersService();
        if (!data || data.length === 0) {
            console.log("Hono controller: listUsers - No users found.");
            return c.json({ msg: "No Users found" }, 404);
        }
        console.log(`Hono controller: listUsers - Found ${data.length} users.`);
        return c.json(data, 200);
    } catch (error: any) {
        console.error("Hono controller: Error listing users:", error.message, error.stack);
        return c.json({ error: "Failed to retrieve users: " + error?.message }, 500);
    } finally {
        console.log("--- Hono: listUsers controller END ---");
    }
}

// Get user by ID
export const getUserById = async (c: Context) => {
    const targetUserId = parseInt(c.req.param("user_id"));
    console.log(`\n--- Hono: getUserById controller for user_id: ${targetUserId} ---`);

    if (isNaN(targetUserId)) {
        console.log("Hono controller: getUserById - Invalid User ID (NaN).");
        return c.json({ error: "Invalid User ID provided." }, 400);
    }

    // Authorization checks removed
    // const authenticatedUserId = c.get('userId') as number | undefined;
    // const authenticatedUserRole = c.get('userRole') as string | undefined;

    // if (!authenticatedUserId) {
    //     console.log("Hono controller: getUserById - No authenticated user. Access denied.");
    //     return c.json({ error: "Authentication required." }, 401);
    // }

    // if (authenticatedUserRole !== 'admin' && authenticatedUserId !== targetUserId) {
    //     console.log(`Hono controller: getUserById - Auth Forbidden. User ${authenticatedUserId} (${authenticatedUserRole}) trying to access user ${targetUserId}.`);
    //     return c.json({ error: "You are not authorized to view this profile." }, 403);
    // }
    // console.log(`Hono controller: getUserById - User ${authenticatedUserId} (${authenticatedUserRole}) authorized for user ${targetUserId}.`); // Related log removed

    try {
        const user = await getUserByIdService(targetUserId);
        if (!user) {
            console.log(`Hono controller: getUserById - User ${targetUserId} not found.`);
            return c.json({ msg: "User not found" }, 404);
        }
        console.log(`Hono controller: getUserById - User ${targetUserId} found.`);
        return c.json(user, 200);
    } catch (error: any) {
        console.error(`Hono controller: Error getting user ${targetUserId}:`, error.message, error.stack);
        return c.json({ error: "Failed to retrieve user: " + error?.message }, 500);
    } finally {
        console.log(`--- Hono: getUserById controller for user_id: ${targetUserId} END ---`);
    }
}

// Update user (general details, NOW INCLUDING profile_picture)
// Route: PUT /users/:user_id
export const updateUser = async (c: Context) => {
    const targetUserId = parseInt(c.req.param("user_id"));
    console.log(`\n--- Hono: updateUser controller for user_id: ${targetUserId} ---`);

    if (isNaN(targetUserId)) {
        console.log("Hono controller: updateUser - Invalid User ID (NaN).");
        return c.json({ error: "Invalid User ID provided." }, 400);
    }

    // --- 1. Authentication & Authorization REMOVED ---
    // const authenticatedUserId = c.get('userId') as number | undefined;
    // const authenticatedUserRole = c.get('userRole') as string | undefined;

    // if (!authenticatedUserId) {
    //     console.log("Hono controller: updateUser - No authenticated user. Access denied.");
    //     return c.json({ error: "Authentication required." }, 401);
    // }

    // if (authenticatedUserRole !== 'admin' && authenticatedUserId !== targetUserId) {
    //     console.log(`Hono controller: updateUser - Auth Forbidden. User ${authenticatedUserId} (${authenticatedUserRole}) trying to update user ${targetUserId}.`);
    //     return c.json({ error: "You are not authorized to update this user." }, 403);
    // }
    // console.log(`Hono controller: updateUser - User ${authenticatedUserId} (${authenticatedUserRole}) authorized for user ${targetUserId}.`); // Related log removed

    try {
        // --- 2. Get and Validate Payload ---
        let rawPayload;
        try {
            rawPayload = await c.req.json();
            console.log("Hono controller: updateUser - Raw request payload:", rawPayload);
        } catch (jsonError: any) {
            console.error(`Hono controller: updateUser - Error parsing JSON body for user ${targetUserId}:`, jsonError.message);
            return c.json({ error: "Invalid JSON in request body. " + jsonError.message }, 400);
        }

        const validationResult = userUpdateSchema.safeParse(rawPayload); // Uses the updated schema
        if (!validationResult.success) {
            console.log("Hono controller: updateUser - Payload validation FAILED.", validationResult.error.flatten().fieldErrors);
            return c.json({
                error: "Invalid data provided for update.",
                issues: validationResult.error.flatten().fieldErrors
            }, 400);
        }

        let validatedPayload = validationResult.data;
        console.log("Hono controller: updateUser - Validated payload (fields to update):", validatedPayload);

        if (Object.keys(validatedPayload).length === 0) {
            console.log("Hono controller: updateUser - Validated payload is empty (no valid fields to update were provided).");
            return c.json({ msg: "No valid fields provided for update." }, 400);
        }

        // --- 3. Additional Business Logic / Authorization for Specific Fields REMOVED/MODIFIED ---
        const existingUser = await getUserByIdService(targetUserId); // Keep check for user existence
        if (!existingUser) {
            console.log(`Hono controller: updateUser - Target user with ID ${targetUserId} not found.`);
            return c.json({ msg: "User to update not found." }, 404);
        }

        if ('role' in validatedPayload && validatedPayload.role) {
            // Authorization checks for role change removed
            // if (authenticatedUserRole !== 'admin') {
            //     console.log(`Hono controller: updateUser - Forbidden role change attempt by non-admin user ${authenticatedUserId} for user ${targetUserId}.`);
            //     return c.json({ error: "You are not authorized to change user roles." }, 403);
            // }
            // if (authenticatedUserId === targetUserId && existingUser.role === 'admin' && validatedPayload.role !== 'admin') {
            //     console.warn(`Hono controller: updateUser - Admin ${authenticatedUserId} attempting to change their own role from admin.`);
            // }
            console.log(`Hono controller: updateUser - Role is being changed for user ${targetUserId} to ${validatedPayload.role}.`);
        }
        // if (validatedPayload.role === 'admin' && authenticatedUserRole !== 'admin') {
        //     console.log(`Hono controller: updateUser - Forbidden attempt by user ${authenticatedUserId} to set role to admin for user ${targetUserId}.`);
        //     return c.json({ error: "You cannot assign the admin role." }, 403);
        // }

        if ('profile_picture' in validatedPayload) {
            console.log(`Hono controller: updateUser - Profile picture will be updated for user ${targetUserId} to: ${validatedPayload.profile_picture === null ? 'cleared' : validatedPayload.profile_picture}`);
        }


        // --- 4. Call Service to Update User ---
        console.log(`Hono controller: updateUser - Calling updateUserService for user_id ${targetUserId} with sanitized payload:`, validatedPayload);
        const updatedUser = await updateUserService(targetUserId, validatedPayload as Partial<TUserSelect>);
        console.log("Hono controller: updateUser - Response from updateUserService:", updatedUser);

        if (!updatedUser) {
             console.log(`Hono controller: updateUser - updateUserService failed or returned no data for user ${targetUserId}.`);
            return c.json({ error: "Failed to update user details." }, 500);
        }

        // --- 5. Send Response ---
        return c.json(updatedUser, 200);

    } catch (error: any) {
        console.error(`Hono controller: UNHANDLED error in updateUser for user_id ${targetUserId}:`, error.message, error.stack);
        return c.json({ error: "Failed to update user due to an internal error: " + error?.message }, 500);
    } finally {
        console.log(`--- Hono: updateUser controller for user_id: ${targetUserId} END ---`);
    }
};

// Delete user
export const deleteUser = async (c: Context) => {
    const targetUserId = Number(c.req.param("user_id"));
    console.log(`\n--- Hono: deleteUser controller for user_id: ${targetUserId} ---`);

    if (isNaN(targetUserId)) {
        console.log("Hono controller: deleteUser - Invalid User ID (NaN).");
        return c.json({ error: "Invalid User ID." }, 400);
    }

    // Authorization checks removed
    // const authenticatedUserId = c.get('userId') as number | undefined;
    // const authenticatedUserRole = c.get('userRole') as string | undefined;

    // if (!authenticatedUserId) {
    //     console.log("Hono controller: deleteUser - No authenticated user. Access denied.");
    //     return c.json({ error: "Authentication required." }, 401);
    // }

    // if (authenticatedUserRole === 'admin' && authenticatedUserId === targetUserId) {
    //     console.warn(`Hono controller: deleteUser - Admin ${authenticatedUserId} attempting to delete their own account.`);
    // }
    // if (authenticatedUserRole !== 'admin' && authenticatedUserId !== targetUserId) {
    //     console.log(`Hono controller: deleteUser - Auth Forbidden. User ${authenticatedUserId} (${authenticatedUserRole}) trying to delete user ${targetUserId}.`);
    //     return c.json({ error: "You are not authorized to delete this user." }, 403);
    // }
    // console.log(`Hono controller: deleteUser - User ${authenticatedUserId} (${authenticatedUserRole}) authorized for user ${targetUserId}.`); // Related log removed

    try {
        const user = await getUserByIdService(targetUserId); // Keep check for user existence
        if (!user) {
            console.log(`Hono controller: deleteUser - User ${targetUserId} not found.`);
            return c.json({ msg: "User not found" }, 404);
        }

        await deleteUserService(targetUserId);
        console.log(`Hono controller: deleteUser - User ${targetUserId} deleted successfully.`);
        return c.json({ msg: "User deleted successfully!" }, 200);
    } catch (error: any) {
        console.error(`Hono controller: Error deleting user ${targetUserId}:`, error.message, error.stack);
        return c.json({ error: "Failed to delete user: " + error?.message }, 500);
    } finally {
        console.log(`--- Hono: deleteUser controller for user_id: ${targetUserId} END ---`);
    }
}

// Get users by specific roles
export const getUsersByRole = async (c: Context) => {
    console.log("\n--- Hono: getUsersByRole controller ---");
    // Authorization check removed
    // const authenticatedUserRole = c.get('userRole') as string | undefined;
    // if (authenticatedUserRole !== 'admin') {
    //     console.log(`Hono controller: getUsersByRole - Unauthorized access attempt by role: ${authenticatedUserRole}`);
    //     return c.json({ error: "Unauthorized to view users by role." }, 403);
    // }
    // console.log("Hono controller: getUsersByRole - Admin access granted."); // Related log removed

    try {
        const users = await getUsersByRoleService();
        if (!users || users.length === 0) {
            console.log("Hono controller: getUsersByRole - No users found for specified roles.");
            return c.json({ msg: "No users found with the specified roles." }, 404);
        }
        console.log(`Hono controller: getUsersByRole - Found ${users.length} users.`);
        return c.json(users, 200);
    } catch (error: any) {
        console.error("Hono controller: Error fetching users by role:", error.message, error.stack);
        return c.json({ error: `Failed to fetch users by role: ${error?.message}` }, 500);
    } finally {
        console.log("--- Hono: getUsersByRole controller END ---");
    }
};


// --- Password Reset and Change Controllers ---
// requestPasswordReset is inherently public, no auth checks to remove.
export const requestPasswordReset = async (c: Context) => {
    console.log("\n--- Hono: requestPasswordReset controller ---");
    try {
        const rawBody = await c.req.json();
        console.log("Hono controller: requestPasswordReset - Raw payload:", rawBody);
        const validationResult = emailSchema.safeParse(rawBody);

        if (!validationResult.success) {
            console.log("Hono controller: requestPasswordReset - Payload validation FAILED.", validationResult.error.flatten().fieldErrors);
            return c.json({ error: "Invalid email provided.", issues: validationResult.error.flatten().fieldErrors }, 400);
        }
        const { email } = validationResult.data;

        const userForEmail = await getUserByEmailService(email);
        if (userForEmail) {
            const token = await createPasswordTokenService(userForEmail.user_id);
            await sendPasswordResetEmail(userForEmail, token);
            console.log(`Hono controller: requestPasswordReset - Password reset email sent for existing email: ${email}`);
        } else {
            console.log(`Hono controller: requestPasswordReset - Requested for non-existent email: ${email}. Responding as if sent.`);
        }
        return c.json({ msg: "If an account with this email exists, a password reset link has been sent." }, 200);
    } catch (error: any) {
        console.error("Hono controller: Error requesting password reset:", error.message, error.stack);
        return c.json({ error: "Failed to process password reset request." }, 500);
    } finally {
        console.log("--- Hono: requestPasswordReset controller END ---");
    }
};

// resetPassword relies on token validity, no direct user auth checks to remove.
export const resetPassword = async (c: Context) => {
    console.log("\n--- Hono: resetPassword controller ---");
    try {
        const rawBody = await c.req.json();
        console.log("Hono controller: resetPassword - Raw payload:", rawBody);
        const validationResult = resetPasswordSchema.safeParse(rawBody);

        if (!validationResult.success) {
            console.log("Hono controller: resetPassword - Payload validation FAILED.", validationResult.error.flatten().fieldErrors);
            return c.json({ error: "Invalid data provided for password reset.", issues: validationResult.error.flatten().fieldErrors }, 400);
        }
        const { token, newPassword } = validationResult.data;

        const validTokenInfo = await getValidPasswordTokenByTokenService(token);
        if (!validTokenInfo) {
            console.log(`Hono controller: resetPassword - Invalid or expired token: ${token}`);
            return c.json({ error: "Invalid or expired password reset token." }, 400);
        }

        await updateUserPasswordService(validTokenInfo.user_id, newPassword);
        await deletePasswordTokenService(validTokenInfo.id);
        console.log(`Hono controller: resetPassword - Password reset successfully for user ID: ${validTokenInfo.user_id}`);
        return c.json({ msg: "Password has been reset successfully!" }, 200);
    } catch (error: any)        {
        console.error("Hono controller: Error resetting password:", error.message, error.stack);
        return c.json({ error: "Failed to reset password." }, 500);
    } finally {
        console.log("--- Hono: resetPassword controller END ---");
    }
};

export const requestPasswordChange = async (c: Context) => {
    console.log("\n--- Hono: requestPasswordChange controller ---");
    try {
        // These are retrieved but the check that they exist is removed.
        // If not present (e.g. unauthenticated user), they will be undefined.
        const authenticatedUserId = c.get('userId') as number | undefined;
        const authenticatedUserEmail = c.get('userEmail') as string | undefined;
        const authenticatedUserFullName = c.get('userFullName') as string | undefined;

        // Authentication check removed. The operation will proceed even if these details are missing,
        // which might lead to errors in downstream services if they expect valid user details.
        // if (!authenticatedUserId || !authenticatedUserEmail || !authenticatedUserFullName) {
        //     console.log("Hono controller: requestPasswordChange - Authentication details missing.");
        //     return c.json({ error: "Authentication required with full user details." }, 401);
        // }
        
        // Log will show undefined if user details are not available from context
        console.log(`Hono controller: requestPasswordChange - User ${authenticatedUserId} requesting password change.`);
        
        // userForEmail will contain potentially undefined values if auth context was missing
        const userForEmail = { user_id: authenticatedUserId, email: authenticatedUserEmail, full_name: authenticatedUserFullName };

        // createPasswordTokenService might fail if authenticatedUserId is undefined
        const token = await createPasswordTokenService(authenticatedUserId as number); // Added 'as number' assuming service expects number; handle potential undefined
        
        // sendPasswordChangeRequestEmail might behave unexpectedly with undefined user details
        await sendPasswordChangeRequestEmail(userForEmail as any, token); // Cast as any because fields might be undefined

        console.log(`Hono controller: requestPasswordChange - Password change request email sent for user: ${authenticatedUserId}`);
        return c.json({ msg: "A confirmation link to change your password has been sent to your email." }, 200);
    } catch (error: any) {
        console.error("Hono controller: Error requesting password change:", error.message, error.stack);
        // Error might occur here if authenticatedUserId was undefined and createPasswordTokenService couldn't handle it.
        return c.json({ error: "Failed to process password change request." }, 500);
    } finally {
        console.log("--- Hono: requestPasswordChange controller END ---");
    }
};

export const changePassword = async (c: Context) => {
    console.log("\n--- Hono: changePassword controller ---");
    try {
        const rawBody = await c.req.json();
        console.log("Hono controller: changePassword - Raw payload:", rawBody);
        const validationResult = resetPasswordSchema.safeParse(rawBody);

        if (!validationResult.success) {
            console.log("Hono controller: changePassword - Payload validation FAILED.", validationResult.error.flatten().fieldErrors);
            return c.json({ error: "Invalid data provided for password change.", issues: validationResult.error.flatten().fieldErrors }, 400);
        }
        const { token, newPassword } = validationResult.data;

        const validTokenInfo = await getValidPasswordTokenByTokenService(token);
        if (!validTokenInfo) {
            console.log(`Hono controller: changePassword - Invalid or expired token: ${token}`);
            return c.json({ error: "Invalid or expired password change token." }, 400);
        }

        // Authorization check (token user vs authenticated user) removed
        // const authenticatedUserId = c.get('userId') as number | undefined;
        // if (authenticatedUserId && authenticatedUserId !== validTokenInfo.user_id) {
        //     console.log(`Hono controller: changePassword - Token user ID ${validTokenInfo.user_id} does not match authenticated user ID ${authenticatedUserId}.`);
        //     return c.json({ error: "Token mismatch with authenticated user." }, 403);
        // }

        await updateUserPasswordService(validTokenInfo.user_id, newPassword);
        await deletePasswordTokenService(validTokenInfo.id);
        console.log(`Hono controller: changePassword - Password changed successfully for user ID: ${validTokenInfo.user_id}`);
        return c.json({ msg: "Password has been changed successfully!" }, 200);
    } catch (error: any) {
        console.error("Hono controller: Error changing password:", error.message, error.stack);
        return c.json({ error: "Failed to change password." }, 500);
    } finally {
        console.log("--- Hono: changePassword controller END ---");
    }
};