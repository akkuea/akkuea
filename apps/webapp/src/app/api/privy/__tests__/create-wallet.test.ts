import { describe, expect, test, mock, beforeEach } from "bun:test";
import type { NextRequest } from "next/server";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "@/lib/privy-env";

// Mock next/server for test environment
class MockNextRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init);
  }
}

class MockNextResponse extends Response {
  static json(data: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
  }
}

mock.module("next/server", () => ({
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse,
}));

const mockVerifyAuthToken = mock(() =>
  Promise.resolve({
    appId: "test-app",
    issuer: "privy.io",
    issuedAt: 0,
    expiration: 9999999999,
    sessionId: "session-1",
    userId: "did:privy:user-1",
  }),
);

const mockEnsureStellarWallet = mock(() =>
  Promise.resolve({
    id: "wallet-abc",
    address: "GABC1234567890123456789012345678901234567890123456789012345",
  }),
);

mock.module("@/lib/privy-server", () => ({
  getPrivyClient: () => {
    const appId = process.env[PRIVY_APP_ID_ENV]?.trim();
    const appCredential = process.env[PRIVY_APP_CREDENTIAL_ENV]?.trim();
    if (!appId || !appCredential) return null;
    return {
      verifyAuthToken: mockVerifyAuthToken,
    };
  },
  ensureStellarWalletForUser: mockEnsureStellarWallet,
  verifyPrivyWalletOwnership: () => Promise.resolve(),
}));

function makeRequest(
  headers: Record<string, string> = { authorization: "Bearer valid-token" },
): Request {
  return new MockNextRequest("http://localhost:3000/api/privy/create-wallet", {
    method: "POST",
    headers,
  });
}

describe("POST /api/privy/create-wallet", () => {
  beforeEach(() => {
    process.env[PRIVY_APP_ID_ENV] = "test-app-id";
    process.env[PRIVY_APP_CREDENTIAL_ENV] = "test-app-credential";
    mockVerifyAuthToken.mockClear();
    mockEnsureStellarWallet.mockClear();
  });

  test("rejects with 500 when Privy credentials are not configured", async () => {
    delete process.env[PRIVY_APP_ID_ENV];
    delete process.env[PRIVY_APP_CREDENTIAL_ENV];

    const { POST } = await import("../create-wallet/route");
    const req = makeRequest();

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Privy credentials not configured on the server.");
  });

  test("rejects with 401 when Authorization header is missing", async () => {
    const { POST } = await import("../create-wallet/route");
    const req = makeRequest({});

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Missing Privy access token.");
  });

  test("rejects with 401 when token verification fails", async () => {
    mockVerifyAuthToken.mockImplementationOnce(() =>
      Promise.reject(new Error("Invalid auth token JWS")),
    );

    const { POST } = await import("../create-wallet/route");
    const req = makeRequest();

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid or missing access token.");
  });

  test("does not leak raw exception text on wallet creation failure", async () => {
    mockEnsureStellarWallet.mockImplementationOnce(() =>
      Promise.reject(
        new Error(
          "Database connection timed out at postgres://internal-db:5432",
        ),
      ),
    );

    const { POST } = await import("../create-wallet/route");
    const req = makeRequest();

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Failed to create wallet.");
    expect(body.error).not.toContain("postgres");
    expect(body.error).not.toContain("timed out");
  });

  test("happy path: successfully returns wallet info", async () => {
    const { POST } = await import("../create-wallet/route");
    const req = makeRequest();

    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("wallet-abc");
    expect(body.address).toBe(
      "GABC1234567890123456789012345678901234567890123456789012345",
    );
  });
});
