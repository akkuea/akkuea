import { NextRequest, NextResponse } from "next/server";
import { Transaction, Keypair, xdr, StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";
import { verifyPrivyWalletOwnership } from "@/lib/privy-server";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "@/lib/privy-env";
import { pilotNetworkPassphrase } from "@/services/pilot/config";

const isStellarPublicKey = (val: string): boolean => {
  try {
    return (
      typeof val === "string" &&
      val.startsWith("G") &&
      val.length === 56 &&
      StrKey.isValidEd25519PublicKey(val)
    );
  } catch {
    return false;
  }
};

const PRIVY_WALLET_ID_REGEX = /^[a-zA-Z0-9_\-:]+$/;
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

const signBodySchema = z.object({
  walletId: z
    .string({ required_error: "walletId is required" })
    .min(1, "walletId is required")
    .max(128, "walletId is too long")
    .regex(PRIVY_WALLET_ID_REGEX, "Invalid walletId format"),
  address: z
    .string({ required_error: "address is required" })
    .length(56, "address must be exactly 56 characters")
    .refine(isStellarPublicKey, "Invalid Stellar public key"),
  txXdr: z
    .string({ required_error: "txXdr is required" })
    .min(1, "txXdr is required")
    .max(65536, "txXdr exceeds maximum allowed size")
    .regex(BASE64_REGEX, "Invalid txXdr base64 format"),
  networkPassphrase: z
    .string({ required_error: "networkPassphrase is required" })
    .min(1, "networkPassphrase is required")
    .max(256, "networkPassphrase is too long"),
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
 *   1. Verify server credentials and authorization header.
 *   2. Validate request body with Zod schema.
 *   3. Enforce networkPassphrase matches the configured app network.
 *   4. Verify the caller owns the wallet via Privy access token.
 *   5. Deserialize the XDR into a Transaction and verify source account matches address.
 *   6. Hash the transaction with network passphrase.
 *   7. POST the hash to Privy's raw_sign API.
 *   8. Attach the returned signature to the transaction.
 *   9. Return the signed XDR.
 */
export async function POST(req: NextRequest) {
  const appId = process.env[PRIVY_APP_ID_ENV];
  const appCredential = process.env[PRIVY_APP_CREDENTIAL_ENV];

  if (!appId || !appCredential) {
    return NextResponse.json(
      { error: "Privy credentials not configured on the server." },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer /i, "");
  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Privy access token." },
      { status: 401 },
    );
  }

  let parsedBody: z.infer<typeof signBodySchema>;
  try {
    const rawBody = await req.json();
    const result = signBodySchema.safeParse(rawBody);
    if (!result.success) {
      console.error("[privy/sign] Validation error:", result.error.issues);
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }
    parsedBody = result.data;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const { walletId, address, txXdr, networkPassphrase } = parsedBody;

  // Enforce configured application network
  const configuredNetworkPassphrase = pilotNetworkPassphrase();
  if (networkPassphrase !== configuredNetworkPassphrase) {
    return NextResponse.json(
      { error: "Invalid network passphrase." },
      { status: 400 },
    );
  }

  try {
    await verifyPrivyWalletOwnership(accessToken, walletId, address);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    console.error("[privy/sign] Wallet ownership verification failed:", message);
    const isConfig = message.includes("not configured");
    return NextResponse.json(
      { error: isConfig ? "Privy credentials not configured on the server." : "Unauthorized." },
      { status: isConfig ? 500 : 403 },
    );
  }

  let tx: Transaction;
  try {
    tx = new Transaction(txXdr, networkPassphrase);
  } catch (e) {
    console.error("[privy/sign] Invalid transaction XDR:", e);
    return NextResponse.json(
      { error: "Invalid transaction XDR." },
      { status: 400 },
    );
  }

  // Check transaction source account
  if (tx.source !== address) {
    return NextResponse.json(
      { error: "Transaction source account does not match wallet address." },
      { status: 400 },
    );
  }

  // Check operation source accounts
  const hasInvalidOpSource = tx.operations.some(
    (op) => op.source && op.source !== address,
  );
  if (hasInvalidOpSource) {
    return NextResponse.json(
      { error: "Operation source account does not match wallet address." },
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
  } catch (fetchErr) {
    console.error("[privy/sign] Privy fetch failed:", fetchErr);
    return NextResponse.json(
      { error: "Privy signing request failed." },
      { status: 502 },
    );
  }

  if (!privyRes.ok) {
    const errorText = await privyRes.text();
    console.error("[privy/sign] Privy API error:", privyRes.status, errorText);
    return NextResponse.json(
      { error: "Privy signing request failed." },
      { status: privyRes.status >= 500 ? 502 : privyRes.status },
    );
  }

  let data: unknown;
  try {
    data = await privyRes.json();
  } catch (jsonErr) {
    console.error("[privy/sign] Failed to parse Privy response JSON:", jsonErr);
    return NextResponse.json(
      { error: "Privy returned invalid response." },
      { status: 502 },
    );
  }

  const sigHex: string | undefined = (
    data as { data?: { signature?: string } } | null
  )?.data?.signature;
  if (!sigHex) {
    console.error("[privy/sign] Privy returned no signature in response data");
    return NextResponse.json(
      { error: "Privy returned no signature." },
      { status: 502 },
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
