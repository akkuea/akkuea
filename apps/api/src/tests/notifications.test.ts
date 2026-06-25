import { describe, test, expect, spyOn, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { errorHandler } from '../middleware/errorHandler';
import { notificationRoutes } from '../routes/notifications';
import { NotificationService } from '../services/NotificationService';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_WALLET = 'GCVCMAB2RFWXYUOURL7XY3MW6LZUK6FQ5T6E7UFRHH4Y6OL43WER4QYF';

describe('Notifications API Smoke Test', () => {
  const app = new Elysia().use(errorHandler).use(notificationRoutes);
  let getUserNotificationsSpy: ReturnType<typeof spyOn>;
  let testToken: string;

  beforeEach(() => {
    // Mock NotificationService to avoid hitting the database
    getUserNotificationsSpy = spyOn(
      NotificationService.prototype,
      'getUserNotifications',
    ).mockImplementation(async (userId, _limit, _offset) => {
      return [
        {
          id: 'notification-1',
          userId,
          eventType: 'SYSTEM_ALERT',
          title: 'Test Notification',
          message: 'This is a test notification',
          channel: 'IN_APP',
          deliveryStatus: 'SENT',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any;
    });

    testToken = jwt.sign({ id: TEST_USER_ID, walletAddress: TEST_WALLET }, JWT_SECRET);
  });

  afterEach(() => {
    getUserNotificationsSpy.mockRestore();
  });

  test('GET /notifications returns 401 for unauthenticated requests', async () => {
    const response = await app.handle(new Request('http://localhost/notifications'));
    expect(response.status).toBe(401);
  });

  test('GET /notifications returns 200 for authenticated requests', async () => {
    const response = await app.handle(
      new Request('http://localhost/notifications', {
        headers: {
          Authorization: `Bearer ${testToken}`,
        },
      }),
    );

    expect(response.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await response.json()) as any;
    expect(body.data).toBeDefined();
    expect(body.data[0].title).toBe('Test Notification');
  });
});
