import { NextRequest, NextResponse } from "next/server";
import { Transaction, Keypair, StrKey, xdr } from "@stellar/stellar-sdk";
import { z } from "zod";
import * as privyServer from "@/lib/privy-server";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "@/lib/privy-env";
import { pilotNetworkPassphrase } from "@/services/pilot/config";

const MAX_TX_XDR_LENGTH = 65_536;
const PRIVY_WALLET_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const signRequestSchema = z.object({
  walletId: z
    .string()
    .trim()
    .regex(PRIVY_WALLET_ID_REGEX, "Invalid walletId format."),
  address: z
    .string()
    .trim()
    .refine((value) => StrKey.isValidEd25519PublicKey(value), {
      message: "Invalid Stellar public key.",
    }),
  txXdr: z
    .string()
    .trim()
    .min(1, "txXdr is required.")
    .max(MAX_TX_XDR_LENGTH, "txXdr exceeds maximum allowed size.")
    .refine((value) => value.length % 4 === 0 && BASE64_REGEX.test(value), {
      message: "txXdr must be valid base64.",
    }),
  networkPassphrase: z.string().trim().min(1, "networkPassphrase is required."),
});

/**
 * POST /api/privy/sign
 *
 * Server-side proxy for Privy's raw_sign endpoint.
 * Stellar is a Tier-2 chain in Privy - signing goes through the REST API,
 * not the React SDK. The app secret must never be exposed to the browser.
 *
 * Request body:
 *   { walletId: string; address: string; txXdr: string; networkPassphrase: string }
 *
 * Headers:
 *   Authorization: Bearer <privy_access_token>
 *
 * Flow:
 *   1. Validate request body schema and configured network passphrase
 *   2. Verify the caller owns the wallet via Privy access token
 *   3. Deserialize the XDR into a Transaction and verify source account matches address
 *   4. Hash it with the network passphrase (32-byte Ed25519 signing payload)
 *   5. POST the hash to Privy's raw_sign API
 *   6. Attach the returned signature to the transaction
 *   7. Return the signed XDR
 */
export async function POST(req: NextRequest) {
  const appId = process.env[PRIVY_APP_ID_ENV]?.trim();
  const appCredential = process.env[PRIVY_APP_CREDENTIAL_ENV]?.trim();

  if (!appId || !appCredential) {
    return NextResponse.json(
      { error: "Privy credentials not configured on the server." },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!authHeader || !/^Bearer\s+/i.test(authHeader) || !accessToken) {
    return NextResponse.json(
      { error: "Missing Privy access token." },
      { status: 401 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsedBody = signRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const { walletId, address, txXdr, networkPassphrase } = parsedBody.data;
  const expectedNetworkPassphrase = pilotNetworkPassphrase();

  if (networkPassphrase !== expectedNetworkPassphrase) {
    return NextResponse.json(
      { error: "Network passphrase does not match configured network." },
      { status: 400 },
    );
  }

  try {
    await privyServer.verifyPrivyWalletOwnership(
      accessToken,
      walletId,
      address,
    );
  } catch (error) {
    console.error("[privy/sign] Wallet ownership verification failed:", error);
    const isConfigError =
      error instanceof Error && error.message.includes("not configured");
    return NextResponse.json(
      {
        error: isConfigError
          ? "Privy credentials not configured on the server."
          : "Wallet does not belong to authenticated user.",
      },
      { status: isConfigError ? 500 : 403 },
    );
  }

  let tx: Transaction;
  try {
    tx = new Transaction(txXdr, expectedNetworkPassphrase);
  } catch (error) {
    console.error("[privy/sign] Failed to decode transaction XDR:", error);
    return NextResponse.json(
      { error: "Invalid transaction XDR." },
      { status: 400 },
    );
  }

  const hasMismatchedOperationSource = tx.operations.some((op) =>
    Boolean(op.source && op.source !== address),
  );
  if (tx.source !== address || hasMismatchedOperationSource) {
    return NextResponse.json(
      { error: "Transaction source account does not match wallet address." },
      { status: 400 },
    );
  }

  const txHash = tx.hash();
  const hashHex = "0x" + Buffer.from(txHash).toString("hex");

  const credentials = Buffer.from(`${appId}:${appCredential}`).toString(
    "base64",
  );

  let privyRes: Response;
  try {
    privyRes = await fetch(
      `https://api.privy.io/v1/wallets/${encodeURIComponent(walletId)}/raw_sign`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
          "privy-app-id": appId,
        },
        body: JSON.stringify({ params: { hash: hashHex } }),
      },
    );
  } catch (error) {
    console.error("[privy/sign] Privy signing request failed:", error);
    return NextResponse.json(
      { error: "Failed to sign transaction." },
      { status: 502 },
    );
  }

  if (!privyRes.ok) {
    const errorText = await privyRes.text();
    console.error("[privy/sign] Privy API error:", privyRes.status, errorText);
    return NextResponse.json(
      { error: "Failed to sign transaction." },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = await privyRes.json();
  } catch (error) {
    console.error("[privy/sign] Invalid JSON from Privy API:", error);
    return NextResponse.json(
      { error: "Failed to sign transaction." },
      { status: 502 },
    );
  }

  const sigHex =
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    typeof (data as { data?: { signature?: unknown } }).data?.signature ===
      "string"
      ? (data as { data: { signature: string } }).data.signature
      : "";

  const normalizedSigHex = sigHex.replace(/^0x/i, "");
  if (!normalizedSigHex || !/^[0-9a-fA-F]{128}$/.test(normalizedSigHex)) {
    return NextResponse.json(
      { error: "Privy returned no signature." },
      { status: 500 },
    );
  }

  const sigBytes = Buffer.from(normalizedSigHex, "hex");
  const keypair = Keypair.fromPublicKey(address);
  const decorated = new xdr.DecoratedSignature({
    hint: keypair.signatureHint(),
    signature: sigBytes,
  });
  tx.signatures.push(decorated);

  const signedXdr = tx.toEnvelope().toXDR("base64");
  return NextResponse.json({ signedXdr });
}
