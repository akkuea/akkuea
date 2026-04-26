import type { Context } from 'elysia';
import { NotificationService } from '../services/NotificationService';
import { ApiError } from '../errors/ApiError';

type NotificationBody = {
  email?: string;
  wallet?: string;
  message?: string;
  notificationIds?: string[];
};

export class NotificationController {
  private static notificationService = new NotificationService();

  /**
   * Helper method to create JSON responses
   */
  private static jsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Get notifications for authenticated user
   */
  static async getUserNotifications(
    ctx: Context<{ query: { limit?: string; offset?: string } }>,
  ): Promise<Response> {
    const userId = ctx.headers['x-user-id'];

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const limit = ctx.query.limit ? parseInt(ctx.query.limit) : 20;
    const offset = ctx.query.offset ? parseInt(ctx.query.offset) : 0;

    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Limit must be between 1 and 100');
    }
    if (offset < 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Offset must be non-negative');
    }

    try {
      const notifications = await this.notificationService.getUserNotifications(
        userId,
        limit,
        offset,
      );
      return this.jsonResponse({
        data: notifications,
        pagination: { limit, offset },
      });
    } catch (error) {
      console.error(error);

      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to retrieve notifications');
    }
  }

  /**
   * Get unread notifications count
   */
  static async getUnreadCount(ctx: Context): Promise<Response> {
    const userId = ctx.headers['x-user-id'];

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    try {
      const count = await this.notificationService.getUnreadCount(userId);
      return this.jsonResponse({ unreadCount: count });
    } catch (error) {
      console.error(error);

      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to retrieve unread count');
    }
  }

  /**
   * Get a single notification by ID
   */
  static async getNotificationById(ctx: Context<{ params: { id: string } }>): Promise<Response> {
    const userId = ctx.headers['x-user-id'];
    const { id } = ctx.params;

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    try {
      const notification = await this.notificationService.getNotificationById(id);

      if (!notification) {
        throw new ApiError(404, 'NOT_FOUND', 'Notification not found');
      }

      // Verify ownership
      if (notification.userId !== userId) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'You do not have permission to view this notification',
        );
      }

      return this.jsonResponse(notification);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to retrieve notification');
    }
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(ctx: Context<{ params: { id: string } }>): Promise<Response> {
    const userId = ctx.headers['x-user-id'];
    const { id } = ctx.params;

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    try {
      const notification = await this.notificationService.getNotificationById(id);

      if (!notification) {
        throw new ApiError(404, 'NOT_FOUND', 'Notification not found');
      }

      // Verify ownership
      if (notification.userId !== userId) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'You do not have permission to update this notification',
        );
      }

      const updated = await this.notificationService.markAsRead(id);
      return this.jsonResponse(updated, 200);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to update notification');
    }
  }

  /**
   * Mark multiple notifications as read
   */
  static async markMultipleAsRead(ctx: Context): Promise<Response> {
    const userId = ctx.headers['x-user-id'];

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    let body: NotificationBody;
    try {
      body = (await ctx.request.json()) as NotificationBody;
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request body');
    }

    if (!body.notificationIds || !Array.isArray(body.notificationIds)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'notificationIds must be an array');
    }

    try {
      // Verify ownership of all notifications
      for (const id of body.notificationIds) {
        const notification = await this.notificationService.getNotificationById(id);
        if (!notification || notification.userId !== userId) {
          throw new ApiError(
            403,
            'FORBIDDEN',
            'You do not have permission to update these notifications',
          );
        }
      }

      const updated = await this.notificationService.markMultipleAsRead(body.notificationIds);
      return this.jsonResponse({
        data: updated,
        message: `${updated.length} notifications marked as read`,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to update notifications');
    }
  }

  /**
   * Mark all notifications as read for the user
   */
  static async markAllAsRead(ctx: Context): Promise<Response> {
    const userId = ctx.headers['x-user-id'];

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    try {
      const count = await this.notificationService.markAllAsRead(userId);
      return this.jsonResponse({
        message: `${count} notifications marked as read`,
        count,
      });
    } catch (error) {
      console.error(error);

      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to update notifications');
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(ctx: Context<{ params: { id: string } }>): Promise<Response> {
    const userId = ctx.headers['x-user-id'];
    const { id } = ctx.params;

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    try {
      const notification = await this.notificationService.getNotificationById(id);

      if (!notification) {
        throw new ApiError(404, 'NOT_FOUND', 'Notification not found');
      }

      // Verify ownership
      if (notification.userId !== userId) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'You do not have permission to delete this notification',
        );
      }

      const deleted = await this.notificationService.deleteNotification(id);

      if (!deleted) {
        throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to delete notification');
      }

      return this.jsonResponse({ message: 'Notification deleted successfully' });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, 'INTERNAL_ERROR', 'Failed to delete notification');
    }
  }
}
