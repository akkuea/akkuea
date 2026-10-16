import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

process.env.API_URL = "http://api.test";
const { GET } = await import("../[[...path]]/route");

const operatorWallet = `G${"A".repeat(55)}`;
const originalFetch = globalThis.fetch;

function request(path = ["properties"], token?: string) {
  return GET(
    new NextRequest(`http://web.test/api/admin/operations/${path.join("/")}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
    { params: Promise.resolve({ path }) },
  );
}

describe("admin operations proxy authorization", () => {
  let fetchMock: ReturnType<typeof mock>;

  beforeEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = "internal-secret";
    process.env.OPERATIONS_ALLOWED_WALLETS = operatorWallet;
    delete process.env.OPERATIONS_ALLOW_WILDCARD_IN_DEVELOPMENT;
    process.env.NODE_ENV = "test";
    fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url.endsWith("/users/me")) {
        return Response.json({ walletAddress: operatorWallet });
      }
      return new Response("{\"success\":true}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("rejects missing or invalid sessions before proxying", async () => {
    const missing = await request();
    expect(missing.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockImplementationOnce(async () => new Response("unauthorized", { status: 401 }));
    const invalid = await request(["properties"], "expired-token");
    expect(invalid.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("uses the wallet returned by the API session and adds trusted headers", async () => {
    const response = await request(["properties"], "valid-session");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const upstreamInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const headers = new Headers(upstreamInit.headers);
    expect(headers.get("x-internal-api-key")).toBe("internal-secret");
    expect(headers.get("x-operator-wallet")).toBe(operatorWallet);
  });

  test("rejects an authenticated wallet outside the allowlist", async () => {
    process.env.OPERATIONS_ALLOWED_WALLETS = `G${"B".repeat(55)}`;
    const response = await request(["properties"], "valid-session");
    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("rejects wildcard access in production and only allows it with the dev flag", async () => {
    process.env.OPERATIONS_ALLOWED_WALLETS = "*";
    process.env.NODE_ENV = "production";
    const production = await request(["properties"], "valid-session");
    expect(production.status).toBe(403);

    process.env.NODE_ENV = "development";
    process.env.OPERATIONS_ALLOW_WILDCARD_IN_DEVELOPMENT = "true";
    const development = await request(["properties"], "valid-session");
    expect(development.status).toBe(200);
  });

  test("rejects traversal and encoded separators before any upstream request", async () => {
    const traversal = await request(["..", "properties"], "valid-session");
    expect(traversal.status).toBe(400);
    const encodedSlash = await request(["properties", "a%2Fb"], "valid-session");
    expect(encodedSlash.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
