import { Horizon } from "stellar-sdk";

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

/** Minimal Horizon server interface — satisfied by Horizon.Server and injectable mocks */
export interface HorizonServerLike {
  loadAccount(address: string): Promise<AccountRecord>;
}

/**
 * Fetches the native XLM balance for a Stellar address from Horizon.
 * Returns "0" for accounts not yet on-chain (unfunded) and for network errors.
 */
export async function fetchBalance(
  address: string,
  network: "testnet" | "mainnet" = "testnet",
  server?: HorizonServerLike,
): Promise<string> {
  const srv: HorizonServerLike =
    server ??
    (new Horizon.Server(HORIZON_URLS[network]) as unknown as HorizonServerLike);
  try {
    const account = await srv.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native?.balance ?? "0";
  } catch (error) {
    const res = (error as { response?: { status?: number } }).response;
    if (res?.status !== 404) {
      console.warn("[fetchBalance] Failed to fetch balance:", error);
    }
    return "0";
  }
}
