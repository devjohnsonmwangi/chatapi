// src/middleware/auth.middleware.ts
import "dotenv/config";
import { verify } from "hono/jwt";
import { Context, Next } from "hono";
import { JwtPayload } from "jsonwebtoken";

// --- Type Definition for our JWT Payload ---
// This ensures type safety when we access the decoded token.
export interface UserPayload extends JwtPayload {
    id: number;
    role: string;
    // Add any other fields you include in your token payload
}

// --- Environment Variable Check ---
// It's crucial to ensure the secret is loaded. If not, the server should not start.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in the environment variables. The application cannot start.");
}

/**
 * Middleware Factory: Creates an authentication and authorization middleware.
 * @param requiredRoles - An array of roles that are allowed to access the route. If empty, it only checks for a valid token.
 * @returns A Hono middleware function.
 */
const createAuthMiddleware = (requiredRoles: string[]) => {
    return async (c: Context, next: Next) => {
        const authHeader = c.req.header("Authorization");

        // 1. Check for the Authorization header and the 'Bearer' prefix.
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: "Unauthorized: Missing or malformed token." }, 401);
        }

        const token = authHeader.substring(7); // Removes "Bearer " to get the actual token

        try {
            // 2. Verify the token using the secret.
            const decoded = await verify(token, JWT_SECRET) as UserPayload;

            // 3. (Optional) Check if the user's role is in the list of required roles.
            if (requiredRoles.length > 0 && !requiredRoles.includes(decoded.role)) {
                return c.json({ error: "Forbidden: You do not have the required permissions." }, 403);
            }

            // 4. Attach the decoded user payload to the context for use in controllers.
            c.set('user', decoded);
            
            // 5. Proceed to the next handler.
            await next();
        } catch (error: any) {
            // This will catch errors like "token expired", "invalid signature", etc.
            return c.json({
                error: "Unauthorized: " + error.message,
            }, 401);
        }
    };
};

// --- EXPORTED MIDDLEWARE INSTANCES ---
// We create specific middleware instances using our factory.

// A generic middleware that just verifies the token is valid, without checking roles.
export const authMiddleware = createAuthMiddleware([]);

// Role-specific middleware for granular route protection.
export const adminAuth = createAuthMiddleware(["admin"]);
export const managerAuth = createAuthMiddleware(["manager"]);
export const clerkAuth = createAuthMiddleware(["clerks"]); // Corrected from 'clerk' to match your schema's roleEnum
export const lawyerAuth = createAuthMiddleware(["lawyer"]);
export const clientAuth = createAuthMiddleware(["client"]);
export const supportAuth = createAuthMiddleware(["supports"]); // Corrected from pluralization

// Example for a route accessible by multiple specific roles.
export const adminOrManagerAuth = createAuthMiddleware(["admin", "manager"]);