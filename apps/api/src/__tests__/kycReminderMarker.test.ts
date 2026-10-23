/**
 * Database tests for the KYC expiring-soon reminder marker.
 *
 * kycExpiryJob.test.ts covers the job against an in-memory table; these run
 * the real KYCRepository queries so the marker SQL itself is verified.
 */

import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema/users';
import { kycRepository } from '../repositories/KYCRepository';
import { userRepository } from '../repositories/UserRepository';

const skipIfNoDatabase = !process.env.DATABASE_URL;
const REMINDER_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1_000);
}

function uniqueWallet(): string {
  return `G${crypto.randomUUID().replace(/-/g, '').toUpperCase().padEnd(55, 'R')}`;
}

async function isCandidate(userId: string): Promise<boolean> {
  const rows = await kycRepository.findUsersExpiringWithin(REMINDER_WINDOW_MS);
  return rows.some((row) => row.id === userId);
}

describe.skipIf(skipIfNoDatabase)('KYC reminder marker', () => {
  const createdUserIds: string[] = [];
  let userId = '';

  beforeEach(async () => {
    const user = await userRepository.getOrCreateByWallet(uniqueWallet());
    userId = user.id;
    createdUserIds.push(userId);
    await kycRepository.updateUserKycStatus(userId, 'approved', daysFromNow(15));
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it('claims a reminder once per expiry and then excludes the user', async () => {
    expect(await isCandidate(userId)).toBe(true);

    expect(await kycRepository.claimKycReminder(userId)).toBe(true);
    expect(await kycRepository.claimKycReminder(userId)).toBe(false);
    expect(await isCandidate(userId)).toBe(false);
  });

  it('makes the user a candidate again after a re-approval with a new expiry', async () => {
    await kycRepository.claimKycReminder(userId);

    await kycRepository.updateUserKycStatus(userId, 'approved', daysFromNow(20));

    expect(await isCandidate(userId)).toBe(true);
    expect(await kycRepository.claimKycReminder(userId)).toBe(true);
    expect(await isCandidate(userId)).toBe(false);
  });

  it('keeps the marker when the status changes without a new approval', async () => {
    await kycRepository.claimKycReminder(userId);

    await kycRepository.updateUserKycStatus(userId, 'approved');

    expect(await isCandidate(userId)).toBe(false);
  });

  it('releases a claim so the next tick can retry', async () => {
    await kycRepository.claimKycReminder(userId);

    await kycRepository.releaseKycReminder(userId);

    expect(await isCandidate(userId)).toBe(true);
    expect(await kycRepository.claimKycReminder(userId)).toBe(true);
  });

  it('does not claim a user who is no longer approved', async () => {
    await kycRepository.updateUserKycStatus(userId, 'expired');

    expect(await kycRepository.claimKycReminder(userId)).toBe(false);
  });
});
