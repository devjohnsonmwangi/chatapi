// src/chats/chat.router.ts
import { Hono } from 'hono';
import { chatController } from './chats.controller';
// import { authenticateMiddleware } from '../auth/middleware'; // TODO

export const chatRouter = new Hono();

// chatRouter.use('*', authenticateMiddleware); // Apply auth to all chat routes

// Base conversation routes
chatRouter.get('/conversations', chatController.getUserConversations);
chatRouter.post('/conversations', chatController.createConversation);
chatRouter.post('/conversations/direct', chatController.findOrCreateOneOnOne); // Specific for 1-on-1

// Routes for a specific conversation
chatRouter.get('/conversations/:conversationId/messages', chatController.getMessages);
chatRouter.post('/conversations/:conversationId/messages', chatController.sendMessage);
chatRouter.post('/conversations/:conversationId/read', chatController.markAsRead);
chatRouter.get('/conversations/:conversationId/participants', chatController.getParticipants);
chatRouter.post('/conversations/:conversationId/participants', chatController.addUserToGroupChat); // Add user to existing group