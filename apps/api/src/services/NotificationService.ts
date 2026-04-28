import { NotificationRepository } from '../repositories/NotificationRepository';
import type {
  NewNotification,
  NotificationEventType,
  NotificationChannel,
  Notification,
} from '../db/schema';

interface CreateNotificationInput {
  userId: string;
  eventType: NotificationEventType;
  title: string;
  message: string;
  channel: NotificationChannel;
  recipient?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationDeliveryConfig {
  maxRetries: number;
  retryDelayMs: number;
}

export class NotificationService {
  private repository: NotificationRepository;
  private deliveryConfig: NotificationDeliveryConfig;

  constructor(repository?: NotificationRepository, config?: NotificationDeliveryConfig) {
    this.repository = repository || new NotificationRepository();
    this.deliveryConfig = config || {
      maxRetries: 3,
      retryDelayMs: 60000, // 1 minute
    };
  }

  /**
   * Create and queue a notification
   */
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const notification = await this.repository.create({
      userId: input.userId,
      eventType: input.eventType,
      title: input.title,
      message: input.message,
      channel: input.channel,
      recipient: input.recipient,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      deliveryStatus: 'PENDING',
      maxRetries: this.deliveryConfig.maxRetries.toString(),
      retryCount: '0',
    });

    return notification;
  }

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(inputs: CreateNotificationInput[]): Promise<Notification[]> {
    const notifications = inputs.map((input) => ({
      userId: input.userId,
      eventType: input.eventType,
      title: input.title,
      message: input.message,
      channel: input.channel,
      recipient: input.recipient,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      deliveryStatus: 'PENDING' as const,
      maxRetries: this.deliveryConfig.maxRetries.toString(),
      retryCount: '0',
    }));

    return this.repository.createMany(notifications as NewNotification[]);
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId: string, limit = 20, offset = 0): Promise<Notification[]> {
    return this.repository.findByUserId(userId, { limit, offset });
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.countUnreadByUserId(userId);
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return this.repository.findUnreadByUserId(userId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification | undefined> {
    return this.repository.markAsRead(notificationId);
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[]): Promise<Notification[]> {
    return this.repository.markMultipleAsRead(notificationIds);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    return this.repository.markAllAsReadForUser(userId);
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(notificationId: string): Promise<Notification | undefined> {
    return this.repository.findById(notificationId);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    return this.repository.delete(notificationId);
  }

  /**
   * Get pending notifications for delivery
   */
  async getPendingNotifications(): Promise<Notification[]> {
    return this.repository.findPendingDelivery();
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(notificationId: string): Promise<Notification | undefined> {
    return this.repository.updateDeliveryStatus(notificationId, 'SENT', {
      sentAt: new Date(),
    });
  }

  /**
   * Mark notification as delivered
   */
  async markAsDelivered(notificationId: string): Promise<Notification | undefined> {
    return this.repository.updateDeliveryStatus(notificationId, 'DELIVERED', {
      deliveredAt: new Date(),
    });
  }

  /**
   * Mark notification as failed and schedule retry
   */
  async markAsFailed(notificationId: string, reason: string): Promise<Notification | undefined> {
    const notification = await this.repository.findById(notificationId);
    if (!notification) return undefined;

    const retryCount = parseInt(notification.retryCount) + 1;
    const maxRetries = parseInt(notification.maxRetries);

    // Check if we should retry
    if (retryCount >= maxRetries) {
      return this.repository.updateDeliveryStatus(notificationId, 'FAILED', {
        failureReason: reason,
        retryCount,
      });
    }

    // Schedule next retry
    const nextRetryAt = new Date(Date.now() + this.deliveryConfig.retryDelayMs * retryCount);
    return this.repository.updateDeliveryStatus(notificationId, 'FAILED', {
      failureReason: reason,
      retryCount,
      nextRetryAt,
    });
  }

  /**
   * Get notifications ready for retry
   */
  async getNotificationsReadyForRetry(): Promise<Notification[]> {
    return this.repository.findReadyForRetry();
  }

  /**
   * Trigger a system alert notification
   */
  async sendSystemAlert(
    userId: string,
    title: string,
    message: string,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'SYSTEM_ALERT',
      title,
      message,
      channel,
    });
  }

  /**
   * Notify verification approval
   */
  async notifyVerificationApproved(
    userId: string,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'VERIFICATION_APPROVED',
      title: 'Verification Approved',
      message: 'Your KYC verification has been approved. You now have full access to the platform.',
      channel,
    });
  }

  /**
   * Notify verification rejection
   */
  async notifyVerificationRejected(
    userId: string,
    reason: string,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'VERIFICATION_REJECTED',
      title: 'Verification Rejected',
      message: `Your KYC verification was rejected. Reason: ${reason}`,
      channel,
    });
  }

  /**
   * Notify valuation update
   */
  async notifyValuationUpdated(
    userId: string,
    propertyId: string,
    newValuation: number,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'VALUATION_UPDATED',
      title: 'Property Valuation Updated',
      message: `The valuation for your property has been updated to $${newValuation.toFixed(2)}`,
      channel,
      relatedEntityType: 'property',
      relatedEntityId: propertyId,
      metadata: { newValuation },
    });
  }

  /**
   * Notify repayment reminder
   */
  async notifyRepaymentReminder(
    userId: string,
    loanId: string,
    amount: number,
    dueDate: Date,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'REPAYMENT_REMINDER',
      title: 'Repayment Due Soon',
      message: `You have a repayment of $${amount.toFixed(2)} due on ${dueDate.toLocaleDateString()}`,
      channel,
      relatedEntityType: 'loan',
      relatedEntityId: loanId,
      metadata: { amount, dueDate },
    });
  }

  /**
   * Notify overdue repayment
   */
  async notifyRepaymentOverdue(
    userId: string,
    loanId: string,
    amount: number,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'REPAYMENT_OVERDUE',
      title: 'Payment Overdue',
      message: `Your repayment of $${amount.toFixed(2)} is now overdue. Please pay immediately to avoid penalties.`,
      channel,
      relatedEntityType: 'loan',
      relatedEntityId: loanId,
      metadata: { amount },
    });
  }

  /**
   * Notify repayment processed
   */
  async notifyRepaymentProcessed(
    userId: string,
    loanId: string,
    amount: number,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'REPAYMENT_PROCESSED',
      title: 'Repayment Processed',
      message: `Your repayment of $${amount.toFixed(2)} has been successfully processed.`,
      channel,
      relatedEntityType: 'loan',
      relatedEntityId: loanId,
      metadata: { amount },
    });
  }

  /**
   * Notify risk warning
   */
  async notifyRiskWarning(
    userId: string,
    loanId: string,
    riskLevel: string,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'RISK_WARNING',
      title: 'Risk Warning',
      message: `Your loan is showing signs of ${riskLevel} risk. Please take appropriate action.`,
      channel,
      relatedEntityType: 'loan',
      relatedEntityId: loanId,
      metadata: { riskLevel },
    });
  }

  /**
   * Notify liquidation risk
   */
  async notifyLiquidationRisk(
    userId: string,
    loanId: string,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'LIQUIDATION_RISK',
      title: 'Liquidation Risk Alert',
      message:
        'Your loan is at risk of liquidation. Please take immediate action to prevent loss of collateral.',
      channel,
      relatedEntityType: 'loan',
      relatedEntityId: loanId,
    });
  }

  /**
   * Notify liquidation executed
   */
  async notifyLiquidationExecuted(
    userId: string,
    positionId: string,
    debtCovered: number,
    collateralSeized: number,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'LIQUIDATION_EXECUTED',
      title: 'Position Liquidated',
      message: `Your position has been liquidated. Debt covered: $${debtCovered.toFixed(2)}, collateral seized: ${collateralSeized.toFixed(7)}.`,
      channel,
      relatedEntityType: 'loan',
      relatedEntityId: positionId,
      metadata: { debtCovered, collateralSeized },
    });
  }

  /**
   * Notify investment opportunity
   */
  async notifyInvestmentOpportunity(
    userId: string,
    propertyId: string,
    title: string,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'INVESTMENT_OPPORTUNITY',
      title: 'New Investment Opportunity',
      message: title,
      channel,
      relatedEntityType: 'property',
      relatedEntityId: propertyId,
    });
  }

  /**
   * Notify portfolio update
   */
  async notifyPortfolioUpdate(
    userId: string,
    summary: string,
    channel: NotificationChannel = 'IN_APP',
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      eventType: 'PORTFOLIO_UPDATE',
      title: 'Portfolio Update',
      message: summary,
      channel,
    });
  }

  /**
   * Get notifications by related entity
   */
  async getNotificationsByEntity(entityType: string, entityId: string): Promise<Notification[]> {
    return this.repository.findByRelatedEntity(entityType, entityId);
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(daysToKeep = 90): Promise<number> {
    return this.repository.deleteOlderThan(daysToKeep);
  }
}
