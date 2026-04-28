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

export const notificationRoutes = new Elysia({ prefix: '/notifications', tags: ['Notifications'] })

  /**
   * GET /notifications
   */
  .use(validate({ query: notificationQuerySchema }))
  .get('/', async (ctx) => NotificationController.getUserNotifications(ctx), {
    query: notificationQuerySchema,
    detail: {
      summary: 'Get user notifications',
    },
  })

  /**
   * GET /notifications/unread-count
   */
  .get('/unread-count', async (ctx) => NotificationController.getUnreadCount(ctx), {
    detail: {
      summary: 'Get unread notification count',
    },
  })

  /**
   * GET /notifications/:id
   */
  .use(validate({ params: uuidParamSchema }))
  .get('/:id', async (ctx) => NotificationController.getNotificationById(ctx), {
    params: uuidParamSchema,
    detail: {
      summary: 'Get notification by ID',
    },
  })

  /**
   * PATCH /notifications/:id/read
   */
  .use(validate({ params: uuidParamSchema }))
  .patch('/:id/read', async (ctx) => NotificationController.markAsRead(ctx), {
    params: uuidParamSchema,
    detail: {
      summary: 'Mark notification as read',
    },
  })

  /**
   * POST /notifications/read-multiple
   */
  .use(validate({ body: markMultipleAsReadSchema }))
  .post('/read-multiple', async (ctx) => NotificationController.markMultipleAsRead(ctx), {
    body: markMultipleAsReadSchema,
    detail: {
      summary: 'Mark multiple notifications as read',
    },
  })

  /**
   * POST /notifications/read-all
   */
  .post('/read-all', async (ctx) => NotificationController.markAllAsRead(ctx), {
    detail: {
      summary: 'Mark all notifications as read',
    },
  })

  /**
   * DELETE /notifications/:id
   */
  .use(validate({ params: uuidParamSchema }))
  .delete('/:id', async (ctx) => NotificationController.deleteNotification(ctx), {
    params: uuidParamSchema,
    detail: {
      summary: 'Delete notification',
    },
  });
