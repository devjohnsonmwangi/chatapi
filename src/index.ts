// src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { prometheus } from '@hono/prometheus';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';
import { logger } from 'hono/logger';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { cors } from 'hono/cors';
import assert from 'assert';
import jwt from 'jsonwebtoken';

import { authMiddleware } from './middleWare/bearAuth';

// Routers
import { authRouter } from './auth/auth.router';
import { userRouter } from './users/user.router';


import { notificationRouter } from './notifications/notifications.router';
import { chatRouter } from './chats/chats.router';


// In-memory secure token blacklist for refresh tokens
const blacklistedRefreshTokens = new Set<string>();

dotenv.config();

// Ensure critical environment variables are set
[
  'PORT', 'DATABASE_URL', 'MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET',
  'MPESA_PASS_KEY', 'MPESA_PAYBILL', 'MPESA_CALLBACK_URL',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'JWT_SECRET', 'JWT_REFRESH_SECRET'
].forEach((key) => assert(process.env[key], `❌ Missing required env var: ${key}`));

// JWT helpers
const generateAccessToken = (userId: string) => jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '15m' });
const generateRefreshToken = (userId: string) => jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
const verifyRefreshToken = (token: string) => jwt.verify(token, process.env.JWT_REFRESH_SECRET!);

// Create the Hono app instance
const app = new Hono();

const { printMetrics, registerMetrics } = prometheus();



// --- Global Middleware Setup ---

// Define allowed origins for CORS
const allowedOrigins = [
    'http://localhost:5173',
    'https://wakilifrontend.vercel.app'
];

// Apply CORS middleware globally
app.use(cors({
    origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

// Apply other common middlewares
app.use('*', logger());
app.use('*', trimTrailingSlash());
app.use('*', registerMetrics);


// ====================================================================
// --- API ROUTING STRATEGY (URL PATHS PRESERVED) ---
// ====================================================================

// --- 1. PUBLIC ROUTES & ENDPOINTS ---
// These routes do NOT have any authentication middleware applied.
// They are registered directly on the main `app` instance.

// Root/health-check and metrics endpoints
app.get('/', async (c) => c.text('Wakili App API is running.'));
app.get('/metrics', printMetrics);

// Authentication routes (e.g., /login, /register) must be public.
app.route('/', authRouter);


// --- 2. AUTHENTICATION-REQUIRED ROUTES ---
// We apply the `authMiddleware` ONLY to the routers that need protection,
// preserving their original root paths.

// Apply auth middleware to all '/users/*' routes
app.use('/users/*');
app.route('/', userRouter);

// Apply auth middleware to all '/cases/*' routes
app.use('/cases/*', authMiddleware);


// Apply auth middleware to all '/appointments/*' routes
app.use('/appointments/*', authMiddleware);


// Apply auth middleware to all other protected resource routers 
app.use('/tickets/*', authMiddleware);


app.use('/feedback/*', authMiddleware);


app.use('/events/*', authMiddleware);


app.use('/event-reminders/*', authMiddleware);


app.use('/documents/*', authMiddleware);


app.use('/payments/*', authMiddleware);


app.use('/notifications/*', authMiddleware);
app.route('/', notificationRouter);

app.use('/chats/*', authMiddleware);
app.route('/', chatRouter);

app.use('/case-progress/*', authMiddleware);


// Administrative or internal routes that should be protected
app.use('/locations/*', authMiddleware);


app.use('/audit-logs/*', authMiddleware);


// Assuming news is for logged-in users only
app.use('/news/*', authMiddleware);



// --- 3. SPECIALIZED PROTECTED ROUTES ---
// These routes already contain their own auth logic. Their paths are preserved.

// Secure refresh token endpoint
app.post('/refresh', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing refresh token.' }, 401);
    }
    const token = authHeader.split(' ')[1];
    if (blacklistedRefreshTokens.has(token)) {
      return c.json({ error: 'Forbidden: Token has been invalidated.' }, 403);
    }
    const payload = verifyRefreshToken(token) as { userId: string };
    const newAccessToken = generateAccessToken(payload.userId);
    const newRefreshToken = generateRefreshToken(payload.userId);
    blacklistedRefreshTokens.add(token); // Invalidate the old refresh token
    return c.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return c.json({ error: 'Forbidden: Invalid refresh token.' }, 403);
  }
});

// Secure logout route,  this  is to  manage user logout by blacklisting the refresh token.
// This route is protected by the auth middleware, but we handle it separately to manage token black
app.post('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      blacklistedRefreshTokens.add(token);
    }
    return c.json({ message: 'Successfully logged out.' });
  } catch (error) {
    return c.json({ message: 'Logout processed.' });
  }
});


// --- 4. 404 CATCH-ALL ---
// This handles any requests that don't match the routes defined above.
app.notFound((c) => {
  return c.json({ error: 'Not Found', message: `The requested route '${c.req.method} ${c.req.path}' does not exist.` }, 404);
});

// --- SERVER STARTUP ---
const port = Number(process.env.PORT || 3000);
console.log(`✅ Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});