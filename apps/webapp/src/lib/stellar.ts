import { Horizon } from "@stellar/stellar-sdk";

const HORIZON_URLS: Record<"testnet" | "mainnet", string> = {
  testnet: "https://horizon-testnet.stellar.org",
  mainnet: "https://horizon.stellar.org",
};

interface BalanceLine {
  asset_type: string;
  balance: string;
}

interface AccountRecord {
  balances: BalanceLine[];
}

/** Minimal Horizon server interface - satisfied by Horizon.Server and injectable mocks */
export interface HorizonServerLike {
  loadAccount(address: string): Promise<AccountRecord>;
}

/** Discriminated union result type for fetchBalance */
export type BalanceResult =
  | { status: "ok"; balance: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

/**
 * Fetches the native XLM balance for a Stellar address from Horizon.
 * Returns a discriminated union to distinguish between:
 * - ok: Account exists and balance was fetched successfully
 * - not_found: Account does not exist on-chain (unfunded)
 * - error: Network or other error occurred
 */
export async function fetchBalance(
  address: string,
  network: "testnet" | "mainnet" = "testnet",
  server?: HorizonServerLike,
): Promise<BalanceResult> {
  const srv: HorizonServerLike =
    server ??
    (new Horizon.Server(HORIZON_URLS[network]) as unknown as HorizonServerLike);
  try {
    const account = await srv.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return { status: "ok", balance: native?.balance ?? "0" };
  } catch (error) {
    const res = (error as { response?: { status?: number } }).response;
    if (res?.status === 404) {
      return { status: "not_found" };
    }
    console.warn("[fetchBalance] Failed to fetch balance:", error);
    return { status: "error", message: (error as Error).message };
  }
}
