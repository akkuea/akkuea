import { describe, it, expect, beforeEach, mock } from "bun:test";
import { treasuryApi } from "../treasury";
import type { TreasuryPortfolio } from "../treasury";
import { setupMockFetch, wrapFetchMock } from "./helpers";

const TESTNET_VAULT =
  "CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN";
const TESTNET_ASSET =
  "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU";

function portfolioFixture(): TreasuryPortfolio {
  return {
    positions: [
      {
        venue: "defindex-blend",
        label: "DeFindex Blend strategy",
        provider: "DeFindex",
        strategy: "Lends the deposited USDC into Blend",
        assetCode: "USDC",
        vaultContractId: TESTNET_VAULT,
        assetContractId: TESTNET_ASSET,
        shares: "25.0000000",
        positionValue: "25.1234567",
        vaultTotalManaged: "932.1856304",
        vaultIdleAmount: "932.1856304",
        vaultInvestedAmount: "0.0000000",
        strategies: [
          {
            address: "CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY",
            amount: "0.0000000",
            paused: false,
          },
        ],
        paused: false,
        fees: { vaultBps: 100, protocolBps: 2000 },
        explorer: {
          vault: `https://stellar.expert/explorer/testnet/contract/${TESTNET_VAULT}`,
          asset: `https://stellar.expert/explorer/testnet/contract/${TESTNET_ASSET}`,
          account: null,
        },
        readAt: "2026-08-18T00:00:00.000Z",
      },
    ],
    unconfigured: [],
    unavailable: [],
    sourceAccount: null,
    network: "testnet",
  };
}

describe("Treasury API", () => {
  beforeEach(() => {
    global.fetch = wrapFetchMock(
      mock(() => {
        throw new Error("fetch not mocked");
      }),
    );
  });

  describe("getPortfolio", () => {
    it("unwraps the API envelope and returns positions as decimal strings", async () => {
      const { fetchMock, calls } = setupMockFetch({
        body: { success: true, data: portfolioFixture() },
      });
      global.fetch = fetchMock;

      const portfolio = await treasuryApi.getPortfolio();

      expect(calls[0]!.url).toContain("/api/v1/treasury");
      expect(portfolio.positions).toHaveLength(1);
      // Amounts stay strings so no precision is lost on the way to the UI.
      expect(portfolio.positions[0]!.positionValue).toBe("25.1234567");
      expect(portfolio.positions[0]!.explorer.vault).toContain(
        "stellar.expert",
      );
    });

    it("preserves venues the API could not read", async () => {
      const fixture = portfolioFixture();
      fixture.unavailable = [
        { venue: "etherfuse-stablebond", reason: "RPC unavailable" },
      ];

      const { fetchMock } = setupMockFetch({
        body: { success: true, data: fixture },
      });
      global.fetch = fetchMock;

      const portfolio = await treasuryApi.getPortfolio();

      expect(portfolio.unavailable).toEqual([
        { venue: "etherfuse-stablebond", reason: "RPC unavailable" },
      ]);
    });

    it("retries a 503 and then propagates the error rather than showing an empty position", async () => {
      const { fetchMock, calls } = setupMockFetch({
        status: 503,
        body: {
          success: false,
          code: "TREASURY_VENUE_NOT_CONFIGURED",
          message: "no venue configured",
        },
      });
      global.fetch = fetchMock;

      await expect(treasuryApi.getPortfolio()).rejects.toThrow();
      // The shared client treats 5xx as retryable: 1 attempt plus 3 retries.
      expect(calls).toHaveLength(4);
    }, 20_000);
  });

  describe("getHistory", () => {
    it("requests the given limit and returns movements and snapshots", async () => {
      const { fetchMock, calls } = setupMockFetch({
        body: {
          success: true,
          data: {
            transactions: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                venue: "defindex-blend",
                operation: "deposit",
                status: "submitted",
                assetCode: "USDC",
                amount: "10.0000000",
                shares: null,
                txHash: "abc",
                explorerUrl: "https://stellar.expert/explorer/testnet/tx/abc",
                errorName: null,
                errorCode: null,
                requestedBy: "internal-operations",
                createdAt: "2026-08-18T00:00:00.000Z",
              },
            ],
            snapshots: [],
          },
        },
      });
      global.fetch = fetchMock;

      const history = await treasuryApi.getHistory(5);

      expect(calls[0]!.url).toContain("/api/v1/treasury/history?limit=5");
      expect(history.transactions).toHaveLength(1);
      expect(history.transactions[0]!.explorerUrl).toContain("/tx/abc");
    });
  });
});
