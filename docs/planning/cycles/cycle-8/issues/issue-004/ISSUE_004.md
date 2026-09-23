# Production-Grade Whitelist Identity Evidence: Document Upload, Durable Encrypted Storage, and Data Retention

| Attribute       | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Issue ID        | C8-004                                                                       |
| Area            | API                                                                          |
| Difficulty      | High                                                                         |
| Labels          | backend, api, frontend, kyc, security, database, high                        |
| Dependencies    | C6-008, C7-005                                                               |
| Estimated Lines | 4,000-5,000 (storage abstraction, schema, encryption, jobs, UI, tests, docs) |

## Context

The product brief describes investor onboarding as "manual identity review gating a simple on-chain approved/not-approved contract." Four gaps sit on the same data path today and share one theme: the identity data behind the whitelist is not production-grade.

- **There is nothing to review.** `pilot_whitelist_requests` (`apps/api/src/db/schema/pilotWhitelist.ts`) stores only `walletAddress`, `fullName`, `idType`, and `idReference`, all plain text. `WhitelistOnboardingForm.tsx` collects exactly those three text fields, with no file input. The operator's `WhitelistReviewQueue` approves or rejects based on a typed-in ID number with no document behind it. That is data entry, not identity review.
- **Uploaded files would not survive a redeploy.** The only file storage in the API, `StorageService` (`apps/api/src/services/StorageService.ts`), writes to the local filesystem (`KYC_UPLOAD_DIR`, default `./uploads/kyc`, line 34). Container deploys lose those files, and a second API instance cannot read them. The existing general KYC flow (`KYCController.ts`) already depends on this.
- **Government-ID PII is plaintext at rest.** `full_name` and `id_reference` are plain `varchar` columns, and nothing in `WhitelistService.ts` or the schema encrypts them.
- **No retention or deletion.** There is no retention period for rejected or withdrawn applicants, no deletion path, and no written policy.

## What Needs to Be Done

- **Storage abstraction:** refactor `StorageService` behind a provider interface with the current local-filesystem implementation (kept for development and tests) and an S3-compatible implementation (S3, R2, MinIO, and similar). Add encryption at rest for stored objects and short-lived signed URLs or streamed, authorized reads for retrieval. Migrate the existing KYC callers without changing their behavior. Record the provider choice in `docs/strategy/decision-log.md`.
- **Document upload in onboarding:** a document-upload step in `WhitelistOnboardingForm` with file-type and size limits (reuse the existing magic-byte validation tested in `StorageService.magicbytes.test.ts`), a schema migration adding the attachment reference to `pilot_whitelist_requests`, and upload handling on `/pilot/whitelist/request` that respects the rate limiting added in C7-005.
- **Review UI:** an authorized, time-limited document preview in `WhitelistReviewQueue` for operators only.
- **Field-level encryption** for `full_name` and `id_reference` (envelope encryption with a key from configuration or a KMS), including a migration that encrypts existing rows, and key-rotation guidance.
- **Retention and deletion:** a scheduled job, following the self-scheduling pattern in `apps/api/src/workers/kycExpiryJob.ts`, that purges documents and anonymizes PII after a defined retention window for rejected requests. Add an operator-authorized deletion endpoint for data-subject requests. Approved requests keep only what the on-chain approval needs to stay auditable.
- **Documentation:** a data-handling document under `docs/operations/` stating what is collected, where it lives, how it is encrypted, who can read it, and when it is deleted. Add every new variable to `docs/deployment/environment-variables.md` and to the boot-time validation in `apps/shared/src/env/schemas.ts`.

## Acceptance Criteria

- An investor can attach an ID document during onboarding, and the operator can view it from the review queue through an authorized, expiring URL or stream. End-to-end tests cover both.
- `StorageService` works against both the local and S3-compatible providers behind one interface. The S3 path is tested against a local S3-compatible server (for example MinIO in CI or a documented mock), and existing KYC upload tests pass unchanged.
- Stored documents are encrypted at rest, and a test reads the raw stored object to confirm it is not plaintext.
- `full_name` and `id_reference` are encrypted in the database. A test reads the raw row to confirm it, and a migration encrypts pre-existing rows.
- The retention job purges or anonymizes expired rejected requests and their documents. A test covers it, and the deletion endpoint is operator-only.
- Non-operators cannot retrieve any document or decrypted PII. Negative tests prove this.
- The data-handling document exists, and every new environment variable is documented and validated at boot.
- All new UI follows `docs/design-system/`, has Storybook stories, and ships English and Spanish strings.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is real government identity data from real investors. The bar is not compliance with a particular law, since the pilot's legal instrument is still open (Known Risk #2). The bar is that nobody with database access, a copied backup, or a leaked bucket listing can read an investor's ID. Keep scope minimum-defensible, as the brief requires: this is not a general-purpose KYC engine, and it must not reuse or expand the older general KYC engine the brief places out of scope.
