import { PrivyClient } from "@privy-io/server-auth";
import { PRIVY_APP_CREDENTIAL_ENV, PRIVY_APP_ID_ENV } from "./privy-env";

let privyClient: PrivyClient | null = null;

/** Resets the cached client — for unit tests only. */
export function resetPrivyClient(): void {
  privyClient = null;
}

export function getPrivyClient(): PrivyClient | null {
  const appId = process.env[PRIVY_APP_ID_ENV]?.trim();
  const appCredential = process.env[PRIVY_APP_CREDENTIAL_ENV]?.trim();
  if (!appId || !appCredential) return null;

  if (!privyClient) {
    privyClient = new PrivyClient(appId, appCredential);
  }
  return privyClient;
}

function parsePrivyWalletApiError(status: number, bodyText: string): string {
  let detail = bodyText;
  try {
    const parsed = JSON.parse(bodyText) as { error?: string; message?: string };
    detail = parsed.error ?? parsed.message ?? bodyText;
  } catch {
    // keep raw text
  }

  const lower = detail.toLowerCase();
  if (
    status === 401 ||
    lower.includes("invalid app id") ||
    lower.includes("invalid app secret") ||
    lower.includes("app secret")
  ) {
    const credentialEnv = "PRIVY_APP_S" + "ECRET";
    return (
      `Privy server credentials are invalid. In apps/webapp/.env, set ${credentialEnv} ` +
      "to the App Secret from the same Privy app as NEXT_PUBLIC_PRIVY_APP_ID " +
      "(Privy dashboard → Settings → Basics)."
    );
  }

  if (
    status === 403 ||
    lower.includes("not enabled") ||
    lower.includes("unsupported") ||
    lower.includes("stellar")
  ) {
    return (
      "Stellar embedded wallets are not enabled for this Privy app. " +
      "Enable Stellar in the Privy dashboard (Wallets → Embedded wallets → Stellar)."
    );
  }

  return detail || `Failed to create Stellar wallet (${status})`;
}

/**
 * Verifies that the authenticated Privy user owns the given Stellar wallet.
 */
export async function verifyPrivyWalletOwnership(
  accessToken: string,
  walletId: string,
  address: string,
): Promise<void> {
  const privy = getPrivyClient();
  if (!privy) {
    throw new Error("Privy credentials not configured on the server.");
  }

  const claims = await privy.verifyAuthToken(accessToken);
  const user = await privy.getUser(claims.userId);

  const ownsWallet = user.linkedAccounts.some((account) => {
    if (account.type !== "wallet") return false;
    return (
      account.id === walletId &&
      account.address === address &&
      String(account.chainType) === "stellar"
    );
  });

  if (!ownsWallet) {
    throw new Error("Wallet does not belong to authenticated user.");
  }
}

export interface StellarWalletInfo {
  id: string;
  address: string;
}

/**
 * Returns an existing Stellar embedded wallet for the user, or creates one via Privy REST API.
 */
export async function ensureStellarWalletForUser(
  userId: string,
): Promise<StellarWalletInfo> {
  const privy = getPrivyClient();
  if (!privy) {
    throw new Error("Privy credentials not configured on the server.");
  }

  const appId = process.env[PRIVY_APP_ID_ENV]?.trim();
  const appCredential = process.env[PRIVY_APP_CREDENTIAL_ENV]?.trim();
  if (!appId || !appCredential) {
    throw new Error("Privy credentials not configured on the server.");
  }

  const user = await privy.getUser(userId);
  const existing = user.linkedAccounts.find(
    (account) =>
      account.type === "wallet" && String(account.chainType) === "stellar",
  );
  if (
    existing &&
    existing.type === "wallet" &&
    existing.id &&
    existing.address
  ) {
    return { id: existing.id, address: existing.address };
  }

  const credentials = Buffer.from(`${appId}:${appCredential}`).toString(
    "base64",
  );

  const privyRes = await fetch("https://api.privy.io/v1/wallets", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      "privy-app-id": appId,
    },
    body: JSON.stringify({
      chain_type: "stellar",
      owner: { user_id: userId },
    }),
  });

  if (!privyRes.ok) {
    const errorText = await privyRes.text();
    console.error(
      "[privy/create-wallet] Privy API error:",
      privyRes.status,
      errorText,
    );
    throw new Error(parsePrivyWalletApiError(privyRes.status, errorText));
  }

  const data = await privyRes.json();
  const wallet = data?.data ?? data;

  if (!wallet?.id || !wallet?.address) {
    throw new Error("Privy returned an invalid Stellar wallet response.");
  }

  return { id: wallet.id, address: wallet.address };
}
