import { NextRequest, NextResponse } from "next/server";
import { Transaction, Keypair, xdr } from "@stellar/stellar-sdk";
import { verifyPrivyWalletOwnership } from "@/lib/privy-server";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "@/lib/privy-env";

/**
 * POST /api/privy/sign
 *
 * Server-side proxy for Privy's raw_sign endpoint.
 * Stellar is a Tier-2 chain in Privy — signing goes through the REST API,
 * not the React SDK. The app secret must never be exposed to the browser.
 *
 * Request body:
 *   { walletId: string; address: string; txXdr: string; networkPassphrase: string }
 *
 * Headers:
 *   Authorization: Bearer <privy_access_token>
 *
 * Flow:
 *   1. Verify the caller owns the wallet via Privy access token
 *   2. Deserialize the XDR into a Transaction
 *   3. Hash it with the network passphrase (32-byte Ed25519 signing payload)
 *   4. POST the hash to Privy's raw_sign API
 *   5. Attach the returned signature to the transaction
 *   6. Return the signed XDR
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

  let walletId: string;
  let address: string;
  let txXdr: string;
  let networkPassphrase: string;

  try {
    const body = await req.json();
    walletId = body.walletId;
    address = body.address;
    txXdr = body.txXdr;
    networkPassphrase = body.networkPassphrase;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (!walletId || !address || !txXdr || !networkPassphrase) {
    return NextResponse.json(
      {
        error: "walletId, address, txXdr, and networkPassphrase are required.",
      },
      { status: 400 },
    );
  }

  try {
    await verifyPrivyWalletOwnership(accessToken, walletId, address);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    const status = message.includes("not configured") ? 500 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  let tx: Transaction;
  try {
    tx = new Transaction(txXdr, networkPassphrase);
  } catch (e) {
    return NextResponse.json(
      {
        error: `Invalid transaction XDR: ${e instanceof Error ? e.message : e}`,
      },
      { status: 400 },
    );
  }

  const txHash = tx.hash();
  const hashHex = "0x" + txHash.toString("hex");

  const credentials = Buffer.from(`${appId}:${appCredential}`).toString(
    "base64",
  );

  const privyRes = await fetch(
    `https://api.privy.io/v1/wallets/${walletId}/raw_sign`,
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

  if (!privyRes.ok) {
    const errorText = await privyRes.text();
    console.error("[privy/sign] Privy API error:", privyRes.status, errorText);
    return NextResponse.json(
      { error: `Privy signing failed: ${privyRes.status}` },
      { status: privyRes.status },
    );
  }

  const data = await privyRes.json();
  const sigHex: string = data?.data?.signature;

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
