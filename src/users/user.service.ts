// src/users/user.service.ts
import { eq, notInArray, and, gt, sql } from "drizzle-orm";
import db from "../drizzle/db";
import {
    TUserInsert,
    TUserSelect,
    userTable,
    TPasswordResetTokenInsert,
    TPasswordResetTokenSelect,
    passwordResetTokenTable,
    roleEnum // Assuming roleEnum is exported from schema
} from "../drizzle/schema"; // Use your actual schema import path
import * as crypto from 'crypto';
import bcrypt from "bcryptjs";
import "dotenv/config"; // Ensure env vars are loaded

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
const TOKEN_EXPIRY_MINUTES = 15; // e.g., 15 minutes

// Get all users (excluding password)
export const getUsersService = async (): Promise<Omit<TUserSelect, 'password'>[] | null> => {
    return await db.select({
        user_id: userTable.user_id,
        full_name: userTable.full_name,
        email: userTable.email,
        phone_number: userTable.phone_number,
        address: userTable.address,
        role: userTable.role,
        profile_picture: userTable.profile_picture,
        created_at: userTable.created_at,
        updated_at: userTable.updated_at,
        deleted_at: userTable.deleted_at, // Add this line to include deleted_at
    }).from(userTable);
}

// Get user by ID (excluding password)
export const getUserByIdService = async (user_id: number): Promise<Omit<TUserSelect, 'password'> | undefined> => {
     return await db.query.userTable.findFirst({
        columns: { password: false }, // Exclude password field
        where: eq(userTable.user_id, user_id)
    });
}

// Get user by email (including password for internal use like login or reset check)
export const getUserByEmailService = async (user_email: string): Promise<TUserSelect | undefined> => {
    return await db.query.userTable.findFirst({
        where: eq(userTable.email, user_email)
    });
}

// Get full user by ID (including password - use carefully, e.g., for internal auth checks)
export const getFullUserByIdService = async (user_id: number): Promise<TUserSelect | undefined> => {
    return await db.query.userTable.findFirst({
        where: eq(userTable.user_id, user_id)
    });
}


// Update user details (excluding password)
export const updateUserService = async (user_id: number, userData: Partial<Omit<TUserInsert, 'password' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    // Ensure password is not accidentally passed
    if ('password' in userData) {
        console.warn(`Attempted to update password via updateUserService for user ID ${user_id}. Ignoring password field.`);
        delete (userData as any).password; // Remove if present
    }

    // Prevent updates to user_id, created_at, updated_at through this general service
    // (The controller already does this for 'user_id', 'created_at', 'updated_at' before calling the service,
    // but defense in depth is good.)
    if ('user_id' in userData) delete (userData as any).user_id;
    if ('created_at' in userData) delete (userData as any).created_at;
    if ('updated_at' in userData) delete (userData as any).updated_at;


    if (Object.keys(userData).length === 0) {
        // This log will help confirm if the service itself receives an empty payload from the controller
        console.log(`SERVICE: updateUserService for user_id ${user_id} received empty userData after filtering. Nothing to update.`);
        return "No valid fields provided for update in service."; // Differentiate service error message
    }

    // Log what's being set
    console.log(`SERVICE: Updating user ${user_id} with data:`, userData);

    try {
        const result = await db.update(userTable)
            .set({ ...userData, updated_at: new Date() }) // Update updated_at timestamp
            .where(eq(userTable.user_id, user_id))
            .returning({ updatedUserId: userTable.user_id }); // Get confirmation

        if (result.length > 0 && result[0].updatedUserId === user_id) {
            console.log(`SERVICE: User ${user_id} updated successfully in DB.`);
            return "User updated successfully 🎉"; // This matches what controller expects
        } else {
            console.log(`SERVICE: User ${user_id} not found or update failed in DB. Result:`, result);
            return "User not found or update failed."; // More specific error
        }
    } catch (error: any) {
        console.error(`SERVICE: Error updating user ${user_id} in DB:`, error);
        // Consider throwing the error or returning a more specific error message
        // that the controller can then use.
        // For now, to match your controller's expectation of a string:
        return `Error during database update: ${error.message}`;
    }
};

// Delete a user
export const deleteUserService = async (user_id: number) => {
    // The foreign key constraint with `onDelete: 'cascade'` in the schema
    // should automatically delete related password reset tokens.
    await db.delete(userTable).where(eq(userTable.user_id, user_id));
    return "User deleted successfully 🎉";
}

// Get users by role (excluding "client" and "user") and excluding password
export const getUsersByRoleService = async (): Promise<Omit<TUserSelect, 'password'>[]> => {
    try {
      // Roles to exclude - adjust based on your roleEnum values
      const excludedRoles: (typeof roleEnum.enumValues[number])[] = ['client', 'user'];

        const users = await db.query.userTable.findMany({
            columns: { password: false }, // Exclude password field
            where: notInArray(userTable.role, excludedRoles),
        });
        return users;
    } catch (error) {
        console.error('Error fetching users by role:', error);
        throw new Error('Error fetching users by role');
    }
};

// --- Password Hashing and Token Services ---

/**
 * Hashes a password using bcrypt.
 */
export const hashPassword = async (password: string): Promise<string> => {
    if (!password) {
        throw new Error("Password cannot be empty");
    }
    return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Creates a password reset/change token for a user.
 */
export const createPasswordTokenService = async (userId: number): Promise<string> => {
    // Invalidate previous tokens for the same user (optional, but recommended)
    await db.delete(passwordResetTokenTable)
        .where(eq(passwordResetTokenTable.user_id, userId));

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000); // Set expiry time

    const newToken: TPasswordResetTokenInsert = {
        user_id: userId,
        token: token, // Store the raw token
        expires_at: expiresAt,

        
        // created_at is handled by defaultNow()
    };

    await db.insert(passwordResetTokenTable).values(newToken);
    console.log(`Generated token for user ${userId}, expires at ${expiresAt}`);
    return token; // Return the raw token
};

/**
 * Finds a valid (non-expired) password reset token by the token string.
 */
export const getValidPasswordTokenByTokenService = async (token: string): Promise<(TPasswordResetTokenSelect & { user: Omit<TUserSelect, 'password'> }) | undefined> => {
    const now = new Date();
    // Drizzle currently doesn't directly support joining on findFirst with `with` in this exact way for complex conditions easily.
    // We'll find the token first, then the user if the token is valid.

    const tokenRecord = await db.query.passwordResetTokenTable.findFirst({
         where: and(
            eq(passwordResetTokenTable.token, token), // Match the provided token
            gt(passwordResetTokenTable.expires_at, now) // Ensure token is not expired
        )
    });

    if (!tokenRecord) {
        console.log(`Token not found or expired: ${token}`);
        return undefined;
    }

    // Token found and is valid, now fetch the associated user (excluding password)
    const user = await getUserByIdService(tokenRecord.user_id);

    if (!user) {
         console.log(`User not found for valid token ID: ${tokenRecord.id}, User ID: ${tokenRecord.user_id}`);
         // This case is unlikely if cascade delete is working, but good to handle.
         // Maybe delete the orphaned token here?
         await deletePasswordTokenService(tokenRecord.id);
         return undefined;
    }

    console.log(`Valid token found: ${token} for user ID: ${user.user_id}`);
    return { ...tokenRecord, user }; // Combine token record and user info
};

/**
 * Updates a user's password securely.
 */
export const updateUserPasswordService = async (userId: number, newPassword: string): Promise<string> => {
    if (!newPassword) throw new Error("New password cannot be empty.");
    const hashedPassword = await hashPassword(newPassword);
    await db.update(userTable)
        .set({ password: hashedPassword, updated_at: new Date() })
        .where(eq(userTable.user_id, userId));
    return "Password updated successfully ✅";
};

/**
 * Deletes a password reset token by its ID.
 */
export const deletePasswordTokenService = async (tokenId: number): Promise<string> => {
    await db.delete(passwordResetTokenTable).where(eq(passwordResetTokenTable.id, tokenId));
    console.log(`Deleted token ID: ${tokenId}`);
    return "Token deleted successfully.";
};

/**
 * Deletes all expired tokens (can be run periodically).
 */
export const deleteExpiredTokensService = async (): Promise<string> => {
    const now = new Date();
    // Use sql fragment for comparison with current timestamp
    const result = await db.delete(passwordResetTokenTable)
        .where(sql`${passwordResetTokenTable.expires_at} < ${now}`);

    // Drizzle doesn't directly return rowCount for delete in all drivers, log a generic message
    console.log(`🧹 Attempted cleanup of expired password tokens older than ${now}.`);
    return `Expired token cleanup attempted.`;
};