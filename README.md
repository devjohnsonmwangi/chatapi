# ChatApp API — Server

A compact, production-ready REST + WebSocket API for a real-time chat application. This README is tailored for API developers and maintainers — it documents quickstart, API routes, WebSocket usage, environment variables, security, and deployment notes.

Table of contents

- Overview
- Quickstart
- API endpoints (overview)
- WebSocket (socket) usage example
- Environment variables
- Local development & scripts
- Security and secrets
- Database & schema
- Deployment notes
- Troubleshooting

## Overview

This repository contains the backend services for a chat application:

- HTTP API for users, authentication, chats, notifications, and utilities.
- WebSocket support for real-time message delivery (`src/socket.ts`).
- Utilities for encryption, storage, and third-party integrations (Stripe, MPesa, Supabase, Azure).

Recommended audience: backend developers, devops, and integrators building or maintaining the chat API.

## Quickstart (local)

1. Install dependencies

```powershell
pnpm install
```

2. Create `.env` from example and fill required values

```powershell
copy .env.example .env
# edit .env
```

3. Start dev server

```powershell
pnpm dev
```

Default port is read from `PORT` in `.env` (default `8000`).

## API endpoints (overview)

This is a high-level overview — inspect the router files in `src/` for full details.

- POST /auth/register — register new user
- POST /auth/login — authenticate and receive JWT
- GET /users/:id — fetch user profile
- GET /chats — list chats for authenticated user
- POST /chats — create new chat or conversation
- POST /chats/:chatId/messages — send a message (HTTP fallback)
- GET /notifications — list user notifications

Authentication: Bearer JWT in `Authorization` header. See `src/auth` for middleware and tokens.

## WebSocket usage (basic)

The project exposes WebSocket / socket.io style functionality via `src/socket.ts`. Below is a condensed example of how the client should connect and send/receive messages.

Client-side (pseudo-JS):

```js
const socket = new WebSocket('ws://localhost:8000')

socket.addEventListener('open', () => {
  // Send auth token after opening
  socket.send(JSON.stringify({ type: 'auth', token: 'YOUR_JWT' }))
})

// Send a chat message
socket.send(JSON.stringify({ type: 'message', chatId: 'abc', text: 'hello' }))

socket.addEventListener('message', evt => {
  const msg = JSON.parse(evt.data)
  // handle incoming events: 'message', 'typing', 'presence', etc.
})
```

See `src/socket.ts` for details on event shapes and server-side handling.

## Environment variables (important)

Minimum required for basic local dev

- `PORT` — port to run the server (default 8000)
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — JWT signing secret
- `CHAT_ENCRYPTION_KEY` — 32-byte key (hex or base64) for encryption util

Optional integrations (only configure if used)

- `AZURE_STORAGE_ACCOUNT_NAME` / `AZURE_STORAGE_ACCOUNT_KEY` / `AZURE_STORAGE_CONTAINER_NAME`
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_BUCKET_NAME`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

Never commit `.env` to source control. Use `.env.example` and your host's secret manager.

## Local development & scripts

- pnpm dev — start the development server with TS watch
- npx tsc --noEmit — run TypeScript type checks
- pnpm lint — run linter (if configured)

## Security & secrets

- If a secret was committed, rotate it immediately in the provider console (Stripe, OpenAI, Azure, etc.).
- Use GitHub Actions/Git hooks to run secret scanning and prevent accidental commits.
- Keep `.env` untracked and use `.env.example` for placeholders.

## Database & schema

- Drizzle ORM schema and helper SQL are in `drizzle/`.
- Use your preferred migration tool or apply SQL from `drizzle/sample.sql`.

## Deployment

- Use environment variables in your hosting platform (Render, Vercel, Azure App Service).
- Store secrets in the platform's secret store (do not push them to Git).
- If you rewrite history to remove secrets, collaborators must re-clone or reset (force-push was used).

## Troubleshooting

- If the server won't start: check `DATABASE_URL`, `PORT`, and `JWT_SECRET` in `.env`.
- If WebSocket clients cannot connect: confirm port and firewall settings and check server logs.

## Contributing

- Open issues and PRs. Use feature branches and create PRs to `main`.
- Maintain backward compatibility for API consumers where practical.

---

If you want, I can also:

- add an `app.http` or Postman collection with example requests for auth, creating a chat, and sending messages,
- add a short CI GitHub Actions workflow that runs `npx tsc --noEmit` and secret scanning before pushes.

- `src/utils/encryption.ts` — message encryption helper
- `src/users`, `src/chats`, `src/auth`, `src/notifications` — domain logic and routers

---

If you'd like, I can also:

- add a short Usage section with sample API endpoints,
- add a small Postman/HTTP collection or app.http file for quick local testing,
- or wire a CI workflow that runs type checks and secret scans before pushes.
