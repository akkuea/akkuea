import { Elysia } from 'elysia';
import { z } from 'zod';
import { validate, uuidParamSchema, authPlugin } from '../middleware';
import { NotificationController } from '../controllers/NotificationController';

const notificationQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
});

// NOTE: NotificationController.markMultipleAsRead reads the raw request body
// itself instead of the validated body (separate, out-of-scope bug; see the
// controller for the enforced cap in the meantime). The schema still guards
// the route: an invalid payload is rejected before the handler runs.
const markMultipleAsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).max(100),
});

export const notificationRoutes = new Elysia({ prefix: '/notifications' })
  .use(authPlugin)
  // GET /notifications - Get user's notifications
  .group('', (app) =>
    app
      .use(validate({ query: notificationQuerySchema }))
      .get('/', async (ctx) => NotificationController.getUserNotifications(ctx), {
        detail: {
          summary: 'List notifications',
          description: 'Retrieve notifications for the authenticated user',
          tags: ['Notifications'],
        },
      }),
  )

  // GET /notifications/unread-count - Get unread count
  .get('/unread-count', async (ctx) => NotificationController.getUnreadCount(ctx), {
    detail: {
      summary: 'Get unread count',
      description: 'Get the count of unread notifications for the authenticated user',
      tags: ['Notifications'],
    },
  })

  // GET /notifications/:id - Get a specific notification
  .group('', (app) =>
    app
      .use(validate({ params: uuidParamSchema }))
      .get('/:id', async (ctx) => NotificationController.getNotificationById(ctx), {
        detail: {
          summary: 'Get notification',
          description: 'Retrieve a specific notification by ID',
          tags: ['Notifications'],
        },
      }),
  )

  // PATCH /notifications/:id/read - Mark as read
  .group('', (app) =>
    app
      .use(validate({ params: uuidParamSchema }))
      .patch('/:id/read', async (ctx) => NotificationController.markAsRead(ctx), {
        detail: {
          summary: 'Mark as read',
          description: 'Mark a specific notification as read',
          tags: ['Notifications'],
        },
      }),
  )

  // POST /notifications/read-multiple - Mark multiple as read
  .group('', (app) =>
    app
      .use(validate({ body: markMultipleAsReadSchema }))
      .post('/read-multiple', async (ctx) => NotificationController.markMultipleAsRead(ctx), {
        detail: {
          summary: 'Mark multiple as read',
          description: 'Mark multiple notifications as read by their IDs',
          tags: ['Notifications'],
        },
      }),
  )

  // POST /notifications/read-all - Mark all as read
  .post('/read-all', async (ctx) => NotificationController.markAllAsRead(ctx), {
    detail: {
      summary: 'Mark all as read',
      description: 'Mark all unread notifications as read for the authenticated user',
      tags: ['Notifications'],
    },
  })

  // DELETE /notifications/:id - Delete notification
  .group('', (app) =>
    app
      .use(validate({ params: uuidParamSchema }))
      .delete('/:id', async (ctx) => NotificationController.deleteNotification(ctx), {
        detail: {
          summary: 'Delete notification',
          description: 'Delete a specific notification by ID',
          tags: ['Notifications'],
        },
      }),
  );
