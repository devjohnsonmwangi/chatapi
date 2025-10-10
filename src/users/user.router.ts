// src/users/user.router.ts

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
    updateUserValidator,
    requestPasswordResetValidator,
    resetPasswordValidator // Used for both reset and change password flows
} from '../validators/user.validator'; // Adjust path if needed
import {
    deleteUser,
    getUserById,
    listUsers,
    updateUser,
    getUsersByRole,
    requestPasswordReset,
    resetPassword,
    requestPasswordChange,
    changePassword
} from './user.controller'; // Adjust path if needed
import { Context } from 'hono'; // Import Context for type hints if needed
//import   middleware 
import { authMiddleware, adminAuth, } from '../middleWare/bearAuth';

/*
 * =============================================================================
 * PRODUCTION AUTHENTICATION/AUTHORIZATION PLACEHOLDERS
 * =============================================================================
 *
 * IMPORTANT: You MUST replace the comment blocks below (like '// requireAuth,')
 * with imports and applications of your actual, production-ready middleware.
 * Ensure your auth middleware sets `c.set('userId', ...)` and `c.set('userRole', ...)`
 * as defined in your Hono environment types (e.g., src/types/hono.d.ts).
 *
 * Example Import (adjust path as needed):
 * import { requireAuth, adminAuth, checkUserOrAdmin } from '../middleware/auth';
 *
 * =============================================================================
 */


export const userRouter = new Hono(); // No generic needed here if main app is typed

// --- Standard User CRUD Routes ---

// GET /api/users - List all users
userRouter.get('/users',
    // TODO: Add production authentication and authorization middleware (e.g., require admin access)
    // Example: requireAuth, adminAuth,
    listUsers,adminAuth
);

// GET /api/users/roles - List users by specific roles (e.g., staff)
userRouter.get('/users/roles',
    // TODO: Add production authentication and authorization middleware (e.g., require admin access)
    // Example: requireAuth, adminAuth,
    getUsersByRole,authMiddleware
);

// GET /api/users/:user_id - Get a specific user by ID
userRouter.get('/users/:user_id',
    // TODO: Add production authentication middleware if viewing profiles requires login
    // Example: requireAuth,
    getUserById,authMiddleware
);

// PUT /api/users/:user_id - Update a user
userRouter.put('/users/:user_id',
    // TODO: Add production authentication middleware (user must be logged in)
    // Example: requireAuth,
    // TODO: Add production authorization middleware (e.g., check if user is updating self OR is admin)
    // Example: checkUserOrAdmin,
    zValidator('json', updateUserValidator, (result, c: Context) => { // Added Context type hint for clarity
        if (!result.success) {
            console.error("Validation Error (PUT /users/:user_id):", result.error.issues);
            return c.json({ error: "Invalid update data provided." }, 400);
        }
        // This line should now be type-safe if main Hono app is typed correctly
        c.set('validatedData', result.data);
    }),
    updateUser
);

// DELETE /api/users/:user_id - Delete a user
userRouter.delete('/users/:user_id',
    // TODO: Add production authentication middleware
    // Example: requireAuth,
    // TODO: Add production admin authorization middleware
    // Example: adminAuth,
    deleteUser
);


// --- Password Reset and Change Routes ---

// POST /api/users/request-password-reset - Request a password reset email (Public)
userRouter.post('/users/request-password-reset',
    zValidator('json', requestPasswordResetValidator, (result, c: Context) => {
        if (!result.success) {
            console.error("Validation Error (POST /request-password-reset):", result.error.issues);
            return c.json({ error: "Invalid email format provided." }, 400);
        }
        // This line should now be type-safe
        c.set('validatedData', result.data);
    }),
    requestPasswordReset
);

// POST /api/users/reset-password - Set new password using token from email (Public)
userRouter.post('/users/reset-password',
    zValidator('json', resetPasswordValidator, (result, c: Context) => {
        if (!result.success) {
            console.error("Validation Error (POST /reset-password):", result.error.issues);
            return c.json({ error: "Invalid token or password format provided." }, 400);
        }
        // This line should now be type-safe
        c.set('validatedData', result.data);
    }),
    resetPassword
);

// POST /api/users/request-password-change - Logged-in user requests a password change email
userRouter.post('/users/request-password-change',
    // TODO: Add production authentication middleware. It MUST set `c.set('userId', ...)`
    // Example: requireAuth,
    requestPasswordChange
);

// POST /api/users/change-password - Set new password using token from change request email (Public)
userRouter.post('/users/change-password',
    zValidator('json', resetPasswordValidator, (result, c: Context) => { // Reuse validator
        if (!result.success) {
            console.error("Validation Error (POST /change-password):", result.error.issues);
            return c.json({ error: "Invalid token or password format provided." }, 400);
        }
        // This line should now be type-safe
        c.set('validatedData', result.data);
    }),
    changePassword
);