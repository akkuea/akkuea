import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { NotificationService } from '../services/NotificationService';
import { NotificationRepository } from '../repositories/NotificationRepository';
import type { Notification } from '../db/schema';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockRepository: Partial<NotificationRepository>;

  beforeEach(() => {
    // Mock the repository
    mockRepository = {
      create: mock(() =>
        Promise.resolve({
          id: 'notification-1',
          userId: 'user-1',
          eventType: 'SYSTEM_ALERT',
          title: 'Test Alert',
          message: 'Test message',
          channel: 'IN_APP',
          deliveryStatus: 'PENDING',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Notification),
      ),

      createMany: mock(() =>
        Promise.resolve([
          {
            id: 'notification-1',
            userId: 'user-1',
            eventType: 'SYSTEM_ALERT',
            title: 'Test Alert',
            message: 'Test message',
            channel: 'IN_APP',
            deliveryStatus: 'PENDING',
            isRead: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Notification,
        ]),
      ),

      findByUserId: mock(() =>
        Promise.resolve([
          {
            id: 'notification-1',
            userId: 'user-1',
            eventType: 'SYSTEM_ALERT',
            title: 'Test Alert',
            message: 'Test message',
            channel: 'IN_APP',
            deliveryStatus: 'PENDING',
            isRead: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Notification,
        ]),
      ),

      countUnreadByUserId: mock(() => Promise.resolve(1)),

      findUnreadByUserId: mock(() =>
        Promise.resolve([
          {
            id: 'notification-1',
            userId: 'user-1',
            eventType: 'SYSTEM_ALERT',
            title: 'Test Alert',
            message: 'Test message',
            channel: 'IN_APP',
            deliveryStatus: 'PENDING',
            isRead: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Notification,
        ]),
      ),

      findById: mock(() =>
        Promise.resolve({
          id: 'notification-1',
          userId: 'user-1',
          eventType: 'SYSTEM_ALERT',
          title: 'Test Alert',
          message: 'Test message',
          channel: 'IN_APP',
          deliveryStatus: 'PENDING',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Notification),
      ),

      markAsRead: mock(() =>
        Promise.resolve({
          id: 'notification-1',
          userId: 'user-1',
          eventType: 'SYSTEM_ALERT',
          title: 'Test Alert',
          message: 'Test message',
          channel: 'IN_APP',
          deliveryStatus: 'PENDING',
          isRead: true,
          readAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Notification),
      ),

      markMultipleAsRead: mock(() =>
        Promise.resolve([
          {
            id: 'notification-1',
            isRead: true,
            readAt: new Date(),
          } as Notification,
        ]),
      ),

      markAllAsReadForUser: mock(() => Promise.resolve(1)),

      updateDeliveryStatus: mock(() =>
        Promise.resolve({
          id: 'notification-1',
          deliveryStatus: 'SENT',
          sentAt: new Date(),
        } as unknown as Notification),
      ),

      findPendingDelivery: mock(() => Promise.resolve([])),

      findReadyForRetry: mock(() => Promise.resolve([])),

      findByRelatedEntity: mock(() => Promise.resolve([])),

      delete: mock(() => Promise.resolve(true)),

      deleteOlderThan: mock(() => Promise.resolve(10)),
    };

    notificationService = new NotificationService(mockRepository as NotificationRepository);
  });

  describe('createNotification', () => {
    it('should create a notification', async () => {
      const result = await notificationService.createNotification({
        userId: 'user-1',
        eventType: 'SYSTEM_ALERT',
        title: 'Test Alert',
        message: 'Test message',
        channel: 'IN_APP',
      });

      expect(result.id).toBe('notification-1');
      expect(result.userId).toBe('user-1');
      expect(result.eventType).toBe('SYSTEM_ALERT');
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should create a notification with metadata', async () => {
      const metadata = { key: 'value' };
      const result = await notificationService.createNotification({
        userId: 'user-1',
        eventType: 'VERIFICATION_APPROVED',
        title: 'Verification Approved',
        message: 'Your verification is approved',
        channel: 'EMAIL',
        metadata,
      });

      expect(result.id).toBe('notification-1');
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('createBulkNotifications', () => {
    it('should create multiple notifications', async () => {
      const inputs = [
        {
          userId: 'user-1',
          eventType: 'SYSTEM_ALERT' as const,
          title: 'Alert 1',
          message: 'Message 1',
          channel: 'IN_APP' as const,
        },
      ];

      const result = await notificationService.createBulkNotifications(inputs);

      expect(result.length).toBeGreaterThan(0);
      expect(mockRepository.createMany).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('should retrieve user notifications', async () => {
      const result = await notificationService.getUserNotifications('user-1', 20, 0);

      expect(result.length).toBeGreaterThan(0);
      expect(mockRepository.findByUserId).toHaveBeenCalled();
    });

    it('should support pagination', async () => {
      await notificationService.getUserNotifications('user-1', 10, 20);

      expect(mockRepository.findByUserId).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const count = await notificationService.getUnreadCount('user-1');

      expect(count).toBe(1);
      expect(mockRepository.countUnreadByUserId).toHaveBeenCalled();
    });
  });

  describe('getUnreadNotifications', () => {
    it('should retrieve unread notifications', async () => {
      const result = await notificationService.getUnreadNotifications('user-1');

      expect(result.length).toBeGreaterThan(0);
      expect(mockRepository.findUnreadByUserId).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const result = await notificationService.markAsRead('notification-1');

      expect(result?.isRead).toBe(true);
      expect(mockRepository.markAsRead).toHaveBeenCalled();
    });
  });

  describe('markMultipleAsRead', () => {
    it('should mark multiple notifications as read', async () => {
      const result = await notificationService.markMultipleAsRead(['notification-1']);

      expect(result.length).toBeGreaterThan(0);
      expect(mockRepository.markMultipleAsRead).toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for user', async () => {
      const count = await notificationService.markAllAsRead('user-1');

      expect(count).toBe(1);
      expect(mockRepository.markAllAsReadForUser).toHaveBeenCalled();
    });
  });

  describe('markAsSent', () => {
    it('should mark notification as sent', async () => {
      const result = await notificationService.markAsSent('notification-1');

      expect(result?.deliveryStatus).toBe('SENT');
      expect(mockRepository.updateDeliveryStatus).toHaveBeenCalled();
    });
  });

  describe('markAsFailed', () => {
    it('should mark notification as failed and schedule retry', async () => {
      await notificationService.markAsFailed('notification-1', 'Failed to send');

      expect(mockRepository.updateDeliveryStatus).toHaveBeenCalled();
    });
  });

  describe('Notification type helpers', () => {
    it('should send verification approved notification', async () => {
      await notificationService.notifyVerificationApproved('user-1');

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should send verification rejected notification', async () => {
      await notificationService.notifyVerificationRejected('user-1', 'Invalid documents');

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should send valuation updated notification', async () => {
      await notificationService.notifyValuationUpdated('user-1', 'property-1', 500000);

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should send repayment reminder notification', async () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      await notificationService.notifyRepaymentReminder('user-1', 'loan-1', 5000, dueDate);

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should send repayment overdue notification', async () => {
      await notificationService.notifyRepaymentOverdue('user-1', 'loan-1', 5000);

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should send risk warning notification', async () => {
      await notificationService.notifyRiskWarning('user-1', 'loan-1', 'warning');

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should send liquidation risk notification', async () => {
      await notificationService.notifyLiquidationRisk('user-1', 'loan-1');

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should send investment opportunity notification', async () => {
      await notificationService.notifyInvestmentOpportunity(
        'user-1',
        'property-1',
        'New opportunity',
      );

      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should send portfolio update notification', async () => {
      await notificationService.notifyPortfolioUpdate('user-1', 'Your portfolio value increased');

      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('getPendingNotifications', () => {
    it('should retrieve pending notifications', async () => {
      await notificationService.getPendingNotifications();

      expect(mockRepository.findPendingDelivery).toHaveBeenCalled();
    });
  });

  describe('getNotificationsReadyForRetry', () => {
    it('should retrieve notifications ready for retry', async () => {
      await notificationService.getNotificationsReadyForRetry();

      expect(mockRepository.findReadyForRetry).toHaveBeenCalled();
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete old notifications', async () => {
      const result = await notificationService.cleanupOldNotifications(90);

      expect(result).toBe(10);
      expect(mockRepository.deleteOlderThan).toHaveBeenCalled();
    });
  });
});
