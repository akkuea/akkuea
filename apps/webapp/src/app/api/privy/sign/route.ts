import { NextRequest, NextResponse } from "next/server";
import { Transaction, Keypair, StrKey, xdr } from "@stellar/stellar-sdk";
import { z } from "zod";
import { verifyPrivyWalletOwnership } from "@/lib/privy-server";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "@/lib/privy-env";
import { pilotNetworkPassphrase } from "@/services/pilot/config";

const MAX_TX_XDR_LENGTH = 100_000;
const WALLET_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

const signRequestSchema = z.object({
  walletId: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(WALLET_ID_REGEX, "Invalid walletId format"),
  address: z
    .string()
    .trim()
    .refine(
      (val) =>
        val.startsWith("G") &&
        val.length === 56 &&
        StrKey.isValidEd25519PublicKey(val),
      "Invalid Stellar public key",
    ),
  txXdr: z
    .string()
    .trim()
    .min(1)
    .max(MAX_TX_XDR_LENGTH)
    .refine(
      (val) => val.length % 4 === 0 && BASE64_REGEX.test(val),
      "Invalid base64 transaction XDR",
    ),
  networkPassphrase: z.string().trim().min(1),
});

/**
 * POST /api/privy/sign
 *
 * Server-side proxy for Privy's raw_sign endpoint.
 * Stellar is a Tier-2 chain in Privy - signing goes through the REST API,
 * not the React SDK. The app secret must never be exposed to the browser.
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
  if (!accessToken) {
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

  const parsed = signRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid signing request parameters." },
      { status: 400 },
    );
  }

  const { walletId, address, txXdr, networkPassphrase } = parsed.data;

  const expectedPassphrase = pilotNetworkPassphrase();
  if (networkPassphrase !== expectedPassphrase) {
    return NextResponse.json(
      { error: "Unsupported or mismatched network passphrase." },
      { status: 400 },
    );
  }

  try {
    await verifyPrivyWalletOwnership(accessToken, walletId, address);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message.includes("not configured")) {
      return NextResponse.json(
        { error: "Privy credentials not configured on the server." },
        { status: 500 },
      );
    }
    console.error("[privy/sign] Wallet ownership verification failed:", e);
    return NextResponse.json(
      { error: "Wallet does not belong to authenticated user." },
      { status: 403 },
    );
  }

  let tx: Transaction;
  try {
    tx = new Transaction(txXdr, expectedPassphrase);
  } catch (e) {
    console.error("[privy/sign] Failed to parse transaction XDR:", e);
    return NextResponse.json(
      { error: "Invalid transaction XDR." },
      { status: 400 },
    );
  }

  const hasMismatchedOperationSource = tx.operations.some(
    (op) => op.source !== undefined && op.source !== address,
  );
  if (tx.source !== address || hasMismatchedOperationSource) {
    return NextResponse.json(
      {
        error:
          "Transaction source account does not match the signing wallet address.",
      },
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
  } catch (e) {
    console.error("[privy/sign] Privy network request failed:", e);
    return NextResponse.json(
      { error: "Privy signing request failed." },
      { status: 502 },
    );
  }

  if (!privyRes.ok) {
    const errorText = await privyRes.text();
    console.error("[privy/sign] Privy API error:", privyRes.status, errorText);
    return NextResponse.json(
      { error: "Privy signing failed." },
      { status: 502 },
    );
  }

  let data: { data?: { signature?: unknown } } | null = null;
  try {
    data = (await privyRes.json()) as { data?: { signature?: unknown } };
  } catch (e) {
    console.error("[privy/sign] Invalid JSON from Privy:", e);
    return NextResponse.json(
      { error: "Privy signing failed." },
      { status: 502 },
    );
  }

  const sigHex =
    typeof data?.data?.signature === "string" ? data.data.signature : "";

  if (!sigHex) {
    return NextResponse.json(
      { error: "Privy returned no signature." },
      { status: 500 },
    );
  }

  const sigBytes = Buffer.from(sigHex.replace(/^0x/, ""), "hex");
  const keypair = Keypair.fromPublicKey(address);
  const decorated = new xdr.DecoratedSignature({
    hint: keypair.signatureHint(),
    signature: sigBytes,
  });
  tx.signatures.push(decorated);

  const signedXdr = tx.toEnvelope().toXDR("base64");
  return NextResponse.json({ signedXdr });
}
