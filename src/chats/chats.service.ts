// src/chats/chat.service.ts
import db from '../drizzle/db';
import {
  chatConversationTable,
  chatMessageTable,
  chatParticipantTable,
  userTable,
  notificationTable,
  TChatConversationInsert,
  TChatMessageInsert,
  TChatParticipantInsert,
  LastMessagePreview,
} from '../drizzle/schema';
import { and, desc, eq, sql, ne, countDistinct } from 'drizzle-orm';
import { encryptText, decryptText, generatePreview } from '../utils/encryption';
import { createNotification } from '../notifications/notifications.service';

// New helper to format the number timestamp back to an ISO string for the API
const formatTimestampForAPI = (timestamp: number | null | undefined): string => {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString();
};

const getUserDetails = async (userId: number): Promise<{ name: string, id: number, profile_picture?: string | null } | null> => {
    const userResult = await db.query.userTable.findFirst({ where: eq(userTable.user_id, userId) });
    if (!userResult) return null;
    return { name: String(userResult.full_name || "Unknown User"), id: userResult.user_id, profile_picture: userResult.profile_picture };
};

export const chatService = {
  createConversation: async (creatorId: number, participantUserIds: number[], title?: string, isGroupExplicit?: boolean): Promise<any | null> => {
    const allUniqueParticipantIds = Array.from(new Set([creatorId, ...participantUserIds]));
    if (allUniqueParticipantIds.length < 2) throw new Error("A conversation needs at least two unique participants.");
    const actualIsGroup = isGroupExplicit !== undefined ? isGroupExplicit : allUniqueParticipantIds.length > 2;
    let conversationTitle: string | null = title ? String(title) : null;
    if (!actualIsGroup && !conversationTitle && allUniqueParticipantIds.length === 2) {
      const otherParticipantId = allUniqueParticipantIds.find(id => id !== creatorId)!;
      const otherUser = await getUserDetails(otherParticipantId);
      conversationTitle = otherUser ? `Chat with ${otherUser.name}` : "Direct Chat";
    } else if (actualIsGroup && !conversationTitle) { conversationTitle = "Group Chat"; }
    
    // Using Date.now() to get a number
    const now = Date.now();
    const newConversationData = { creator_id: creatorId, title: conversationTitle, is_group_chat: actualIsGroup, created_at: now, updated_at: now };
    const [newConversation] = await db.insert(chatConversationTable).values(newConversationData).returning();
    if (!newConversation) throw new Error("Failed to create conversation.");
    const participantEntries = allUniqueParticipantIds.map(currentParticipantId => ({ user_id: currentParticipantId, conversation_id: newConversation.conversation_id, joined_at: now, last_read_at: currentParticipantId === creatorId ? now : null }));
    await db.insert(chatParticipantTable).values(participantEntries);
    const createdConvo = await db.query.chatConversationTable.findFirst({ where: eq(chatConversationTable.conversation_id, newConversation.conversation_id), with: { creator: { columns: { user_id: true, full_name: true, profile_picture: true }}, participants: { with: { user: { columns: { user_id: true, full_name: true, profile_picture: true } } } }, messages: { limit: 0 }} });
    if (!createdConvo) return null;
    return { ...createdConvo, created_at: formatTimestampForAPI(createdConvo.created_at), updated_at: formatTimestampForAPI(createdConvo.updated_at), last_message_sent_at: formatTimestampForAPI(createdConvo.last_message_sent_at) };
  },

  findOrCreateOneOnOneConversation: async (userId1: number, userId2: number): Promise<any | null> => {
    const subqueryUser1 = db.$with("user1_convos").as(db.select({ conversationId: chatParticipantTable.conversation_id }).from(chatParticipantTable).where(eq(chatParticipantTable.user_id, userId1)));
    const subqueryUser2 = db.$with("user2_convos").as(db.select({ conversationId: chatParticipantTable.conversation_id }).from(chatParticipantTable).where(eq(chatParticipantTable.user_id, userId2)));
    const subqueryParticipantCount = db.$with("p_counts").as(db.select({ conversationId: chatParticipantTable.conversation_id, count: sql<number>`count(DISTINCT ${chatParticipantTable.user_id})`.mapWith(Number).as("participant_count") }).from(chatParticipantTable).groupBy(chatParticipantTable.conversation_id));
    const existingConversations = await db.with(subqueryUser1, subqueryUser2, subqueryParticipantCount).select({ conversationId: chatConversationTable.conversation_id }).from(chatConversationTable).innerJoin(subqueryUser1, eq(chatConversationTable.conversation_id, subqueryUser1.conversationId)).innerJoin(subqueryUser2, eq(chatConversationTable.conversation_id, subqueryUser2.conversationId)).innerJoin(subqueryParticipantCount, eq(chatConversationTable.conversation_id, subqueryParticipantCount.conversationId)).where(and(eq(chatConversationTable.is_group_chat, false), eq(subqueryParticipantCount.count, 2))).limit(1);
    if (existingConversations.length > 0 && existingConversations[0]) {
      const convo = await db.query.chatConversationTable.findFirst({ where: eq(chatConversationTable.conversation_id, existingConversations[0].conversationId), with: { creator: { columns: { user_id: true, full_name: true, profile_picture: true }}, participants: { with: { user: { columns: { user_id: true, full_name: true, profile_picture: true } } } }, messages: { limit: 0 }} });
      if (!convo) return null;
      return { ...convo, created_at: formatTimestampForAPI(convo.created_at), updated_at: formatTimestampForAPI(convo.updated_at), last_message_sent_at: formatTimestampForAPI(convo.last_message_sent_at) };
    }
    return chatService.createConversation(userId1, [userId2], undefined, false);
  },

  getConversationsForUser: async (userId: number): Promise<any[]> => {
    const userParticipantEntries = await db.query.chatParticipantTable.findMany({ where: eq(chatParticipantTable.user_id, userId), with: { conversation: { with: { creator: { columns: {user_id: true, full_name: true, profile_picture: true }}, participants: { with: { user: { columns: { user_id: true, full_name: true, profile_picture: true }}}}}} } });
    if (!userParticipantEntries || userParticipantEntries.length === 0) return [];
    const conversationsData = userParticipantEntries.filter(entry => entry.conversation).map(entry => ({ ...(entry.conversation!), user_last_read_at: entry.last_read_at })).sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
    const conversationsWithDetails = await Promise.all(
        conversationsData.map(async (convo) => {
            let unreadCount = 0;
            if (convo.last_message_id && convo.conversation_id) {
                const lastReadAtForQuery = convo.user_last_read_at;
                // Comparison works perfectly with numbers
                const lastReadAtCondition = lastReadAtForQuery ? sql`${chatMessageTable.sent_at} > ${lastReadAtForQuery}` : sql`TRUE`;
                const countResult = await db.select({ count: sql<number>`COUNT(*)::int` }).from(chatMessageTable).where(and(eq(chatMessageTable.conversation_id, convo.conversation_id), ne(chatMessageTable.sender_id, userId), lastReadAtCondition)).execute();
                unreadCount = countResult[0]?.count || 0;
            }
            let dynamicTitle = String(convo.title || "");
            if (!convo.is_group_chat && !dynamicTitle) {
                const otherParticipantUser = convo.participants?.find((p: any) => p.user_id !== userId)?.user;
                const otherName = otherParticipantUser?.full_name ? String(otherParticipantUser.full_name) : (convo.creator?.full_name ? String(convo.creator.full_name) : "User");
                dynamicTitle = `Chat with ${otherName}`;
            }
            const previewData = convo.last_message_preview;
            let plainPreviewForDisplay = "";
            if (previewData && typeof previewData.content === 'string') {
                try { plainPreviewForDisplay = decryptText(previewData.content); } catch (e) { console.error(`[DECRYPTION FAILED] Convo ID: ${convo.conversation_id}`); }
            }
            const responseParticipants = convo.participants?.map((p: any) => p.user ? ({ user_id: p.user.user_id, full_name: String(p.user.full_name || "User"), profile_picture: p.user.profile_picture }) : null).filter(Boolean);
            return { ...convo, created_at: formatTimestampForAPI(convo.created_at), updated_at: formatTimestampForAPI(convo.updated_at), last_message_sent_at: formatTimestampForAPI(convo.last_message_sent_at), user_last_read_at: formatTimestampForAPI(convo.user_last_read_at), title: dynamicTitle, last_message_content_preview: plainPreviewForDisplay, unread_count: unreadCount, participants: responseParticipants };
        })
    );
    return conversationsWithDetails;
  },

  sendMessage: async (conversationId: number, senderId: number, content: string, messageType: string = 'text'): Promise<any | null> => {
    const participant = await db.query.chatParticipantTable.findFirst({ where: and(eq(chatParticipantTable.conversation_id, conversationId), eq(chatParticipantTable.user_id, senderId))});
    if (!participant) throw new Error("Sender is not a participant of this conversation.");
    if (typeof content !== 'string' || content.trim() === '') throw new Error("Message content must be a non-empty string.");
    const encryptedContent = encryptText(content);
    const sentAt = Date.now();
    const [newMessageRow] = await db.insert(chatMessageTable).values({ conversation_id: conversationId, sender_id: senderId, content: encryptedContent, message_type: messageType, sent_at: sentAt }).returning();
    if (!newMessageRow) throw new Error("Failed to send message.");
    const senderDetails = await getUserDetails(senderId);
    const plainContentPreview = generatePreview(content);
    const encryptedPreview = encryptText(plainContentPreview);
    const previewData: LastMessagePreview = { content: encryptedPreview, type: 'text' };
    await db.update(chatConversationTable).set({ 
        last_message_id: newMessageRow.message_id, 
        last_message_preview: previewData,
        last_message_sent_at: sentAt, 
        last_message_sender_id: senderId, 
        last_message_sender_name: senderDetails ? senderDetails.name : "User", 
        updated_at: sentAt
    }).where(eq(chatConversationTable.conversation_id, conversationId));
    const otherParticipants = await db.query.chatParticipantTable.findMany({ where: and(eq(chatParticipantTable.conversation_id, conversationId), ne(chatParticipantTable.user_id, senderId)) });
    for (const p of otherParticipants) {
      await createNotification({ user_id: p.user_id, type: 'new_chat_message', title: `New message from ${senderDetails ? senderDetails.name : "User"}`, message: plainContentPreview, related_entity_type: 'chat_message', related_entity_id: newMessageRow.message_id, link_url: `/chat/${conversationId}` });
    }
    return { ...newMessageRow, sent_at: formatTimestampForAPI(newMessageRow.sent_at), content: content, sender: senderDetails ? { user_id: senderDetails.id, full_name: senderDetails.name, profile_picture: senderDetails.profile_picture } : undefined };
  },

  addUserToConversation: async (conversationId: number, userIdToAdd: number, addedByUserId: number): Promise<boolean> => {
    const conversation = await db.query.chatConversationTable.findFirst({ where: eq(chatConversationTable.conversation_id, conversationId) });
    if (!conversation) throw new Error("Conversation not found.");
    if (!conversation.is_group_chat) throw new Error("Cannot add user to a 1-on-1 chat.");
    const isAdderParticipant = await db.query.chatParticipantTable.findFirst({ where: and(eq(chatParticipantTable.conversation_id, conversationId), eq(chatParticipantTable.user_id, addedByUserId)) });
    if(!isAdderParticipant) throw new Error("User not authorized to add participants to this conversation.");
    const existingParticipant = await db.query.chatParticipantTable.findFirst({ where: and(eq(chatParticipantTable.conversation_id, conversationId), eq(chatParticipantTable.user_id, userIdToAdd)) });
    if (existingParticipant) return true;
    await db.insert(chatParticipantTable).values({ user_id: userIdToAdd, conversation_id: conversationId, joined_at: Date.now() });
    return true;
  },

  getMessagesForConversation: async (conversationId: number, userId: number, limit: number = 30, offset: number = 0): Promise<Array<any>> => {
    const participant = await db.query.chatParticipantTable.findFirst({ where: and(eq(chatParticipantTable.conversation_id, conversationId), eq(chatParticipantTable.user_id, userId)) });
    if (!participant) throw new Error("User is not a participant of this conversation.");
    const messagesFromDb = await db.query.chatMessageTable.findMany({ where: eq(chatMessageTable.conversation_id, conversationId), orderBy: [desc(chatMessageTable.sent_at)], limit: limit, offset: offset, with: { sender: { columns: { full_name: true, user_id: true, profile_picture: true } } } });
    const processedMessages = messagesFromDb.map(msg => {
      const encryptedContentFromDb = msg.content;
      const plainContentForDisplay = encryptedContentFromDb ? decryptText(encryptedContentFromDb) : "";
      const senderName = msg.sender ? String(msg.sender.full_name || "User") : "User";
      const senderInfo = msg.sender ? { user_id: msg.sender.user_id, full_name: senderName, profile_picture: msg.sender.profile_picture } : undefined;
      return { ...msg, sent_at: formatTimestampForAPI(msg.sent_at), content: plainContentForDisplay, sender_name: senderName, sender: senderInfo };
    }).reverse();
    await db.update(chatParticipantTable).set({ last_read_at: Date.now() }).where(and(eq(chatParticipantTable.conversation_id, conversationId), eq(chatParticipantTable.user_id, userId)));
    return processedMessages;
  },
  
  markConversationAsRead: async (conversationId: number, userId: number): Promise<void> => {
    const now = Date.now();
    await db.update(chatParticipantTable).set({ last_read_at: now }).where(and(eq(chatParticipantTable.conversation_id, conversationId), eq(chatParticipantTable.user_id, userId)));
    await db.update(notificationTable).set({ is_read: true }).where(and(eq(notificationTable.user_id, userId), eq(notificationTable.type, 'new_chat_message'), eq(notificationTable.link_url, `/chat/${conversationId}`), eq(notificationTable.is_read, false)));
  },

  getConversationParticipants: async (conversationId: number): Promise<Array<any>> => {
    const participantsData = await db.query.chatParticipantTable.findMany({ where: eq(chatParticipantTable.conversation_id, conversationId), with: { user: { columns: { user_id: true, full_name: true, email: true, role: true, profile_picture: true }}} });
    return participantsData.map(p => p.user ? ({ user_id: p.user.user_id, full_name: String(p.user.full_name || "User"), email: p.user.email !== null && typeof p.user.email !== 'undefined' ? String(p.user.email) : null, role: p.user.role !== null && typeof p.user.role !== 'undefined' ? String(p.user.role) : null, profile_picture: p.user.profile_picture }) : null).filter(Boolean);
  }
};