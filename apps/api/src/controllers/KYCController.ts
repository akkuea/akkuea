import type { KycDocument } from '@real-estate-defi/shared';
import { ApiError } from '../errors/ApiError';
import { kycRepository } from '../repositories/KYCRepository';
import { userRepository } from '../repositories/UserRepository';
import { storageService, StorageService } from '../services/StorageService';
import { NotificationService } from '../services/NotificationService';

const DOCUMENT_TYPE_MAP = {
  passport: 'passport' as const,
  id_card: 'national_id' as const,
  national_id: 'national_id' as const,
  proof_of_address: 'proof_of_address' as const,
  other: 'proof_of_address' as const, // map 'other' to proof_of_address
} satisfies Record<string, 'passport' | 'national_id' | 'proof_of_address'>;

type DocTypeApi = 'passport' | 'id_card' | 'proof_of_address' | 'other';

function toDbDocumentType(
  type: string,
):
  | 'passport'
  | 'national_id'
  | 'drivers_license'
  | 'proof_of_address'
  | 'bank_statement'
  | 'tax_document' {
  const mapped = DOCUMENT_TYPE_MAP[type as DocTypeApi];
  if (mapped) return mapped;
  if (['drivers_license', 'bank_statement', 'tax_document'].includes(type)) {
    return type as 'drivers_license' | 'bank_statement' | 'tax_document';
  }
  return 'proof_of_address';
}

function toKycDocumentForResponse(doc: {
  id: string;
  userId: string;
  type: string;
  fileName: string;
  fileUrl: string;
  status: string;
  rejectionReason: string | null;
  uploadedAt: Date;
  reviewedAt: Date | null;
}): KycDocument & { documentUrl: string } {
  return {
    id: doc.id,
    userId: doc.userId,
    type: doc.type as KycDocument['type'],
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    status: doc.status as KycDocument['status'],
    rejectionReason: doc.rejectionReason ?? undefined,
    uploadedAt: doc.uploadedAt.toISOString(),
    reviewedAt: doc.reviewedAt?.toISOString(),
    documentUrl: `/kyc/file/${doc.id}`,
  };
}

export class KYCController {
  static async getKYCStatus(userId: string): Promise<{
    status: 'pending' | 'verified' | 'rejected';
    documents: (KycDocument & { documentUrl: string })[];
  }> {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw ApiError.notFound('User not found');
      }

      const dbStatus = await kycRepository.getUserKycStatus(userId);
      const docs = await kycRepository.findByUserId(userId);

      const statusMap = {
        not_started: 'pending' as const,
        pending: 'pending' as const,
        approved: 'verified' as const,
        rejected: 'rejected' as const,
        expired: 'rejected' as const,
      };
      const status = dbStatus ? statusMap[dbStatus] : 'pending';

      const documents = docs.map((d) => toKycDocumentForResponse(d));
      return { status, documents };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw ApiError.internal(e instanceof Error ? e.message : 'Failed to fetch KYC status');
    }
  }

  /**
   * Upload a single KYC document (multipart). Replaces existing document of same type for the user (REQ duplicate upload).
   */
  static async uploadDocument(
    userId: string,
    documentType: string,
    file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> },
    storage: StorageService = storageService,
  ): Promise<{ documentId: string; submissionId: string }> {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw ApiError.notFound('User not found');
      }

      const typeCheck = StorageService.isAllowedFileType(file.name, file.type);
      if (!typeCheck.allowed) {
        throw ApiError.badRequest(typeCheck.error!);
      }

      const sizeCheck = StorageService.isAllowedFileSize(file.size);
      if (!sizeCheck.allowed) {
        throw ApiError.badRequest(sizeCheck.error!);
      }

      const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.pdf';
      const dbDocType = toDbDocumentType(documentType);

      const existing = await kycRepository.findByUserIdAndType(userId, dbDocType);
      let documentId: string;

      const buffer = Buffer.from(await file.arrayBuffer());

      if (existing) {
        await storage.deleteByRelativePath(existing.fileUrl);
        const stored = await storage.store(buffer, userId, ext, existing.id);
        await kycRepository.update(existing.id, {
          fileName: stored.storedFileName,
          fileUrl: stored.relativePath,
          status: 'pending',
          rejectionReason: null,
          reviewedAt: null,
        });
        documentId = existing.id;
      } else {
        const stored = await storage.store(buffer, userId, ext);
        const doc = await kycRepository.create({
          userId,
          type: dbDocType,
          fileName: stored.storedFileName,
          fileUrl: stored.relativePath,
          status: 'pending',
        });
        documentId = doc.id;
      }

      await kycRepository.updateUserKycStatus(userId, 'pending');

      return {
        documentId,
        submissionId: userId,
      };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw ApiError.internal(e instanceof Error ? e.message : 'Failed to upload document');
    }
  }

  static async submitKYC(_data: {
    userId: string;
    documents: {
      type: 'passport' | 'id_card' | 'proof_of_address' | 'other';
      documentUrl: string;
    }[];
  }): Promise<{ submissionId: string }> {
    const user = await userRepository.findById(_data.userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }
    const docs = await kycRepository.findByUserId(_data.userId);
    const submissionId = _data.userId;
    if (docs.length > 0) {
      await kycRepository.updateUserKycStatus(_data.userId, 'pending');
    }
    return { submissionId };
  }

  static async verifyDocument(
    documentId: string,
    data: { verified: boolean; notes?: string },
  ): Promise<{ success: boolean }> {
    try {
      const doc = await kycRepository.findById(documentId);
      if (!doc) {
        throw ApiError.notFound('Document not found');
      }

      const status = data.verified ? 'approved' : 'rejected';
      await kycRepository.updateStatus(documentId, status, data.notes);

      const allDocs = await kycRepository.findByUserId(doc.userId);
      const anyRejected = allDocs.some((d) => d.status === 'rejected');
      const allApproved = allDocs.every((d) => d.status === 'approved');

      // Initialize notification service
      const notificationService = new NotificationService();

      if (anyRejected) {
        await kycRepository.updateUserKycStatus(doc.userId, 'rejected');
        // Send verification rejected notification
        await notificationService.notifyVerificationRejected(
          doc.userId,
          data.notes ||
            'Your verification documents were rejected. Please resubmit with correct information.',
          'IN_APP',
        );
      } else if (allApproved) {
        await kycRepository.updateUserKycStatus(doc.userId, 'approved');
        // Send verification approved notification
        await notificationService.notifyVerificationApproved(doc.userId, 'IN_APP');
      }

      return { success: true };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw ApiError.internal(e instanceof Error ? e.message : 'Failed to verify document');
    }
  }

  static async getUserDocuments(
    userId: string,
  ): Promise<(KycDocument & { documentUrl: string })[]> {
    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw ApiError.notFound('User not found');
      }
      const docs = await kycRepository.findByUserId(userId);
      return docs.map((d) => toKycDocumentForResponse(d));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw ApiError.internal(e instanceof Error ? e.message : 'Failed to fetch user documents');
    }
  }

  /**
   * Serve document file by ID (REQ-009 URL for frontend).
   */
  static async getDocumentFile(
    documentId: string,
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    try {
      const doc = await kycRepository.findById(documentId);
      if (!doc) {
        throw ApiError.notFound('Document not found');
      }

      const buffer = await storageService.readByRelativePath(doc.fileUrl);
      const ext = doc.fileName.slice(doc.fileName.lastIndexOf('.')).toLowerCase();
      const contentType =
        ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';

      return { buffer, contentType, fileName: doc.fileName };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw ApiError.internal(e instanceof Error ? e.message : 'Failed to get document file');
    }
  }
}
