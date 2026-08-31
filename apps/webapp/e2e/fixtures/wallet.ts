import type { Page } from "@playwright/test";

/**
 * localStorage key the auth Zustand store (see
 * `src/components/auth/store/data/slices/authentication.slice.ts`) persists
 * wallet connection state under.
 */
const WALLET_STORAGE_KEY = "akkuea-wallet-storage";

export const MOCK_OPERATOR_WALLET =
  "GA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAX2";

/**
 * Seeds the persisted wallet store in `localStorage` so the app believes a
 * Stellar wallet is already connected on first render, without driving a real
 * wallet extension (no browser extension is available in a headless CI
 * browser, and the pilot flow doesn't warrant standing up one just for this
 * suite).
 *
 * Must be called before `page.goto()`: `addInitScript` only affects
 * navigations that happen after it's registered.
 */
export async function mockConnectedWallet(
  page: Page,
  address = MOCK_OPERATOR_WALLET,
): Promise<void> {
  await page.addInitScript(
    ({ key, addr }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            address: addr,
            balance: null,
            balanceStatus: null,
            balanceError: null,
            isConnected: true,
            selectedWalletId: "stellar-wallets-kit",
            network: "testnet",
          },
          version: 2,
        }),
      );
    },
    { key: WALLET_STORAGE_KEY, addr: address },
  );
}
