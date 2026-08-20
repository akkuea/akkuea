import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import app from "../app";
import { db } from "../db";
import { whitelistService } from "../services/WhitelistService";
import Elysia from "elysia";
import { whitelistRoutes } from "./whitelist";
import { eq } from "drizzle-orm";
import { pilotWhitelistRequests } from "../db/schema/pilotWhitelist";

// Mock whitelist service
mock.module("../services/WhitelistService", () => {
  return {
    whitelistService: {
      approveRequest: mock(() => Promise.resolve("mock_tx_hash")),
      rejectRequest: mock(() => Promise.resolve()),
    },
  };
});

// Setup a minimal app for testing routes
const testApp = new Elysia().use(whitelistRoutes);

describe("Whitelist API Routes", () => {
  const mockWallet = "GDK7PZZY4QJ6GZ46X34PXZY2C46Y7PZZY4QJ6GZ46X34PXZY2C46Y7PZ";
  let mockDbStore: any[] = [];

  beforeEach(() => {
    mockDbStore = [];
    
    // Mock db queries
    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async ({ where }) => {
          return mockDbStore.find(r => r.walletAddress === mockWallet); // Simplified mock
        }),
        findMany: mock(async () => mockDbStore),
      }
    };

    (db as any).insert = mock(() => ({
      values: (val: any) => ({
        returning: async () => {
          const inserted = { id: "test_id", ...val };
          mockDbStore.push(inserted);
          return [inserted];
        }
      })
    }));

    (db as any).update = mock(() => ({
      set: (val: any) => ({
        where: async () => {
          if (mockDbStore.length > 0) {
            Object.assign(mockDbStore[0], val);
          }
        }
      })
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  it("should submit a new whitelist request successfully", async () => {
    const response = await testApp.handle(
      new Request("http://localhost/pilot/whitelist/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: mockWallet,
          fullName: "Test User",
          idType: "passport",
          idReference: "A1234567",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.walletAddress).toBe(mockWallet);
    expect(result.data.status).toBe("pending");
    expect(mockDbStore.length).toBe(1);
  });

  it("should fail to submit a duplicate request", async () => {
    mockDbStore.push({
      id: "existing_id",
      walletAddress: mockWallet,
      status: "pending",
    });

    const response = await testApp.handle(
      new Request("http://localhost/pilot/whitelist/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: mockWallet,
          fullName: "Test User 2",
          idType: "national_id",
          idReference: "B7654321",
        }),
      })
    );

    expect(response.status).not.toBe(200);
  });

  it("should fetch pending requests", async () => {
    mockDbStore.push({
      id: "pending_id",
      walletAddress: mockWallet,
      status: "pending",
    });

    const response = await testApp.handle(
      new Request("http://localhost/pilot/whitelist/pending", {
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.length).toBe(1);
  });

  it("should review a request", async () => {
    const response = await testApp.handle(
      new Request("http://localhost/pilot/whitelist/req_id_1/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      })
    );

    const status = response.status;
    const result = await response.json();
    console.log("REVIEW RESPONSE:", status, result);
    expect(status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.txHash).toBe("mock_tx_hash");
    expect(whitelistService.approveRequest).toHaveBeenCalledWith("req_id_1");
  });
});
