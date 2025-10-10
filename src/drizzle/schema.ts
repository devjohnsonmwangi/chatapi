// src/drizzle/schema.ts

import { relations } from "drizzle-orm";
import { pgTable, pgEnum, serial, varchar, timestamp, integer, decimal, text, index, uniqueIndex, boolean, primaryKey ,bigint,jsonb} from "drizzle-orm/pg-core";

// --- Enums ---
export const roleEnum = pgEnum("role", ['admin', 'user', 'lawyer', 'client', 'clerks', 'manager', 'supports']);

export const notificationTypeEnum = pgEnum("notification_type", [
  'new_chat_message', 'event_reminder', 'upcoming_event', 'ticket_update', 'case_update', 'new_assignment',
  'appointment_booked', 'appointment_confirmed', 'appointment_cancelled', 'appointment_reminder', 'general_announcement'
]);

// NEW: Enum for Audit Log
export const auditActionTypeEnum = pgEnum("audit_action_type", ['CREATE', 'UPDATE', 'DELETE']);


// --- Tables ---

// 1. User Table
export const userTable = pgTable("userTable", {
  user_id: serial("user_id").primaryKey(),
  full_name: varchar("full_name"),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  phone_number: varchar("phone_number"),
  address: varchar("address"),
  role: roleEnum('role').default('client'),
  profile_picture: varchar("profile_picture"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }), // SOFT DELETE
});















// 13. Password Reset Token Table (NO SOFT DELETE - this is ephemeral and should be hard deleted)
export const passwordResetTokenTable = pgTable("passwordResetTokenTable", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  user_id: integer("user_id").notNull().references(() => userTable.user_id, { onDelete: "cascade" }), // Cascade is OK here
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenIndex: uniqueIndex("prt_token_idx").on(table.token),
  userIdIndex: index("prt_user_id_idx").on(table.user_id),
}));

// --- Chat Schema ---
export interface LastMessagePreview {
  content: string;
  type: 'text' | 'image' | 'file';
}

export const chatConversationTable = pgTable("chatConversationTable", {
  conversation_id: serial("conversation_id").primaryKey(),
  title: varchar("title", { length: 255 }),
  is_group_chat: boolean("is_group_chat").default(false).notNull(),
  creator_id: integer("creator_id").references(() => userTable.user_id, { onDelete: "set null" }),
  last_message_id: integer("last_message_id"),
  last_message_preview: jsonb("last_message_preview").$type<LastMessagePreview>(),
  last_message_sent_at: bigint("last_message_sent_at", { mode: 'number' }),
  last_message_sender_id: integer("last_message_sender_id"),
  last_message_sender_name: varchar("last_message_sender_name", {length: 255}),
  created_at: bigint("created_at", { mode: 'number' }).notNull(),
  updated_at: bigint("updated_at", { mode: 'number' }).notNull(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }), // SOFT DELETE
});

export const chatParticipantTable = pgTable("chatParticipantTable", {
  user_id: integer("user_id").notNull().references(() => userTable.user_id), // NO onDelete: "cascade"
  conversation_id: integer("conversation_id").notNull().references(() => chatConversationTable.conversation_id), // NO onDelete: "cascade"
  joined_at: bigint("joined_at", { mode: 'number' }).notNull(),
  last_read_at: bigint("last_read_at", { mode: 'number' }),
  deleted_at: timestamp("deleted_at", { withTimezone: true }), // SOFT DELETE
}, (table) => ({
  pk: primaryKey({ columns: [table.user_id, table.conversation_id] }),
}));

export const chatMessageTable = pgTable("chatMessageTable", {
  message_id: serial("message_id").primaryKey(),
  conversation_id: integer("conversation_id").notNull().references(() => chatConversationTable.conversation_id), // NO onDelete: "cascade"
  sender_id: integer("sender_id").notNull().references(() => userTable.user_id), // NO onDelete: "cascade"
  content: text("content").notNull
  (),
  message_type: varchar("message_type", { length: 50 }).default('text'),
  sent_at: bigint("sent_at", { mode: 'number' }).notNull(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }), // SOFT DELETE
});

// 17. Notification Table
export const notificationTable = pgTable("notificationTable", {
  notification_id: serial("notification_id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => userTable.user_id), // NO onDelete: "cascade"
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }),
  message: text("message").notNull(),
  related_entity_type: varchar("related_entity_type", { length: 50 }),
  related_entity_id: integer("related_entity_id"),
  link_url: varchar("link_url"),
  is_read: boolean("is_read").default(false).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deleted_at: timestamp("deleted_at", { withTimezone: true }), // SOFT DELETE
}, (table) => ({
  userIdx: index("notification_user_idx").on(table.user_id),
  userReadIdx: index("notification_user_read_idx").on(table.user_id, table.is_read),
}));



// ============================================
//           Relationships between Tables
// ============================================

// User Table Relationships
export const userRelations = relations(userTable, ({ many }) => ({
 

  passwordResetTokens: many(passwordResetTokenTable),
  chatParticipants: many(chatParticipantTable),
  sentChatMessages: many(chatMessageTable, { relationName: "sentMessagesByUser" }),
  notificationsForUser: many(notificationTable),
 
}));















// Password Reset Token Relationships
export const passwordResetTokenRelations = relations(passwordResetTokenTable, ({ one }) => ({
  user: one(userTable, { fields: [passwordResetTokenTable.user_id], references: [userTable.user_id] }),
}));

// Chat Conversation Relationships
export const chatConversationRelations = relations(chatConversationTable, ({ one, many }) => ({
  creator: one(userTable, { fields: [chatConversationTable.creator_id], references: [userTable.user_id] }),
  participants: many(chatParticipantTable),
  messages: many(chatMessageTable),
}));

// Chat Participant Relationships
export const chatParticipantRelations = relations(chatParticipantTable, ({ one }) => ({
  user: one(userTable, { fields: [chatParticipantTable.user_id], references: [userTable.user_id] }),
  conversation: one(chatConversationTable, { fields: [chatParticipantTable.conversation_id], references: [chatConversationTable.conversation_id] }),
}));

// Chat Message Relationships
export const chatMessageRelations = relations(chatMessageTable, ({ one }) => ({
  conversation: one(chatConversationTable, { fields: [chatMessageTable.conversation_id], references: [chatConversationTable.conversation_id] }),
  sender: one(userTable, { fields: [chatMessageTable.sender_id], references: [userTable.user_id], relationName: "sentMessagesByUser" }),
}));

// Notification Relationships
export const notificationRelations = relations(notificationTable, ({ one }) => ({
  recipient: one(userTable, { fields: [notificationTable.user_id], references: [userTable.user_id] }),
}));


// ============================================
//     Infer Types for Insert and Select
// ============================================
export type TUserInsert = typeof userTable.$inferInsert;
export type TUserSelect = typeof userTable.$inferSelect;









export type TPasswordResetTokenInsert = typeof passwordResetTokenTable.$inferInsert;
export type TPasswordResetTokenSelect = typeof passwordResetTokenTable.$inferSelect;

export type TChatConversationInsert = typeof chatConversationTable.$inferInsert;
export type TChatConversationSelect = typeof chatConversationTable.$inferSelect;

export type TChatParticipantInsert = typeof chatParticipantTable.$inferInsert;
export type TChatParticipantSelect = typeof chatParticipantTable.$inferSelect;

export type TChatMessageInsert = typeof chatMessageTable.$inferInsert;
export type TChatMessageSelect = typeof chatMessageTable.$inferSelect;

export type TNotificationInsert = typeof notificationTable.$inferInsert;
export type TNotificationSelect = typeof notificationTable.$inferSelect;

