import { NextRequest, NextResponse } from "next/server";
import { getPrivyClient, ensureStellarWalletForUser } from "@/lib/privy-server";

function mapCreateWalletError(error: unknown): {
  message: string;
  status: number;
} {
  const rawMessage =
    error instanceof Error ? error.message : "Failed to create wallet";

  console.error("[privy/create-wallet] Error:", rawMessage);

  if (rawMessage.includes("not configured")) {
    return {
      message: "Privy credentials not configured on the server.",
      status: 500,
    };
  }

  if (
    rawMessage.includes("Missing Privy access token") ||
    rawMessage.includes("JWS") ||
    rawMessage.includes("auth token")
  ) {
    return { message: "Invalid or missing access token.", status: 401 };
  }

  if (rawMessage.includes("Privy server credentials are invalid")) {
    return {
      message: "Privy server credentials are invalid.",
      status: 500,
    };
  }

  if (rawMessage.includes("Stellar embedded wallets are not enabled")) {
    return {
      message: "Stellar embedded wallets are not enabled for this Privy app.",
      status: 403,
    };
  }

  return { message: "Failed to create wallet.", status: 502 };
}

/**
 * POST /api/privy/create-wallet
 *
 * Ensures the authenticated user has a Stellar embedded wallet.
 * Creates one via Privy REST API if missing:
 *   { chain_type: "stellar", owner: { user_id: "<privy-did>" } }
 */
export async function POST(req: NextRequest) {
  const privy = getPrivyClient();
  if (!privy) {
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

  try {
    const claims = await privy.verifyAuthToken(accessToken);
    const wallet = await ensureStellarWalletForUser(claims.userId);
    return NextResponse.json(wallet);
  } catch (e) {
    const { message, status } = mapCreateWalletError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
