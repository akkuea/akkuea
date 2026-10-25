import { describe, expect, test, mock, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "@/lib/privy-env";

const mockVerifyPrivyWalletOwnership = mock(
  async (_accessToken: string, _walletId: string, _address: string) => {},
);
const mockGetPrivyClient = mock(() => null);
const mockEnsureStellarWalletForUser = mock(async (_userId: string) => ({
  id: "wallet-123",
  address: "GABC",
}));

mock.module("@/lib/privy-server", () => ({
  verifyPrivyWalletOwnership: mockVerifyPrivyWalletOwnership,
  getPrivyClient: mockGetPrivyClient,
  ensureStellarWalletForUser: mockEnsureStellarWalletForUser,
  resetPrivyClient: () => {},
}));

const signerKeypair = Keypair.random();
const signerAddress = signerKeypair.publicKey();
const otherKeypair = Keypair.random();
const otherAddress = otherKeypair.publicKey();

function buildUnsignedTxXdr(
  sourceAddress: string = signerAddress,
  networkPassphrase: string = Networks.TESTNET,
  opSourceAddress?: string,
): string {
  const account = new Account(sourceAddress, "100");
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: otherAddress,
        asset: Asset.native(),
        amount: "10",
        source: opSourceAddress,
      }),
    )
    .setTimeout(60)
    .build();
  return tx.toEnvelope().toXDR("base64");
}

function makeRequest(
  body: unknown,
  authHeader: string | null = "Bearer valid-access-token",
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (authHeader !== null) {
    headers.set("authorization", authHeader);
  }
  return new NextRequest("http://localhost:3000/api/privy/sign", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/privy/sign", () => {
  const mockFetch = mock(async () => {
    const fakeSig = Buffer.alloc(64, 0xab).toString("hex");
    return new Response(
      JSON.stringify({ data: { signature: `0x${fakeSig}` } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  beforeEach(() => {
    process.env[PRIVY_APP_ID_ENV] = "test-app-id";
    process.env[PRIVY_APP_CREDENTIAL_ENV] = "test-app-secret";
    delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    mockVerifyPrivyWalletOwnership.mockClear();
    mockVerifyPrivyWalletOwnership.mockImplementation(async () => {});
    mockFetch.mockClear();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  test("returns 500 when Privy server credentials are missing", async () => {
    delete process.env[PRIVY_APP_ID_ENV];
    const { POST } = await import("../route");

    const res = await POST(
      makeRequest({
        walletId: "wallet-123",
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(),
        networkPassphrase: Networks.TESTNET,
      }),
    );

    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Privy credentials not configured on the server.");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("returns 401 when Authorization token is missing", async () => {
    const { POST } = await import("../route");

    const res = await POST(
      makeRequest(
        {
          walletId: "wallet-123",
          address: signerAddress,
          txXdr: buildUnsignedTxXdr(),
          networkPassphrase: Networks.TESTNET,
        },
        null,
      ),
    );

    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Missing Privy access token.");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("returns 403 when authenticated user does not own the wallet", async () => {
    mockVerifyPrivyWalletOwnership.mockImplementationOnce(async () => {
      throw new Error("Wallet does not belong to authenticated user.");
    });
    const { POST } = await import("../route");

    const res = await POST(
      makeRequest({
        walletId: "wallet-other",
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(),
        networkPassphrase: Networks.TESTNET,
      }),
    );

    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Wallet does not belong to authenticated user.");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("returns 400 on malformed JSON or invalid schema fields", async () => {
    const { POST } = await import("../route");

    const badJsonRes = await POST(makeRequest("{not-json"));
    expect(badJsonRes.status).toBe(400);

    const badWalletIdRes = await POST(
      makeRequest({
        walletId: "../evil/path",
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(badWalletIdRes.status).toBe(400);

    const badAddressRes = await POST(
      makeRequest({
        walletId: "wallet-123",
        address: "not-a-stellar-key",
        txXdr: buildUnsignedTxXdr(),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(badAddressRes.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects a wrong networkPassphrase before calling Privy", async () => {
    const { POST } = await import("../route");

    const res = await POST(
      makeRequest({
        walletId: "wallet-123",
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(signerAddress, Networks.PUBLIC),
        networkPassphrase: Networks.PUBLIC,
      }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Unsupported or mismatched network passphrase.");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects a transaction whose source account or operation source does not match address", async () => {
    const { POST } = await import("../route");

    const txSourceMismatchRes = await POST(
      makeRequest({
        walletId: "wallet-123",
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(otherAddress, Networks.TESTNET),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(txSourceMismatchRes.status).toBe(400);

    const opSourceMismatchRes = await POST(
      makeRequest({
        walletId: "wallet-123",
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(
          signerAddress,
          Networks.TESTNET,
          otherAddress,
        ),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(opSourceMismatchRes.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("does not leak internal SDK or Privy API error details", async () => {
    const { POST } = await import("../route");

    const badXdrRes = await POST(
      makeRequest({
        walletId: "wallet-123",
        address: signerAddress,
        txXdr: "AAAA",
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(badXdrRes.status).toBe(400);
    const badXdrJson = (await badXdrRes.json()) as { error: string };
    expect(badXdrJson.error).toBe("Invalid transaction XDR.");

    mockFetch.mockImplementationOnce(async () => {
      return new Response("internal_secret_privy_stacktrace_detail", {
        status: 500,
      });
    });

    const privyErrRes = await POST(
      makeRequest({
        walletId: "wallet-123",
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(privyErrRes.status).toBe(502);
    const privyErrJson = (await privyErrRes.json()) as { error: string };
    expect(privyErrJson.error).toBe("Privy signing failed.");
    expect(privyErrJson.error).not.toContain(
      "internal_secret_privy_stacktrace_detail",
    );
  });

  test("returns signedXdr with one added signature matching address hint on happy path", async () => {
    const { POST } = await import("../route");
    const unsignedXdr = buildUnsignedTxXdr();

    const res = await POST(
      makeRequest({
        walletId: "wallet-123",
        address: signerAddress,
        txXdr: unsignedXdr,
        networkPassphrase: Networks.TESTNET,
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { signedXdr: string };
    expect(typeof json.signedXdr).toBe("string");

    const signedTx = new Transaction(json.signedXdr, Networks.TESTNET);
    expect(signedTx.signatures).toHaveLength(1);
    expect(Buffer.from(signedTx.signatures[0].hint())).toEqual(
      Buffer.from(signerKeypair.signatureHint()),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
