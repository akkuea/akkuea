import { Elysia } from 'elysia';
import { z } from 'zod';
import { KYCController } from '../controllers/KYCController';
import { rateLimit } from '../middleware';

// const DOCUMENT_TYPES = [
//   'passport',
//   'id_card',
//   'proof_of_address',
//   'other',
//   'national_id',
//   'drivers_license',
//   'bank_statement',
//   'tax_document',
// ] as const;

export const kycRoutes = new Elysia({
  prefix: '/kyc',
  tags: ['KYC'],
})

  /**
   * GET /kyc/status/:userId
   */
  .get(
    '/status/:userId',
    async ({ params: { userId }, set }) => {
      try {
        return await KYCController.getKYCStatus(userId);
      } catch (error) {
        console.error(error);
        set.status = 500;
        return { error: 'Failed to fetch KYC status' };
      }
    },
    {
      params: z.object({ userId: z.string() }),
      detail: {
        summary: 'Get KYC status',
      },
    },
  )

  /**
   * POST /kyc/upload (multipart)
   */
  .post(
    '/upload',
    async ({ request, set }) => {
      try {
        const formData = await request.formData();

        const file = formData.get('file') as File;
        const userId = formData.get('userId') as string;
        const documentType = formData.get('documentType') as string;

        if (!file || !userId || !documentType) {
          set.status = 400;
          return { error: 'Missing fields' };
        }

        return await KYCController.uploadDocument(userId, documentType, {
          name: file.name,
          type: file.type,
          size: file.size,
          arrayBuffer: () => file.arrayBuffer(),
        });
      } catch {
        set.status = 500;
        return { error: 'Upload failed' };
      }
    },
    {
      beforeHandle: rateLimit(),
      detail: {
        summary: 'Upload KYC document',
        description: 'Multipart form upload: file, userId, documentType',
      },
    },
  )

  /**
   * POST /kyc/submit
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .post('/submit', async ({ body }: any) => KYCController.submitKYC(body), {
    beforeHandle: rateLimit(),
    body: z.object({
      userId: z.string(),
      documents: z.array(
        z.object({
          type: z.string(),
          documentUrl: z.string(),
        }),
      ),
    }),
    detail: {
      summary: 'Submit KYC documents',
    },
  })

  /**
   * POST /kyc/verify/:documentId
   */
  .post(
    '/verify/:documentId',
    async ({ params: { documentId }, body }) => KYCController.verifyDocument(documentId, body),
    {
      params: z.object({ documentId: z.string() }),
      body: z.object({
        verified: z.boolean(),
        notes: z.string().optional(),
      }),
      detail: {
        summary: 'Verify KYC document',
      },
    },
  )

  /**
   * GET /kyc/documents/:userId
   */
  .get(
    '/documents/:userId',
    async ({ params: { userId } }) => KYCController.getUserDocuments(userId),
    {
      params: z.object({ userId: z.string() }),
      detail: {
        summary: 'Get user KYC documents',
      },
    },
  );
