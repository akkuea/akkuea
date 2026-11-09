import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
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
import * as privyServer from "@/lib/privy-server";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "@/lib/privy-env";
import { POST as signPost } from "../sign/route";
import { POST as createWalletPost } from "../create-wallet/route";

function buildUnsignedTxXdr(
  sourcePublicKey: string,
  networkPassphrase: string = Networks.TESTNET,
  operationSource?: string,
): string {
  const account = new Account(sourcePublicKey, "100");
  const destination = Keypair.random().publicKey();
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount: "10",
        ...(operationSource ? { source: operationSource } : {}),
      }),
    )
    .setTimeout(30)
    .build();

  return tx.toEnvelope().toXDR("base64");
}

function makeJsonRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {
    Authorization: "Bearer valid-access-token",
  },
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/privy/sign", () => {
  const originalAppId = process.env[PRIVY_APP_ID_ENV];
  const originalCredential = process.env[PRIVY_APP_CREDENTIAL_ENV];
  const originalNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  const signerKeypair = Keypair.random();
  const signerAddress = signerKeypair.publicKey();
  const validWalletId = "wallet_stellar_01";

  let ownershipSpy: ReturnType<typeof spyOn>;
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    process.env[PRIVY_APP_ID_ENV] = "test-privy-app-id";
    process.env[PRIVY_APP_CREDENTIAL_ENV] = "test-privy-app-secret";
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";

    ownershipSpy = spyOn(
      privyServer,
      "verifyPrivyWalletOwnership",
    ).mockResolvedValue(undefined);

    const fakeSigHex = "0x" + "ab".repeat(64);
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { signature: fakeSigHex } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    mock.restore();
    if (originalAppId === undefined) {
      delete process.env[PRIVY_APP_ID_ENV];
    } else {
      process.env[PRIVY_APP_ID_ENV] = originalAppId;
    }
    if (originalCredential === undefined) {
      delete process.env[PRIVY_APP_CREDENTIAL_ENV];
    } else {
      process.env[PRIVY_APP_CREDENTIAL_ENV] = originalCredential;
    }
    if (originalNetwork === undefined) {
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = originalNetwork;
    }
  });

  test("returns 500 when Privy credentials are missing", async () => {
    delete process.env[PRIVY_APP_ID_ENV];
    delete process.env[PRIVY_APP_CREDENTIAL_ENV];

    const req = makeJsonRequest("http://localhost/api/privy/sign", {
      walletId: validWalletId,
      address: signerAddress,
      txXdr: buildUnsignedTxXdr(signerAddress),
      networkPassphrase: Networks.TESTNET,
    });

    const res = await signPost(req);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Privy credentials not configured on the server.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("returns 401 when Authorization Bearer token is missing", async () => {
    const req = makeJsonRequest(
      "http://localhost/api/privy/sign",
      {
        walletId: validWalletId,
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(signerAddress),
        networkPassphrase: Networks.TESTNET,
      },
      {},
    );

    const res = await signPost(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Missing Privy access token.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("returns 403 when authenticated user does not own the wallet without leaking raw error text", async () => {
    ownershipSpy.mockRejectedValueOnce(
      new Error("Internal Privy ownership check trace: user did:privy:999"),
    );

    const req = makeJsonRequest("http://localhost/api/privy/sign", {
      walletId: validWalletId,
      address: signerAddress,
      txXdr: buildUnsignedTxXdr(signerAddress),
      networkPassphrase: Networks.TESTNET,
    });

    const res = await signPost(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Wallet does not belong to authenticated user.");
    expect(body.error).not.toContain("did:privy:999");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("returns 400 on malformed request bodies and invalid XDR without leaking SDK exception text", async () => {
    // 1. Invalid JSON
    const badJsonRes = await signPost(
      makeJsonRequest("http://localhost/api/privy/sign", "{not-valid-json"),
    );
    expect(badJsonRes.status).toBe(400);

    // 2. Invalid walletId (path traversal attempt)
    const badWalletIdRes = await signPost(
      makeJsonRequest("http://localhost/api/privy/sign", {
        walletId: "../other-wallet/raw_sign",
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(signerAddress),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(badWalletIdRes.status).toBe(400);

    // 3. Invalid Stellar G... address
    const badAddressRes = await signPost(
      makeJsonRequest("http://localhost/api/privy/sign", {
        walletId: validWalletId,
        address: "not-a-stellar-address",
        txXdr: buildUnsignedTxXdr(signerAddress),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(badAddressRes.status).toBe(400);

    // 4. Valid base64 string that is not valid Stellar XDR
    const invalidXdrRes = await signPost(
      makeJsonRequest("http://localhost/api/privy/sign", {
        walletId: validWalletId,
        address: signerAddress,
        txXdr: Buffer.from("not-a-valid-xdr-envelope").toString("base64"),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(invalidXdrRes.status).toBe(400);
    const invalidXdrBody = (await invalidXdrRes.json()) as { error: string };
    expect(invalidXdrBody.error).toBe("Invalid transaction XDR.");
    expect(invalidXdrBody.error).not.toContain("XDR Write Error");
    expect(invalidXdrBody.error).not.toContain("Error:");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("rejects a wrong networkPassphrase with 400 before Privy is called", async () => {
    const req = makeJsonRequest("http://localhost/api/privy/sign", {
      walletId: validWalletId,
      address: signerAddress,
      txXdr: buildUnsignedTxXdr(signerAddress, Networks.PUBLIC),
      networkPassphrase: Networks.PUBLIC,
    });

    const res = await signPost(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(
      "Network passphrase does not match configured network.",
    );
    expect(ownershipSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("rejects a transaction whose source account or operation source does not match address", async () => {
    const otherAccount = Keypair.random().publicKey();

    // Case 1: Transaction source account is not `address`
    const wrongTxSourceRes = await signPost(
      makeJsonRequest("http://localhost/api/privy/sign", {
        walletId: validWalletId,
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(otherAccount, Networks.TESTNET),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(wrongTxSourceRes.status).toBe(400);
    const wrongTxSourceBody = (await wrongTxSourceRes.json()) as {
      error: string;
    };
    expect(wrongTxSourceBody.error).toBe(
      "Transaction source account does not match wallet address.",
    );

    // Case 2: Operation source account is not `address`
    const wrongOpSourceRes = await signPost(
      makeJsonRequest("http://localhost/api/privy/sign", {
        walletId: validWalletId,
        address: signerAddress,
        txXdr: buildUnsignedTxXdr(
          signerAddress,
          Networks.TESTNET,
          otherAccount,
        ),
        networkPassphrase: Networks.TESTNET,
      }),
    );
    expect(wrongOpSourceRes.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("does not leak Privy API error details when upstream raw_sign fails", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "upstream_secret_error_trace_id_987654",
          message: "Internal HSM fault on key shard 3",
        }),
        { status: 422 },
      ),
    );

    const req = makeJsonRequest("http://localhost/api/privy/sign", {
      walletId: validWalletId,
      address: signerAddress,
      txXdr: buildUnsignedTxXdr(signerAddress),
      networkPassphrase: Networks.TESTNET,
    });

    const res = await signPost(req);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Failed to sign transaction.");
    expect(body.error).not.toContain("upstream_secret_error_trace_id_987654");
    expect(body.error).not.toContain("422");
  });

  test("happy path returns signedXdr with one added signature whose hint matches address", async () => {
    const unsignedXdr = buildUnsignedTxXdr(signerAddress, Networks.TESTNET);
    const unsignedTx = new Transaction(unsignedXdr, Networks.TESTNET);
    const rawSig = signerKeypair.sign(unsignedTx.hash());
    const sigHex = "0x" + Buffer.from(rawSig).toString("hex");

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { signature: sigHex } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const req = makeJsonRequest("http://localhost/api/privy/sign", {
      walletId: validWalletId,
      address: signerAddress,
      txXdr: unsignedXdr,
      networkPassphrase: Networks.TESTNET,
    });

    const res = await signPost(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { signedXdr: string };
    expect(typeof body.signedXdr).toBe("string");

    const signedTx = new Transaction(body.signedXdr, Networks.TESTNET);
    expect(signedTx.signatures).toHaveLength(1);
    const sig = signedTx.signatures[0]!;
    expect(Buffer.from(sig.hint.toXDR())).toEqual(
      Buffer.from(signerKeypair.signatureHint()),
    );
    expect(
      signerKeypair.verify(
        signedTx.hash(),
        Buffer.from(sig.signature.toXDR().subarray(4)),
      ),
    ).toBe(true);
  });
});

describe("POST /api/privy/create-wallet", () => {
  const walletAddress = Keypair.random().publicKey();

  afterEach(() => {
    mock.restore();
  });

  test("returns 500 when Privy client is not configured", async () => {
    spyOn(privyServer, "getPrivyClient").mockReturnValue(null);

    const req = new NextRequest("http://localhost/api/privy/create-wallet", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
    });

    const res = await createWalletPost(req);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Privy credentials not configured on the server.");
  });

  test("returns 401 when Authorization token is missing", async () => {
    spyOn(privyServer, "getPrivyClient").mockReturnValue({
      verifyAuthToken: mock(() => Promise.resolve({ userId: "did:privy:1" })),
    } as unknown as NonNullable<ReturnType<typeof privyServer.getPrivyClient>>);

    const req = new NextRequest("http://localhost/api/privy/create-wallet", {
      method: "POST",
    });

    const res = await createWalletPost(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Missing Privy access token.");
  });

  test("does not leak raw upstream error text when wallet creation fails", async () => {
    spyOn(privyServer, "getPrivyClient").mockReturnValue({
      verifyAuthToken: mock(() => Promise.resolve({ userId: "did:privy:1" })),
    } as unknown as NonNullable<ReturnType<typeof privyServer.getPrivyClient>>);
    spyOn(privyServer, "ensureStellarWalletForUser").mockRejectedValueOnce(
      new Error("Upstream Privy cluster connection reset at 10.0.4.12:8443"),
    );

    const req = new NextRequest("http://localhost/api/privy/create-wallet", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
    });

    const res = await createWalletPost(req);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Failed to create Stellar wallet.");
    expect(body.error).not.toContain("10.0.4.12");
  });

  test("happy path returns the user's Stellar wallet", async () => {
    spyOn(privyServer, "getPrivyClient").mockReturnValue({
      verifyAuthToken: mock(() => Promise.resolve({ userId: "did:privy:1" })),
    } as unknown as NonNullable<ReturnType<typeof privyServer.getPrivyClient>>);
    spyOn(privyServer, "ensureStellarWalletForUser").mockResolvedValueOnce({
      id: "wallet_stellar_01",
      address: walletAddress,
    });

    const req = new NextRequest("http://localhost/api/privy/create-wallet", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" },
    });

    const res = await createWalletPost(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; address: string };
    expect(body).toEqual({
      id: "wallet_stellar_01",
      address: walletAddress,
    });
  });
});
