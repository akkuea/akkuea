/**
 * KYC schema - re-exports from users for discoverability.
 * Table definitions live in users.ts due to relations.
 */
export {
  kycDocumentTypeEnum,
  kycDocumentStatusEnum,
  kycDocuments,
  kycDocumentsRelations,
  type KycDocument,
  type NewKycDocument,
} from './users';
