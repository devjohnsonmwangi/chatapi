// src/notifications/notification.controller.ts
import { Context } from 'hono';
import { notificationService } from './notifications.service';
// import { GetNotificationsQuerySchema, MarkReadSchema } from './notification.validation'; // TODO

export const notificationController = {
  getNotifications: async (c: Context) => {
    try {
      const authenticatedUserId = c.get('userId') as number; // Placeholder
      if (!authenticatedUserId) return c.json({ error: 'Unauthorized' }, 401);
      // const query = GetNotificationsQuerySchema.parse(c.req.query()); // TODO
      const query = c.req.query();
      const filters: any = {
        onlyUnread: query.unread === 'true',
        limit: parseInt(query.limit || '20'),
        offset: parseInt(query.offset || '0'),
      };
      if(query.type) filters.type = query.type;

      const notifications = await notificationService.getNotificationsForUser(authenticatedUserId, filters);
      return c.json(notifications);
    } catch (error: any) {
      // if (error instanceof ZodError) return c.json({ error: error.errors }, 400);
      return c.json({ error: error.message || 'Failed to fetch notifications' }, 500);
    }
  },

  getUnreadCount: async (c: Context) => {
    try {
      const authenticatedUserId = c.get('userId') as number; // Placeholder
      if (!authenticatedUserId) return c.json({ error: 'Unauthorized' }, 401);
      const count = await notificationService.getUnreadNotificationCount(authenticatedUserId);
      return c.json({ count });
    } catch (error: any) {
      return c.json({ error: error.message || 'Failed to fetch unread count' }, 500);
    }
  },

  markAsRead: async (c: Context) => {
    try {
      const authenticatedUserId = c.get('userId') as number; // Placeholder
      if (!authenticatedUserId) return c.json({ error: 'Unauthorized' }, 401);
      const notificationId = parseInt(c.req.param('id'));
      if (isNaN(notificationId)) return c.json({ error: 'Invalid notification ID' }, 400);

      const notification = await notificationService.markNotificationAsRead(notificationId, authenticatedUserId);
      if (!notification) return c.json({ error: 'Notification not found or not authorized' }, 404);
      return c.json(notification);
    } catch (error: any) {
      return c.json({ error: error.message || 'Failed to mark notification as read' }, 500);
    }
  },

  markMultipleAsRead: async (c: Context) => {
    try {
        const authenticatedUserId = c.get('userId') as number; // Placeholder
        if (!authenticatedUserId) return c.json({ error: 'Unauthorized' }, 401);
        const { ids } = await c.req.json(); // Expect an array of notification IDs
        // TODO: Validate ids is an array of numbers
        if (!Array.isArray(ids) || !ids.every(id => typeof id === 'number')) {
            return c.json({ error: 'Invalid input: "ids" must be an array of numbers.' }, 400);
        }
        const result = await notificationService.markMultipleNotificationsAsRead(ids, authenticatedUserId);
        return c.json(result);
    } catch (error: any) {
        return c.json({ error: error.message || 'Failed to mark notifications as read' }, 500);
    }
  },

  markAllAsRead: async (c: Context) => {
    try {
      const authenticatedUserId = c.get('userId') as number; // Placeholder
      if (!authenticatedUserId) return c.json({ error: 'Unauthorized' }, 401);
      const result = await notificationService.markAllNotificationsAsReadForUser(authenticatedUserId);
      return c.json({ message: `${result.count} notifications marked as read.` });
    } catch (error: any) {
      return c.json({ error: error.message || 'Failed to mark all as read' }, 500);
    }
  },

  deleteNotification: async (c: Context) => {
    try {
      const authenticatedUserId = c.get('userId') as number; // Placeholder
      if (!authenticatedUserId) return c.json({ error: 'Unauthorized' }, 401);
      const notificationId = parseInt(c.req.param('id'));
      if (isNaN(notificationId)) return c.json({ error: 'Invalid notification ID' }, 400);

      const success = await notificationService.deleteNotification(notificationId, authenticatedUserId);
      if (!success) return c.json({ error: 'Notification not found or failed to delete' }, 404);
      return c.json({ message: 'Notification deleted successfully' });
    } catch (error: any) {
      return c.json({ error: error.message || 'Failed to delete notification' }, 500);
    }
  },
};