import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { whitelistService } from '../services/WhitelistService';
import {
  reviewTurnaroundService,
  type ReviewMetricsResult,
} from '../services/ReviewTurnaroundService';
import type { MetricsWindowQuery } from '../services/reviewTurnaround';
import { eq } from 'drizzle-orm';
import { StorageService } from '../services/StorageService';
import { encryptPlaintextField } from '../services/FieldEncryption';
import { ApiError } from '../errors/ApiError';

export class WhitelistController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async request(ctx: any) {
    const body = ctx.body;
    const walletAddress = body.walletAddress;
    const fullName = body.fullName;
    const idType = body.idType;
    const idReference = body.idReference;
    const documentFile = body.document;

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

    // Handle document upload if provided
    let documentUrl: string | undefined;
    let documentEncryptionKey: string | undefined;

    if (documentFile) {
      const buffer = Buffer.from(await documentFile.arrayBuffer());
      const extension = documentFile.name.includes('.')
        ? documentFile.name.slice(documentFile.name.lastIndexOf('.'))
        : '.pdf';

      const stored = await StorageService.store(buffer, walletAddress, extension);
      documentUrl = stored.relativePath;
    }

    // Encrypt PII fields
    const fullNameEncrypted = encryptPlaintextField(fullName);
    const idReferenceEncrypted = encryptPlaintextField(idReference);

    const inserted = await db
      .insert(pilotWhitelistRequests)
      .values({
        walletAddress,
        fullName,
        idType,
        idReference,
        fullNameEncrypted,
        idReferenceEncrypted,
        documentUrl,
        documentEncryptionKey,
        status: 'pending',
      })
      .returning();

    return { success: true, data: inserted[0] };
  }

  static async getDocumentUrl(requestId: string): Promise<{ signedUrl: string; fileName: string }> {
    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw ApiError.notFound('Whitelist request not found');
    }

    if (!request.documentUrl) {
      throw ApiError.notFound('No document attached to this request');
    }

    const signedUrl = await StorageService.getSignedReadUrl(request.documentUrl, 3600); // 1 hour

    const fileName = request.documentUrl.split('/').pop() ?? 'document';

    return { signedUrl, fileName };
  }

  static async pending() {
    // In a real app, verify ctx.user is an admin
    const requests = await db.query.pilotWhitelistRequests.findMany({
      where: eq(pilotWhitelistRequests.status, 'pending'),
      orderBy: (requests, { asc }) => [asc(requests.createdAt)],
    });

    return { success: true, data: requests };
  }

  static async metrics(query: MetricsWindowQuery = {}): Promise<{
    success: true;
    data: ReviewMetricsResult;
  }> {
    const data = await reviewTurnaroundService.getMetrics(query);
    return { success: true, data };
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

  // Operator-only: delete/anonymize request (data subject request or manual cleanup)
  // Only allowed for rejected requests; approved requests are kept for auditability.
  static async deleteRequest(requestId: string): Promise<{ success: boolean }> {
    const request = await db.query.pilotWhitelistRequests.findFirst({
      where: eq(pilotWhitelistRequests.id, requestId),
    });

    if (!request) {
      throw ApiError.notFound('Whitelist request not found');
    }

    if (request.status === 'approved') {
      throw ApiError.badRequest('Cannot delete approved whitelist request (audit trail required)');
    }

    // Delete document from storage if exists
    if (request.documentUrl) {
      await StorageService.deleteByRelativePath(request.documentUrl);
    }

    // Anonymize PII fields
    await db
      .update(pilotWhitelistRequests)
      .set({
        fullName: '[REDACTED]',
        idReference: '[REDACTED]',
        fullNameEncrypted: null,
        idReferenceEncrypted: null,
        documentUrl: null,
        documentEncryptionKey: null,
        updatedAt: new Date(),
      })
      .where(eq(pilotWhitelistRequests.id, requestId));

    return { success: true };
  }
}
