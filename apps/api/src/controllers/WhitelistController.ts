import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { whitelistService } from '../services/WhitelistService';
import { eq } from 'drizzle-orm';

export class WhitelistController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async request(ctx: any) {
    const { walletAddress, fullName, idType, idReference } = ctx.body;

    // Check if a request already exists
    const existing = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.walletAddress, walletAddress),
    });

    if (existing) {
      if (existing.status === 'pending') {
        throw new Error('A whitelist request is already pending for this address');
      }
      if (existing.status === 'approved') {
        throw new Error('This address is already whitelisted');
      }
      // If previously rejected, allow re-submission: delete the old record
      // so the investor gets a clean slate after fixing whatever was wrong.
      await db
        .delete(pilotWhitelistRequests)
        .where(eq(pilotWhitelistRequests.walletAddress, walletAddress));
    }

    const inserted = await db
      .insert(pilotWhitelistRequests)
      .values({
        walletAddress,
        fullName,
        idType,
        idReference,
        status: 'pending',
      })
      .returning();

    return { success: true, data: inserted[0] };
  }

  static async pending() {
    // In a real app, verify ctx.user is an admin
    const requests = await db.query.pilotWhitelistRequests.findMany({
      where: eq(pilotWhitelistRequests.status, 'pending'),
      orderBy: (requests, { asc }) => [asc(requests.createdAt)],
    });

    return { success: true, data: requests };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async review(ctx: any) {
    const { id } = ctx.params;
    const { action, reason } = ctx.body;

    if (action === 'approve') {
      const txHash = await whitelistService.approveRequest(id);
      return { success: true, txHash };
    } else if (action === 'reject') {
      if (!reason) {
        throw new Error('Rejection reason is required');
      }
      await whitelistService.rejectRequest(id, reason);
      return { success: true };
    } else {
      throw new Error('Invalid action');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async status(ctx: any) {
    const { walletAddress } = ctx.params;
    const existing = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.walletAddress, walletAddress),
    });

    if (!existing) {
      return { success: true, status: 'none' };
    }

    return {
      success: true,
      status: existing.status,
      rejectionReason: existing.rejectionReason,
    };
  }
}
