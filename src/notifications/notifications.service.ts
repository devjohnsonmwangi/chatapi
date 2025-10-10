// src/notifications/notification.service.ts
import  db  from '../drizzle/db';
import { notificationTable, TNotificationInsert, TNotificationSelect, notificationTypeEnum } from '../drizzle/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

// Helper type for notification type enum values
type NotificationType = typeof notificationTypeEnum.enumValues[number];


const _createNotification = async (data: Omit<TNotificationInsert, 'notification_id' | 'created_at' | 'is_read'>): Promise<TNotificationSelect> => {
    const notificationData: TNotificationInsert = {
      ...data,
      is_read: false,
      // created_at is handled by defaultNow()
    };
    const [newNotification] = await db.insert(notificationTable).values(notificationData).returning();
    if (!newNotification) {
      throw new Error('Failed to create notification');
    }
    // TODO: Trigger real-time events (WebSockets) if applicable
    return newNotification;
};


export const notificationService = {
  createNotification: _createNotification, // Expose it through the service object too

  getNotificationsForUser: async (
    userId: number,
    filters: { onlyUnread?: boolean; type?: NotificationType; limit?: number; offset?: number } = {}
  ): Promise<TNotificationSelect[]> => {
    const conditions = [eq(notificationTable.user_id, userId)];
    if (filters.onlyUnread) {
      conditions.push(eq(notificationTable.is_read, false));
    }
    if (filters.type) {
      conditions.push(eq(notificationTable.type, filters.type));
    }

    return db.query.notificationTable.findMany({
      where: and(...conditions),
      orderBy: [desc(notificationTable.created_at)],
      limit: filters.limit || 20,
      offset: filters.offset || 0,
    });
  },

  getUnreadNotificationCount: async (userId: number): Promise<number> => {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(notificationTable)
      .where(and(eq(notificationTable.user_id, userId), eq(notificationTable.is_read, false)));
    return result[0]?.count || 0;
  },

  markNotificationAsRead: async (notificationId: number, userId: number): Promise<TNotificationSelect | undefined> => {
    const [updatedNotification] = await db.update(notificationTable)
      .set({ is_read: true })
      .where(and(eq(notificationTable.notification_id, notificationId), eq(notificationTable.user_id, userId)))
      .returning();
    return updatedNotification;
  },

  markMultipleNotificationsAsRead: async (notificationIds: number[], userId: number): Promise<{ count: number }> => {
    if(notificationIds.length === 0) return { count: 0 };
    const result = await db.update(notificationTable)
        .set({ is_read: true })
        .where(and(
            inArray(notificationTable.notification_id, notificationIds),
            eq(notificationTable.user_id, userId)
        ))
        .returning({ id: notificationTable.notification_id });
    return { count: result.length };
  },

  markAllNotificationsAsReadForUser: async (userId: number): Promise<{ count: number }> => {
    const result = await db.update(notificationTable)
      .set({ is_read: true })
      .where(and(eq(notificationTable.user_id, userId), eq(notificationTable.is_read, false)))
      .returning({ id: notificationTable.notification_id });
    return { count: result.length };
  },

  deleteNotification: async (notificationId: number, userId: number): Promise<boolean> => {
    const result = await db.delete(notificationTable)
      .where(and(eq(notificationTable.notification_id, notificationId), eq(notificationTable.user_id, userId)))
      .returning();
    return result.length > 0;
  },
};

// Export standalone for easy import in other services
export const createNotification = _createNotification;