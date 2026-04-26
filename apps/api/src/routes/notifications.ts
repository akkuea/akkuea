import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, uuidParamSchema } from '../middleware';
import { NotificationController } from '../controllers/NotificationController';

const notificationQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const markMultipleAsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()),
});

export const notificationRoutes = new Elysia({ prefix: '/notifications' })
  // GET /notifications - Get user's notifications
  .use(validate({ query: notificationQuerySchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/', async (ctx: any) => NotificationController.getUserNotifications(ctx))

  // GET /notifications/unread-count - Get unread count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/unread-count', async (ctx: any) => NotificationController.getUnreadCount(ctx))

  // GET /notifications/:id - Get a specific notification
  .use(validate({ params: uuidParamSchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .get('/:id', async (ctx: any) => NotificationController.getNotificationById(ctx))

  // PATCH /notifications/:id/read - Mark as read
  .use(validate({ params: uuidParamSchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .patch('/:id/read', async (ctx: any) => NotificationController.markAsRead(ctx))

  // POST /notifications/read-multiple - Mark multiple as read
  .use(validate({ body: markMultipleAsReadSchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .post('/read-multiple', async (ctx: any) => NotificationController.markMultipleAsRead(ctx))

  // POST /notifications/read-all - Mark all as read
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .post('/read-all', async (ctx: any) => NotificationController.markAllAsRead(ctx))

  // DELETE /notifications/:id - Delete notification
  .use(validate({ params: uuidParamSchema }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .delete('/:id', async (ctx: any) => NotificationController.deleteNotification(ctx));
