import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { Elysia } from 'elysia';
import jwt from 'jsonwebtoken';
import { KYCController } from '../controllers/KYCController';
import { errorHandler } from '../middleware/errorHandler';
import { kycRoutes } from '../routes/kyc';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';
const USER_A = '00000000-0000-0000-0000-000000000001';
const USER_B = '00000000-0000-0000-0000-000000000002';

describe('KYC document route authorization', () => {
  const app = new Elysia().use(errorHandler).use(kycRoutes);
  let getStatus: ReturnType<typeof spyOn>;
  let getOwner: ReturnType<typeof spyOn>;
  let getFile: ReturnType<typeof spyOn>;
  let upload: ReturnType<typeof spyOn>;
  let verify: ReturnType<typeof spyOn>;

  const tokenFor = (id: string) => jwt.sign({ id, walletAddress: `wallet-${id}` }, JWT_SECRET);
  const auth = (id = USER_A) => ({ Authorization: `Bearer ${tokenFor(id)}` });

  beforeEach(() => {
    getStatus = spyOn(KYCController, 'getKYCStatus').mockResolvedValue({
      status: 'pending',
      documents: [],
    });
    getOwner = spyOn(KYCController, 'getDocumentOwnerId').mockResolvedValue(USER_A);
    getFile = spyOn(KYCController, 'getDocumentFile').mockResolvedValue({
      buffer: Buffer.from('document'),
      contentType: 'application/pdf',
      fileName: 'document.pdf',
    });
    upload = spyOn(KYCController, 'uploadDocument').mockResolvedValue({
      documentId: 'doc-1',
      submissionId: USER_A,
    });
    verify = spyOn(KYCController, 'verifyDocument').mockResolvedValue({ success: true });
    process.env.INTERNAL_API_KEY = 'test-internal-key';
    delete process.env.OPERATIONS_BACKEND_CREDENTIAL;
  });

  afterEach(() => {
    getStatus.mockRestore();
    getOwner.mockRestore();
    getFile.mockRestore();
    upload.mockRestore();
    verify.mockRestore();
    delete process.env.INTERNAL_API_KEY;
  });

  test('requires authentication for status and checks ownership before reading', async () => {
    const unauthenticated = await app.handle(new Request(`http://localhost/kyc/status/${USER_A}`));
    expect(unauthenticated.status).toBe(401);
    expect(getStatus).not.toHaveBeenCalled();

    const forbidden = await app.handle(
      new Request(`http://localhost/kyc/status/${USER_B}`, { headers: auth(USER_A) }),
    );
    expect(forbidden.status).toBe(403);
    expect(getStatus).not.toHaveBeenCalled();

    const owner = await app.handle(
      new Request(`http://localhost/kyc/status/${USER_A}`, { headers: auth(USER_A) }),
    );
    expect(owner.status).toBe(200);
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  test('derives upload owner from the session and rejects cross-user form ids', async () => {
    const unauthenticated = await app.handle(
      new Request('http://localhost/kyc/upload', { method: 'POST' }),
    );
    expect(unauthenticated.status).toBe(401);

    const form = new FormData();
    form.set('userId', USER_B);
    form.set('documentType', 'passport');
    form.set('file', new File(['document'], 'passport.pdf', { type: 'application/pdf' }));
    const forbidden = await app.handle(
      new Request('http://localhost/kyc/upload', {
        method: 'POST',
        headers: auth(USER_A),
        body: form,
      }),
    );
    expect(forbidden.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();

    form.set('userId', USER_A);
    const owner = await app.handle(
      new Request('http://localhost/kyc/upload', {
        method: 'POST',
        headers: auth(USER_A),
        body: form,
      }),
    );
    expect(owner.status).toBe(200);
    expect(upload.mock.calls[0]?.[0]).toBe(USER_A);
  });

  test('only serves a file to its owner or an internal operator', async () => {
    const unauthenticated = await app.handle(new Request('http://localhost/kyc/file/doc-1'));
    expect(unauthenticated.status).toBe(401);
    expect(getFile).not.toHaveBeenCalled();

    getOwner.mockResolvedValueOnce(USER_B);
    const forbidden = await app.handle(
      new Request('http://localhost/kyc/file/doc-1', { headers: auth(USER_A) }),
    );
    expect(forbidden.status).toBe(403);
    expect(getFile).not.toHaveBeenCalled();

    const owner = await app.handle(
      new Request('http://localhost/kyc/file/doc-1', { headers: auth(USER_A) }),
    );
    expect(owner.status).toBe(200);
    expect(getFile).toHaveBeenCalledTimes(1);
  });

  test('verify accepts only x-internal-api-key', async () => {
    const legacy = await app.handle(
      new Request('http://localhost/kyc/verify/doc-1', {
        method: 'POST',
        headers: { 'internal-api-key': 'test-internal-key', 'content-type': 'application/json' },
        body: JSON.stringify({ verified: true }),
      }),
    );
    expect(legacy.status).toBe(401);
    expect(verify).not.toHaveBeenCalled();

    const accepted = await app.handle(
      new Request('http://localhost/kyc/verify/doc-1', {
        method: 'POST',
        headers: { 'x-internal-api-key': 'test-internal-key', 'content-type': 'application/json' },
        body: JSON.stringify({ verified: true }),
      }),
    );
    expect(accepted.status).toBe(200);
  });

  test('does not return internal exception details', async () => {
    getStatus.mockRejectedValueOnce(new Error('database password leaked'));
    const response = await app.handle(
      new Request(`http://localhost/kyc/status/${USER_A}`, { headers: auth(USER_A) }),
    );
    const body = await response.text();
    expect(response.status).toBe(500);
    expect(body).not.toContain('database password leaked');
  });
});
