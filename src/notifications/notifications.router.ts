// src/notifications/notification.router.ts
import { Hono } from 'hono';
import { notificationController } from './notifications.controller';
// import { authenticateMiddleware } from '../auth/middleware'; // TODO

export const notificationRouter = new Hono();

// notificationRouter.use('*', authenticateMiddleware);

notificationRouter.get('/', notificationController.getNotifications);
notificationRouter.get('/unread-count', notificationController.getUnreadCount);
notificationRouter.post('/read-all', notificationController.markAllAsRead);
notificationRouter.post('/read-multiple', notificationController.markMultipleAsRead); // New route for multiple specific
notificationRouter.post('/:id/read', notificationController.markAsRead);
notificationRouter.delete('/:id', notificationController.deleteNotification);