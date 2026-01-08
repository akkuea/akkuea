import { Elysia } from 'elysia';
import { KYCController } from '../controllers/KYCController';

export const kycRoutes = new Elysia({ prefix: '/kyc' })
  .get('/status/:userId', ({ params: { userId } }) => KYCController.getKYCStatus(userId))
  .post('/submit', ({ body }) => KYCController.submitKYC(body))
  .post('/verify/:documentId', ({ params: { documentId }, body }) =>
    KYCController.verifyDocument(documentId, body),
  )
  .get('/documents/:userId', ({ params: { userId } }) => KYCController.getUserDocuments(userId));
