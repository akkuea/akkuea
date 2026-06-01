import type { User, KycDocument } from "@real-estate-defi/shared";

export const MOCK_WALLET_ADDRESS =
  "GDEMOUSER1234567890AKKUEA00000000000000000000000000000000";

export const mockKycDocuments: KycDocument[] = [
  {
    id: "kyc-doc-001-uuid-0000-000000000001",
    userId: "usr-001-uuid-0000-0000-000000000001",
    type: "passport",
    fileName: "passport_scan.pdf",
    fileUrl: "https://example.com/kyc/passport_scan.pdf",
    status: "approved",
    uploadedAt: "2024-03-10T12:00:00.000Z",
    reviewedAt: "2024-03-12T09:00:00.000Z",
  },
  {
    id: "kyc-doc-002-uuid-0000-000000000002",
    userId: "usr-001-uuid-0000-0000-000000000001",
    type: "proof_of_address",
    fileName: "utility_bill_q1_2024.pdf",
    fileUrl: "https://example.com/kyc/utility_bill.pdf",
    status: "approved",
    uploadedAt: "2024-03-10T12:05:00.000Z",
    reviewedAt: "2024-03-12T09:15:00.000Z",
  },
  {
    id: "kyc-doc-003-uuid-0000-000000000003",
    userId: "usr-001-uuid-0000-0000-000000000001",
    type: "bank_statement",
    fileName: "bank_statement_feb_2024.pdf",
    fileUrl: "https://example.com/kyc/bank_statement.pdf",
    status: "pending",
    uploadedAt: "2024-05-01T08:30:00.000Z",
  },
];

export const mockUser: User = {
  id: "usr-001-uuid-0000-0000-000000000001",
  walletAddress: MOCK_WALLET_ADDRESS,
  email: "alex.okonkwo@example.com",
  displayName: "Alex Okonkwo",
  kycStatus: "approved",
  kycTier: "verified",
  kycDocuments: mockKycDocuments,
  createdAt: "2024-01-05T10:00:00.000Z",
  updatedAt: "2024-05-01T08:35:00.000Z",
  lastLoginAt: "2026-05-26T14:22:00.000Z",
};

export const mockPortfolio = {
  properties: [
    { propertyId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", shares: 150 },
    { propertyId: "d4e5f6a7-b8c9-0123-defa-234567890123", shares: 75 },
    { propertyId: "b2c3d4e5-f6a7-8901-bcde-f12345678901", shares: 40 },
  ],
  deposits: [
    { poolId: "pool-0001-uuid-0000-0000-000000000001", amount: 25000 },
    { poolId: "pool-0002-uuid-0000-0000-000000000002", amount: 50000 },
  ],
  borrows: [{ poolId: "pool-0001-uuid-0000-0000-000000000001", amount: 12000 }],
};
