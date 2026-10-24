import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import {
  Keypair,
  TransactionBuilder,
  Account,
  Networks,
  Operation,
  Asset,
  Transaction,
} from "@stellar/stellar-sdk";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "@/lib/privy-env";

// Mock @akkuea/shared for workspace resolution in test environment
mock.module("@akkuea/shared", () => ({
  CONTRACT_IDS: {
    PILOT_PAYOUT_SPLIT: { TESTNET: "", MAINNET: "" },
    PILOT_INCOME_TOKEN: { TESTNET: "", MAINNET: "" },
    PILOT_WHITELIST: { TESTNET: "", MAINNET: "" },
  },
  API_ENDPOINTS: {
    SOROBAN_RPC: { TESTNET: "", MAINNET: "" },
  },
}));

// Mock next/server for test environment
class MockNextRequest extends Request {
  constructor(input: any, init?: any) {
    super(input, init);
  }
}

class MockNextResponse extends Response {
  static json(data: any, init?: ResponseInit) {
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

const mockVerifyOwnership = mock(() => Promise.resolve());

mock.module("@/lib/privy-server", () => ({
  resetPrivyClient: () => {},
  verifyPrivyWalletOwnership: mockVerifyOwnership,
  getPrivyClient: () => null,
  ensureStellarWalletForUser: () => Promise.resolve({ id: "", address: "" }),
}));

function makeRequest(
  body: any,
  headers: Record<string, string> = { authorization: "Bearer valid-token" },
): any {
  return new MockNextRequest("http://localhost:3000/api/privy/sign", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function buildValidTx(
  kp: Keypair,
  networkPassphrase: string = Networks.TESTNET,
): string {
  const account = new Account(kp.publicKey(), "1");
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: "1",
      }),
    )
    .setTimeout(30)
    .build();
  return tx.toXDR();
}

describe("POST /api/privy/sign", () => {
  const originalFetch = globalThis.fetch;
  let keypair: Keypair;
  let validTxXdr: string;
  let fetchMock: ReturnType<typeof mock>;

  beforeEach(() => {
    process.env[PRIVY_APP_ID_ENV] = "test-app-id";
    process.env[PRIVY_APP_CREDENTIAL_ENV] = "test-app-credential";
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";

    keypair = Keypair.random();
    validTxXdr = buildValidTx(keypair, Networks.TESTNET);
    mockVerifyOwnership.mockClear();

    const mockSignature = "0x" + Buffer.alloc(64, 7).toString("hex");
    fetchMock = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
              signature: mockSignature,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    globalThis.fetch = fetchMock as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("rejects with 500 when Privy credentials are not configured", async () => {
    delete process.env[PRIVY_APP_ID_ENV];
    delete process.env[PRIVY_APP_CREDENTIAL_ENV];

    const { POST } = await import("../sign/route");
    const req = makeRequest({
      walletId: "wallet-123",
      address: keypair.publicKey(),
      txXdr: validTxXdr,
      networkPassphrase: Networks.TESTNET,
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Privy credentials not configured on the server.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects with 401 when Authorization token is missing", async () => {
    const { POST } = await import("../sign/route");
    const req = makeRequest(
      {
        walletId: "wallet-123",
        address: keypair.publicKey(),
        txXdr: validTxXdr,
        networkPassphrase: Networks.TESTNET,
      },
      {}, // no auth header
    );

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Missing Privy access token.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects with 400 when body is malformed or invalid JSON", async () => {
    const { POST } = await import("../sign/route");
    const req = makeRequest("invalid json{");

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request body.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects with 400 when body fails schema validation (e.g. invalid Stellar address)", async () => {
    const { POST } = await import("../sign/route");
    const req = makeRequest({
      walletId: "wallet-123",
      address: "NOT_A_VALID_STELLAR_KEY",
      txXdr: validTxXdr,
      networkPassphrase: Networks.TESTNET,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request body.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects with 400 when networkPassphrase does not match configured app network before calling Privy", async () => {
    const { POST } = await import("../sign/route");
    const req = makeRequest({
      walletId: "wallet-123",
      address: keypair.publicKey(),
      txXdr: validTxXdr,
      networkPassphrase: Networks.PUBLIC, // Mismatched passphrase (app is on TESTNET)
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid network passphrase.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects with 403 when user does not own wallet", async () => {
    mockVerifyOwnership.mockImplementationOnce(() =>
      Promise.reject(new Error("Wallet does not belong to authenticated user.")),
    );

    const { POST } = await import("../sign/route");
    const req = makeRequest({
      walletId: "wallet-123",
      address: keypair.publicKey(),
      txXdr: validTxXdr,
      networkPassphrase: Networks.TESTNET,
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects with 400 when transaction source account does not match wallet address", async () => {
    const otherKp = Keypair.random();
    const otherTxXdr = buildValidTx(otherKp, Networks.TESTNET);

    const { POST } = await import("../sign/route");
    const req = makeRequest({
      walletId: "wallet-123",
      address: keypair.publicKey(), // different from tx.source
      txXdr: otherTxXdr,
      networkPassphrase: Networks.TESTNET,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(
      "Transaction source account does not match wallet address.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects with 400 when an operation source account does not match wallet address", async () => {
    const otherKp = Keypair.random();
    const account = new Account(keypair.publicKey(), "1");
    const txWithOpSource = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: "1",
          source: otherKp.publicKey(), // mismatched operation source
        }),
      )
      .setTimeout(30)
      .build();

    const { POST } = await import("../sign/route");
    const req = makeRequest({
      walletId: "wallet-123",
      address: keypair.publicKey(),
      txXdr: txWithOpSource.toXDR(),
      networkPassphrase: Networks.TESTNET,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(
      "Operation source account does not match wallet address.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not leak Privy API error text on upstream error", async () => {
    fetchMock = mock(() =>
      Promise.resolve(
        new Response("internal secret database stack trace error", {
          status: 500,
        }),
      ),
    );
    globalThis.fetch = fetchMock as any;

    const { POST } = await import("../sign/route");
    const req = makeRequest({
      walletId: "wallet-123",
      address: keypair.publicKey(),
      txXdr: validTxXdr,
      networkPassphrase: Networks.TESTNET,
    });

    const res = await POST(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Privy signing request failed.");
    expect(body.error).not.toContain("database");
    expect(body.error).not.toContain("stack trace");
  });

  test("happy path: returns signed XDR with exactly one added signature matching address hint", async () => {
    const { POST } = await import("../sign/route");
    const req = makeRequest({
      walletId: "wallet-123",
      address: keypair.publicKey(),
      txXdr: validTxXdr,
      networkPassphrase: Networks.TESTNET,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedXdr).toBeDefined();

    const signedTx = new Transaction(body.signedXdr, Networks.TESTNET);
    expect(signedTx.signatures.length).toBe(1);
    expect(Buffer.from((signedTx.signatures[0].hint as any).value)).toEqual(
      Buffer.from(keypair.signatureHint()),
    );
  });
});
