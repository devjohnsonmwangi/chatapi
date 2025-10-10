// src/chats/chat.controller.ts
import { Context } from 'hono';
import { z, ZodError } from 'zod';
import { chatService } from './chats.service';

// --- CORRECTED Zod Schemas (using snake_case) ---
const createConvoSchema = z.object({
  creator_id: z.number().positive(),
  participant_user_ids: z.array(z.number().positive()).min(1),
  title: z.string().optional(),
  is_group: z.boolean().optional()
});

const findOneOnOneSchema = z.object({
  user_id_1: z.number().positive(),
  user_id_2: z.number().positive()
});

const getMessagesSchema = z.object({
  requestingUserId: z.coerce.number().positive(), // This is a query param, can stay camelCase for convention
  limit: z.coerce.number().default(30),
  offset: z.coerce.number().default(0)
});

const sendMsgSchema = z.object({
  sender_id: z.number().positive("sender_id is required and must be a positive number."),
  content: z.string().min(1, "Message content cannot be empty."),
  message_type: z.string().optional()
});

const markReadSchema = z.object({
  user_id: z.number().positive()
});

const addUserSchema = z.object({
  added_by_user_id: z.number().positive(),
  user_id_to_add: z.number().positive()
});

const idParamSchema = z.object({
  id: z.coerce.number().positive("Invalid ID parameter.")
});

const userIdQuerySchema = z.object({
  userId: z.coerce.number().positive("Invalid userId in query.") // Query params often use camelCase
});

// --- Generic Error Handler (Unchanged) ---
const handleServiceError = (c: Context, error: any) => {
  if (error instanceof ZodError) {
    // Provide more detailed validation error messages to the client
    return c.json({ error: "Validation failed", details: error.flatten().fieldErrors }, 400);
  }
  console.error("Service Error:", error.message);
  return c.json({ error: error.message || 'An unexpected server error occurred' }, 500);
}

export const chatController = {
  // ⚠️ SECURITY WARNING: All functions here trust a user ID sent from the frontend.
  // This is a major security vulnerability (IDOR). The correct solution is a server-side
  // authentication middleware that provides a trusted, non-spoofable user ID.

  getUserConversations: async (c: Context) => {
    try {
      const { userId } = userIdQuerySchema.parse(c.req.query());
      const conversations = await chatService.getConversationsForUser(userId);
      return c.json(conversations);
    } catch (error) { return handleServiceError(c, error); }
  },

  createConversation: async (c: Context) => {
    try {
      const body = await c.req.json();
      const payload = createConvoSchema.parse(body);
      const conversation = await chatService.createConversation(
        payload.creator_id,
        payload.participant_user_ids,
        payload.title,
        payload.is_group
      );
      return c.json(conversation, 201);
    } catch (error) { return handleServiceError(c, error); }
  },

  findOrCreateOneOnOne: async (c: Context) => {
    try {
        const body = await c.req.json();
        const { user_id_1, user_id_2 } = findOneOnOneSchema.parse(body);
        const conversation = await chatService.findOrCreateOneOnOneConversation(user_id_1, user_id_2);
        return c.json(conversation);
    } catch (error) { return handleServiceError(c, error); }
  },
  
  getMessages: async (c: Context) => {
    try {
      const { id: conversationId } = idParamSchema.parse({ id: c.req.param('conversationId') });
      const { requestingUserId, limit, offset } = getMessagesSchema.parse(c.req.query());
      const messages = await chatService.getMessagesForConversation(conversationId, requestingUserId, limit, offset);
      return c.json(messages);
    } catch (error) { return handleServiceError(c, error); }
  },

  // --- CORRECTED sendMessage function ---
  sendMessage: async (c: Context) => {
    try {
      const { id: conversationId } = idParamSchema.parse({ id: c.req.param('conversationId') });
      const body = await c.req.json();
      // It now parses for snake_case keys from the body
      const { sender_id, content, message_type } = sendMsgSchema.parse(body);
      // It passes the correct snake_case variable to the service
      const message = await chatService.sendMessage(conversationId, sender_id, content, message_type);
      return c.json(message, 201);
    } catch (error) { return handleServiceError(c, error); }
  },

  markAsRead: async (c: Context) => {
    try {
      const { id: conversationId } = idParamSchema.parse({ id: c.req.param('conversationId') });
      const body = await c.req.json();
      const { user_id } = markReadSchema.parse(body);
      await chatService.markConversationAsRead(conversationId, user_id);
      return c.json({ message: "Conversation marked as read." });
    } catch (error) { return handleServiceError(c, error); }
  },

  addUserToGroupChat: async (c: Context) => {
    try {
      const { id: conversationId } = idParamSchema.parse({ id: c.req.param('conversationId') });
      const body = await c.req.json();
      const { added_by_user_id, user_id_to_add } = addUserSchema.parse(body);
      await chatService.addUserToConversation(conversationId, user_id_to_add, added_by_user_id);
      return c.json({ message: "User added successfully." });
    } catch (error) { return handleServiceError(c, error); }
  },

  getParticipants: async (c: Context) => {
    try {
      const { id: conversationId } = idParamSchema.parse({ id: c.req.param('conversationId') });
      const participants = await chatService.getConversationParticipants(conversationId);
      return c.json(participants);
    } catch (error) { return handleServiceError(c, error); }
  },
};