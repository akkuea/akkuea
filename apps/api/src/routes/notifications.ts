import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, uuidParamSchema, authPlugin } from '../middleware';
import { NotificationController } from '../controllers/NotificationController';

const notificationQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const markMultipleAsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()),
});

export const notificationRoutes = new Elysia({ prefix: '/notifications' })
  .use(authPlugin)
  // GET /notifications - Get user's notifications
  .use(validate({ query: notificationQuerySchema }))
  .get('/', async (ctx) => NotificationController.getUserNotifications(ctx))

  // GET /notifications/unread-count - Get unread count
  .get('/unread-count', async (ctx) => NotificationController.getUnreadCount(ctx))

  // GET /notifications/:id - Get a specific notification
  .use(validate({ params: uuidParamSchema }))
  .get('/:id', async (ctx) => NotificationController.getNotificationById(ctx))

  // PATCH /notifications/:id/read - Mark as read
  .use(validate({ params: uuidParamSchema }))
  .patch('/:id/read', async (ctx) => NotificationController.markAsRead(ctx))

  // POST /notifications/read-multiple - Mark multiple as read
  .use(validate({ body: markMultipleAsReadSchema }))
  .post('/read-multiple', async (ctx) => NotificationController.markMultipleAsRead(ctx))

  // POST /notifications/read-all - Mark all as read
  .post('/read-all', async (ctx) => NotificationController.markAllAsRead(ctx))

  // DELETE /notifications/:id - Delete notification
  .use(validate({ params: uuidParamSchema }))
  .delete('/:id', async (ctx) => NotificationController.deleteNotification(ctx));
