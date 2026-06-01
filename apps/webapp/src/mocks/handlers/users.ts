import { http, HttpResponse } from "msw";
import { mockUser, mockKycDocuments, mockPortfolio } from "../fixtures/users";
import { mockTransactions } from "../fixtures/transactions";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const userHandlers = [
  /**
   * GET /users/:walletAddress - get user by wallet
   */
  http.get(`${API_BASE}/users/:walletAddress`, ({ params }) => {
    // Return mock user regardless of address for demo purposes
    return HttpResponse.json({
      ...mockUser,
      walletAddress: params.walletAddress as string,
    });
  }),

  /**
   * POST /users/:address/wallet - connect wallet / auth
   */
  http.post(`${API_BASE}/users/:address/wallet`, ({ params }) => {
    return HttpResponse.json({
      token: "mock_jwt_token_" + Math.random().toString(36).substring(2, 18),
      user: {
        ...mockUser,
        walletAddress: params.address as string,
      },
    });
  }),

  /**
   * GET /users/:address/transactions
   */
  http.get(`${API_BASE}/users/:address/transactions`, () => {
    return HttpResponse.json(mockTransactions);
  }),

  /**
   * GET /users/:address/portfolio
   */
  http.get(`${API_BASE}/users/:address/portfolio`, () => {
    return HttpResponse.json(mockPortfolio);
  }),

  /**
   * GET /kyc/status/:userId
   */
  http.get(`${API_BASE}/kyc/status/:userId`, () => {
    return HttpResponse.json({
      status: mockUser.kycStatus,
      tier: mockUser.kycTier,
    });
  }),

  /**
   * POST /kyc/submit
   */
  http.post(`${API_BASE}/kyc/submit`, async () => {
    // Simulate async KYC submission
    await new Promise((resolve) => setTimeout(resolve, 300));
    return HttpResponse.json({
      status: "pending",
      message:
        "KYC documents submitted successfully. Review typically takes 1-3 business days.",
    });
  }),

  /**
   * GET /kyc/documents/:userId
   */
  http.get(`${API_BASE}/kyc/documents/:userId`, () => {
    return HttpResponse.json(mockKycDocuments);
  }),
];
