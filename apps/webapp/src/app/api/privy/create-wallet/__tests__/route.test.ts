import { describe, expect, test, mock, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";

const testWalletAddress = Keypair.random().publicKey();

const mockVerifyAuthToken = mock(async (_token: string) => ({
  userId: "did:privy:user-123",
}));

const mockGetPrivyClient = mock(
  (): { verifyAuthToken: typeof mockVerifyAuthToken } | null => ({
    verifyAuthToken: mockVerifyAuthToken,
  }),
);

const mockEnsureStellarWalletForUser = mock(async (_userId: string) => ({
  id: "wallet-123",
  address: testWalletAddress,
}));

const mockVerifyPrivyWalletOwnership = mock(
  async (_accessToken: string, _walletId: string, _address: string) => {},
);

mock.module("@/lib/privy-server", () => ({
  getPrivyClient: mockGetPrivyClient,
  ensureStellarWalletForUser: mockEnsureStellarWalletForUser,
  verifyPrivyWalletOwnership: mockVerifyPrivyWalletOwnership,
  resetPrivyClient: () => {},
}));

function makeRequest(
  authHeader: string | null = "Bearer valid-token",
): NextRequest {
  const headers = new Headers();
  if (authHeader !== null) {
    headers.set("authorization", authHeader);
  }
  return new NextRequest("http://localhost:3000/api/privy/create-wallet", {
    method: "POST",
    headers,
  });
}

describe("POST /api/privy/create-wallet", () => {
  beforeEach(() => {
    mockGetPrivyClient.mockClear();
    mockVerifyAuthToken.mockClear();
    mockEnsureStellarWalletForUser.mockClear();

    mockGetPrivyClient.mockImplementation(() => ({
      verifyAuthToken: mockVerifyAuthToken,
    }));
    mockVerifyAuthToken.mockImplementation(async () => ({
      userId: "did:privy:user-123",
    }));
    mockEnsureStellarWalletForUser.mockImplementation(async () => ({
      id: "wallet-123",
      address: testWalletAddress,
    }));
  });

  test("returns 500 when Privy credentials are not configured", async () => {
    mockGetPrivyClient.mockImplementationOnce(() => null);
    const { POST } = await import("../route");

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Privy credentials not configured on the server.");
  });

  test("returns 401 when Authorization token is missing", async () => {
    const { POST } = await import("../route");

    const res = await POST(makeRequest(null));
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Missing Privy access token.");
  });

  test("returns 401 with generic error when auth token verification fails", async () => {
    mockVerifyAuthToken.mockImplementationOnce(async () => {
      throw new Error("Invalid JWS signature detail");
    });
    const { POST } = await import("../route");

    const res = await POST(makeRequest("Bearer bad-token"));
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid or expired Privy access token.");
    expect(json.error).not.toContain("JWS signature detail");
  });

  test("returns 403 when Stellar embedded wallets are not enabled", async () => {
    mockEnsureStellarWalletForUser.mockImplementationOnce(async () => {
      throw new Error(
        "Stellar embedded wallets are not enabled for this Privy app.",
      );
    });
    const { POST } = await import("../route");

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe(
      "Stellar embedded wallets are not enabled for this Privy app.",
    );
  });

  test("returns 502 without leaking internal exception text on unexpected errors", async () => {
    mockEnsureStellarWalletForUser.mockImplementationOnce(async () => {
      throw new Error("Upstream raw_privy_internal_error_500_secret");
    });
    const { POST } = await import("../route");

    const res = await POST(makeRequest());
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Failed to provision Stellar wallet.");
    expect(json.error).not.toContain("raw_privy_internal_error_500_secret");
  });

  test("returns provisioned Stellar wallet on happy path", async () => {
    const { POST } = await import("../route");

    const res = await POST(makeRequest("Bearer valid-token"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { id: string; address: string };
    expect(json).toEqual({
      id: "wallet-123",
      address: testWalletAddress,
    });
    expect(mockVerifyAuthToken).toHaveBeenCalledWith("valid-token");
    expect(mockEnsureStellarWalletForUser).toHaveBeenCalledWith(
      "did:privy:user-123",
    );
  });
});
