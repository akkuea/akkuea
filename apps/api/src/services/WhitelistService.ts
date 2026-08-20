import { eq } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { stellarService } from './StellarService';

export class WhitelistService {
  /**
   * Approves a whitelist request in the database and submits the transaction to the C6-001 contract.
   */
  async approveRequest(requestId: string): Promise<string> {
    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new Error('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw new Error('Request is already approved');
    }

    const contractId = process.env.WHITELIST_CONTRACT_ID;
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;

    if (!contractId || !adminPublicKey || !adminSecret) {
      throw new Error('Whitelist contract or admin credentials not configured');
    }

    // Call the C6-001 pilot-whitelist contract's `approve(admin, address)` function.
    // Contract source: apps/contracts/contracts/pilot-whitelist/src/lib.rs
    // Signature: pub fn approve(env: Env, admin: Address, address: Address)
    //
    // Two arguments are required: the admin address (for on-chain auth) and the
    // investor wallet address to whitelist.
    //
    // NOTE: StellarService's typed-client switch has a `case 'approve'` that routes
    // to RealEstateTokenContractClient (the SEP-41 token allowance) — a completely
    // different function. That typed path will fail for an unknown contract ID and
    // fall through to the legacy XDR builder, which is the correct path here.
    const txHash = await stellarService.callAndSubmitContract(
      contractId,
      'approve',
      [adminPublicKey, request.walletAddress],
      adminSecret,
      adminPublicKey,
    );

    // Update database status
    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    return txHash;
  }

  async rejectRequest(requestId: string, reason: string): Promise<void> {
    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw new Error('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw new Error('Cannot reject an already approved request');
    }

    await db
      .update(pilotWhitelistRequests)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId));
  }
}

export const whitelistService = new WhitelistService();
