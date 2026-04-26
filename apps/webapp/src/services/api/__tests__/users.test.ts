import { describe, it, expect, beforeEach, mock } from "bun:test";
import { userApi } from "../users";
import { setupMockFetch, wrapFetchMock } from "./helpers";
import type { KycDocument, Transaction, User } from "@real-estate-defi/shared";
import {
  VALID_STELLAR_ADDRESS,
  VALID_UUID,
  createUser,
  createTransaction,
  createKycDocument,
} from "@real-estate-defi/shared";

describe("User API", () => {
  beforeEach(() => {
    global.fetch = wrapFetchMock(
      mock(() => {
        throw new Error("fetch not mocked");
      }),
    );
  });

  describe("getByWallet", () => {
    it("fetches user by wallet address", async () => {
      const mockUser = createUser({ kycStatus: "pending", kycTier: "none" });

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockUser,
      });
      global.fetch = fetchMock;

      const result = await userApi.getByWallet(VALID_STELLAR_ADDRESS);

      expect(result).toEqual(mockUser);
      expect(calls[0].url).toBe(
        `http://localhost:3001/users/${VALID_STELLAR_ADDRESS}`,
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("connectWallet", () => {
    it("connects wallet and returns token", async () => {
      const connectPayload = {
        signature: "0xsig123456",
        message: "Connect wallet message",
      };

      const mockResponse: { token: string; user: User } = {
        token: "auth-token-123",
        user: createUser({ kycStatus: "pending", kycTier: "none" }),
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await userApi.connectWallet(
        VALID_STELLAR_ADDRESS,
        connectPayload,
      );

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe(
        `http://localhost:3001/users/${VALID_STELLAR_ADDRESS}/wallet`,
      );
      expect(calls[0].options.method).toBe("POST");
      expect(JSON.parse(calls[0].options.body as string)).toEqual(
        connectPayload,
      );
    });
  });

  describe("getTransactions", () => {
    it("fetches user transactions", async () => {
      const mockTransactions: Transaction[] = [
        createTransaction({ type: "deposit", amount: "1000" }),
        createTransaction({ type: "borrow", amount: "500", status: "pending" }),
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockTransactions,
      });
      global.fetch = fetchMock;

      const result = await userApi.getTransactions(VALID_STELLAR_ADDRESS);

      expect(result).toEqual(mockTransactions);
      expect(calls[0].url).toBe(
        `http://localhost:3001/users/${VALID_STELLAR_ADDRESS}/transactions`,
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("getPortfolio", () => {
    it("fetches user portfolio", async () => {
      const mockPortfolio = {
        properties: [
          { propertyId: VALID_UUID, shares: 10 },
          { propertyId: "550e8400-e29b-41d4-a716-446655440002", shares: 5 },
        ],
        deposits: [
          { poolId: "550e8400-e29b-41d4-a716-446655440010", amount: 1000 },
        ],
        borrows: [
          { poolId: "550e8400-e29b-41d4-a716-446655440010", amount: 500 },
        ],
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockPortfolio,
      });
      global.fetch = fetchMock;

      const result = await userApi.getPortfolio(VALID_STELLAR_ADDRESS);

      expect(result).toEqual(mockPortfolio);
      expect(calls[0].url).toBe(
        `http://localhost:3001/users/${VALID_STELLAR_ADDRESS}/portfolio`,
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("getKycStatus", () => {
    it("fetches KYC status", async () => {
      const mockKycStatus = {
        status: "approved",
        tier: "verified",
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockKycStatus,
      });
      global.fetch = fetchMock;

      const result = await userApi.getKycStatus(VALID_UUID);

      expect(result).toEqual(mockKycStatus);
      expect(calls[0].url).toBe(
        "http://localhost:3001/kyc/status/550e8400-e29b-41d4-a716-446655440001",
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("submitKyc", () => {
    it("submits KYC for verification", async () => {
      const submitPayload = {
        userId: VALID_UUID,
        documents: [
          {
            type: "passport" as const,
            documentUrl: "https://example.com/doc.pdf",
          },
        ],
      };

      const mockResponse = {
        status: "pending",
        message: "KYC submission received",
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await userApi.submitKyc(submitPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe("http://localhost:3001/kyc/submit");
      expect(calls[0].options.method).toBe("POST");
      expect(JSON.parse(calls[0].options.body as string)).toEqual(
        submitPayload,
      );
    });
  });

  describe("getKycDocuments", () => {
    it("fetches user KYC documents", async () => {
      const mockDocuments: KycDocument[] = [createKycDocument()];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockDocuments,
      });
      global.fetch = fetchMock;

      const result = await userApi.getKycDocuments(VALID_UUID);

      expect(result).toEqual(mockDocuments);
      expect(calls[0].url).toBe(
        "http://localhost:3001/kyc/documents/550e8400-e29b-41d4-a716-446655440001",
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });
});
