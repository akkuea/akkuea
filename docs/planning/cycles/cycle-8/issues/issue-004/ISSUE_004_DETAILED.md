# C8-004: Production-Grade Whitelist Identity Evidence: Document Upload, Durable Encrypted Storage, and Data Retention

## Issue Metadata

| Attribute       | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Issue ID        | C8-004                                                                       |
| Area            | API                                                                          |
| Difficulty      | High                                                                         |
| Labels          | backend, api, frontend, kyc, security, database, high                        |
| Dependencies    | C6-008, C7-005                                                               |
| Estimated Lines | 4,000-5,000 (storage abstraction, schema, encryption, jobs, UI, tests, docs) |

**Description**

Turn the pilot whitelist's identity data into something an operator can actually review and that survives redeploys, database leaks, and retention obligations. The full context is in `ISSUE_004.md`.

**Requirements and context**

- `apps/api/src/services/StorageService.ts`: class at line 29, local base directory at line 34, and methods `store` (115), `readByRelativePath` (147), `deleteByRelativePath` (166), and `getBaseDir` (182). The only caller is `apps/api/src/controllers/KYCController.ts`. Magic-byte validation is covered by `apps/api/src/__tests__/StorageService.magicbytes.test.ts` and must be kept.
- `apps/api/src/db/schema/pilotWhitelist.ts`: `pilot_whitelist_requests` has plain `varchar` `full_name` and `id_reference`, and no attachment column. Migrations live in `apps/api/src/db/migrations/` (latest `004_create_notification_dlq.sql`). Follow the existing numbering.
- `apps/api/src/services/WhitelistService.ts`: `approveRequest` (line 11) and `rejectRequest` (line 51). The request path goes through `WhitelistController` and `routes/whitelist.ts` (Elysia, with C7-005's `rateLimit` middleware at line 6).
- `apps/webapp/src/components/pilot/WhitelistOnboardingForm.tsx:41-45`: form state with `fullName`, `idType`, and `idReference`. `WhitelistReviewQueue.tsx` is the operator surface.
- Scheduled job pattern: `apps/api/src/workers/kycExpiryJob.ts` (class at line 38, self-scheduling via `scheduleNext` at line 154).
- Environment: add the new variables (provider, bucket, endpoint, credentials, and the data-encryption key or KMS key ID) to `apps/shared/src/env/schemas.ts` and `docs/deployment/environment-variables.md`. Never commit real values.

Example: provider interface:

```ts
export interface StorageProvider {
  put(key: string, data: Buffer, opts: { contentType: string }): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Short-lived, operator-only read URL. Local provider may return a streamed route instead. */
  signedReadUrl(key: string, ttlSeconds: number): Promise<string>;
}

// Envelope encryption for stored objects and PII fields.
const dek = randomBytes(32);
const { ciphertext, iv, tag } = aes256gcmEncrypt(dek, plaintext);
const wrappedDek = await keyProvider.wrap(dek); // config key or KMS
```

**Suggested execution**

1. `git checkout -b feature/pilot-identity-evidence`
2. Record the storage provider and key-management choice in `docs/strategy/decision-log.md`.
3. Extract a `StorageProvider` interface, move the current code into `LocalStorageProvider`, and keep `KYCController` behavior identical (existing tests must pass unchanged).
4. Add `S3CompatibleStorageProvider` with encryption at rest, and test it against MinIO in CI or a documented local mock.
5. Add the migration: attachment key and content type on `pilot_whitelist_requests`, plus encrypted-column storage for `full_name` and `id_reference`, with a data migration for existing rows.
6. Update the request route and controller to accept the document (multipart), validate type, size, and magic bytes, and store it.
7. Add an operator-only document read route (signed URL or stream), and a preview in `WhitelistReviewQueue`.
8. Add an upload step to `WhitelistOnboardingForm` with progress, error, and retry states.
9. Add a `WhitelistRetentionJob` following `kycExpiryJob.ts`, and an operator-only deletion endpoint.
10. Write `docs/operations/pilot-data-handling.md`.

**Test and commit**

- [ ] Provider contract tests run against both providers
- [ ] Raw stored object is not plaintext, and raw database row values for `full_name` and `id_reference` are not plaintext
- [ ] Data migration encrypts pre-existing rows and is idempotent
- [ ] Upload validation rejects wrong type, oversize, and spoofed magic bytes
- [ ] Non-operator access to documents and decrypted fields is denied (negative tests)
- [ ] Retention job purges and anonymizes only eligible rows, and the deletion endpoint is operator-only
- [ ] Webapp component tests and stories for the upload step and the review preview, with English and Spanish strings
- [ ] All five CI workflows green

Example commit:
`git commit -m "feat(api): add durable encrypted storage and document upload for pilot whitelist"`

**Guidelines**

- Keep scope minimum-defensible. Do not extend the older general KYC engine the product brief places out of scope.
- Never log PII or document contents, and check existing logger calls in the touched paths.
- Never commit an actual `.env` file or a real credential.
- Follow `docs/design-system/` for the onboarding and review UI changes.
