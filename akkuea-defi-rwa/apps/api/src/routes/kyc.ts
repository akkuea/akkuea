import { Elysia } from 'elysia';
import { KYCController } from '../controllers/KYCController';

export const kycRoutes = new Elysia({ prefix: '/kyc' })
  .get('/status/:userId', ({ params: { userId } }) => KYCController.getKYCStatus(userId))
  .post('/submit', ({ body }) => KYCController.submitKYC(body as { userId: string; documents: { type: 'passport' | 'id_card' | 'proof_of_address' | 'other'; documentUrl: string; }[] }))
  .post('/verify/:documentId', ({ params: { documentId }, body }) =>
    KYCController.verifyDocument(documentId, body as { verified: boolean; notes?: string }),
  )
  .get('/documents/:userId', ({ params: { userId } }) => KYCController.getUserDocuments(userId));
