import { Elysia } from 'elysia';
import { KYCController } from '../controllers/KYCController';
import { ApiError } from '../errors/ApiError';
import { rateLimit, authPlugin } from '../middleware';

const DOCUMENT_TYPES = [
  'passport',
  'id_card',
  'proof_of_address',
  'other',
  'national_id',
  'drivers_license',
  'bank_statement',
  'tax_document',
] as const;

function isApiErrorLike(e: unknown): e is { statusCode: number; code: string; message: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'statusCode' in e &&
    'code' in e &&
    typeof (e as { statusCode: unknown }).statusCode === 'number' &&
    typeof (e as { code: unknown }).code === 'string'
  );
}

/** Accepts Elysia's set object; we only assign numeric status codes. */
type SetStatus = { status?: number | string };

function handleKycError(error: unknown, set: SetStatus) {
  if (error instanceof ApiError || isApiErrorLike(error)) {
    const err = error as { statusCode: number; code: string; message: string };
    set.status = err.statusCode;
    return { success: false, error: err.code, message: err.message };
  }
  set.status = 500;
  return {
    success: false,
    error: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };
}

// User-scoped routes (require JWT + ownership)
const userScoped = new Elysia()
  .use(authPlugin)
  .get('/status/:userId', async ({ params: { userId }, set, getAuthenticatedUser }) => {
    try {
      const status = await KYCController.getKYCStatus(userId);

      const { id } = await getAuthenticatedUser();
      if (id !== userId) throw new ApiError(403, 'FORBIDDEN', 'Access denied');
      return status;
    } catch (error) {
      return handleKycError(error, set);
    }
  })
  .post(
    '/submit',
    async ({ body, set, getAuthenticatedUser }) => {
      try {
        const { id } = await getAuthenticatedUser();
        const payload = body as {
          userId: string;
          documents: {
            type: 'passport' | 'id_card' | 'proof_of_address' | 'other';
            documentUrl: string;
          }[];
        };
        if (payload.userId !== id) throw new ApiError(403, 'FORBIDDEN', 'Access denied');
        return await KYCController.submitKYC(payload);
      } catch (error) {
        return handleKycError(error, set);
      }
    },
    { beforeHandle: [rateLimit()] },
  )
  .get('/documents/:userId', async ({ params: { userId }, set, getAuthenticatedUser }) => {
    try {
      const { id } = await getAuthenticatedUser();
      if (id !== userId) throw new ApiError(403, 'FORBIDDEN', 'Access denied');
      return await KYCController.getUserDocuments(userId);
    } catch (error) {
      return handleKycError(error, set);
    }
  });

// Unauthenticated routes (require JWT but no ownership)
const jwtScoped = new Elysia()
  .use(authPlugin)
  .post(
    '/upload',
    async ({ request, set }) => {
      try {
        const contentType = request.headers.get('content-type') ?? '';
        if (!contentType.includes('multipart/form-data')) {
          set.status = 400;
          return {
            success: false,
            error: 'BAD_REQUEST',
            message: 'Content-Type must be multipart/form-data',
          };
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const userId = formData.get('userId');
        const documentType = formData.get('documentType');

        if (!userId || typeof userId !== 'string') {
          set.status = 400;
          return { success: false, error: 'BAD_REQUEST', message: 'userId is required' };
        }
        if (!documentType || typeof documentType !== 'string') {
          set.status = 400;
          return { success: false, error: 'BAD_REQUEST', message: 'documentType is required' };
        }
        if (!DOCUMENT_TYPES.includes(documentType as (typeof DOCUMENT_TYPES)[number])) {
          set.status = 400;
          return {
            success: false,
            error: 'BAD_REQUEST',
            message:
              'documentType must be one of: passport, id_card, proof_of_address, other, national_id, drivers_license, bank_statement, tax_document',
          };
        }

        if (!file || !(file instanceof File)) {
          set.status = 400;
          return { success: false, error: 'BAD_REQUEST', message: 'file is required' };
        }

        const fileItem = file as File;
        const result = await KYCController.uploadDocument(userId, documentType, {
          name: fileItem.name,
          type: fileItem.type,
          size: fileItem.size,
          arrayBuffer: () => fileItem.arrayBuffer(),
        });

        set.status = 200;
        return { documentId: result.documentId, submissionId: result.submissionId };
      } catch (error) {
        return handleKycError(error, set);
      }
    },
    { beforeHandle: [rateLimit()] },
  )
  .get('/file/:documentId', async ({ params: { documentId }, set }) => {
    try {
      const { buffer, contentType, fileName } = await KYCController.getDocumentFile(documentId);
      set.headers['Content-Type'] = contentType;
      set.headers['Content-Disposition'] = `inline; filename="${fileName}"`;
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${fileName}"`,
        },
      });
    } catch (error) {
      const body = handleKycError(error, set);
      return new Response(JSON.stringify(body), {
        status: typeof set.status === 'number' ? set.status : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });
// Internal-only routes (require INTERNAL_API_KEY header and reject user JWTs)
const internalScoped = new Elysia().post(
  '/verify/:documentId',
  async ({ params: { documentId }, body, set, headers }) => {
    try {
      // Reject requests bearing a user JWT
      if (headers['authorization']) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Internal key required');
      }

      const key =
        headers['internal-api-key'] || headers['x-internal-api-key'] || headers['internal_api_key'];
      const expected = process.env.INTERNAL_API_KEY;
      if (!expected) {
        console.error('INTERNAL_API_KEY is not configured for /kyc/verify');
        throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal key configuration missing');
      }
      if (key !== expected) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Internal key required');
      }

      return await KYCController.verifyDocument(
        documentId,
        body as { verified: boolean; notes?: string },
      );
    } catch (error) {
      return handleKycError(error, set);
    }
  },
);

export const kycRoutes = new Elysia({ prefix: '/kyc' })
  .use(userScoped)
  .use(jwtScoped)
  .use(internalScoped);
