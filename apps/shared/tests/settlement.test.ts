import { describe, test, expect } from "bun:test";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import type { PilotPayoutSplitClientInterface } from "../src/contracts/pilot/payout-split.js";
import {
  readDistributionSummary,
  readHolderSettlement,
  readWithheldBalance,
  readTotalWithheld,
  readCurrencyPreference,
  readExitStatus,
} from "../src/contracts/pilot/settlement.js";

describe("contracts/pilot/settlement.ts", () => {
  describe("readDistributionSummary", () => {
    test("missing simulationData or retval returns undefined", async () => {
      const mockClientNoSim = {
        get_distribution_summary: async () => ({}) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      expect(
        await readDistributionSummary(mockClientNoSim, "cycle-1"),
      ).toBeUndefined();

      const mockClientNoRetval = {
        get_distribution_summary: async () =>
          ({
            simulationData: { result: {} },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      expect(
        await readDistributionSummary(mockClientNoRetval, "cycle-1"),
      ).toBeUndefined();
    });

    test("void retval returns undefined", async () => {
      const mockClientVoid = {
        get_distribution_summary: async () =>
          ({
            simulationData: {
              result: { retval: xdr.ScVal.scvVoid() },
            },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      expect(
        await readDistributionSummary(mockClientVoid, "cycle-1"),
      ).toBeUndefined();
    });

    test("snake_case summaries map to camelCase with bigints preserved", async () => {
      const raw = {
        cycle_id: "cycle-2026-04",
        total_income: 10_000_000_000n,
        platform_fee: 500_000_000n,
        holder_amount: 9_500_000_000n,
        holder_count: 50,
        distributed_total: 9_300_000_000n,
        dust: 15n,
        eurc_distributed_total: 8_200_000_000n,
        swaps_failed: 3,
        undistributed_failed_swaps: 200_000_000n,
      };

      const mockClient = {
        get_distribution_summary: async () =>
          ({
            simulationData: {
              result: { retval: nativeToScVal(raw) },
            },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      const summary = await readDistributionSummary(
        mockClient,
        "cycle-2026-04",
      );

      expect(summary).toBeDefined();
      expect(summary).toEqual({
        cycleId: "cycle-2026-04",
        totalIncome: 10_000_000_000n,
        platformFee: 500_000_000n,
        holderAmount: 9_500_000_000n,
        holderCount: 50,
        distributedTotal: 9_300_000_000n,
        dust: 15n,
        eurcDistributedTotal: 8_200_000_000n,
        swapsFailed: 3,
        undistributedFailedSwaps: 200_000_000n,
      });

      // Verify explicit types
      expect(typeof summary!.totalIncome).toBe("bigint");
      expect(typeof summary!.platformFee).toBe("bigint");
      expect(typeof summary!.holderAmount).toBe("bigint");
      expect(typeof summary!.distributedTotal).toBe("bigint");
      expect(typeof summary!.dust).toBe("bigint");
      expect(typeof summary!.eurcDistributedTotal).toBe("bigint");
      expect(typeof summary!.undistributedFailedSwaps).toBe("bigint");
      expect(typeof summary!.holderCount).toBe("number");
      expect(typeof summary!.swapsFailed).toBe("number");
    });
  });

  describe("readHolderSettlement", () => {
    test("missing or void retval returns undefined", async () => {
      const mockClientNoRetval = {
        get_holder_settlement: async () => ({}) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      expect(
        await readHolderSettlement(mockClientNoRetval, "cycle-1", "GA123"),
      ).toBeUndefined();

      const mockClientVoid = {
        get_holder_settlement: async () =>
          ({
            simulationData: {
              result: { retval: xdr.ScVal.scvVoid() },
            },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      expect(
        await readHolderSettlement(mockClientVoid, "cycle-1", "GA123"),
      ).toBeUndefined();
    });

    test('["Eurc"]/["Usdc"] map to "eurc"/"usdc"', async () => {
      const rawEurc = {
        holder: "GA_EURC_HOLDER",
        cycle_id: "cycle-1",
        currency: ["Eurc"],
        amount: 850_000_000n,
        usdc_share: 1_000_000_000n,
        withheld: false,
      };

      const mockClientEurc = {
        get_holder_settlement: async () =>
          ({
            simulationData: {
              result: { retval: nativeToScVal(rawEurc) },
            },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      const eurcResult = await readHolderSettlement(
        mockClientEurc,
        "cycle-1",
        "GA_EURC_HOLDER",
      );

      expect(eurcResult).toEqual({
        holder: "GA_EURC_HOLDER",
        cycleId: "cycle-1",
        currency: "eurc",
        amount: 850_000_000n,
        usdcShare: 1_000_000_000n,
        withheld: false,
      });
      expect(typeof eurcResult!.amount).toBe("bigint");
      expect(typeof eurcResult!.usdcShare).toBe("bigint");

      const rawUsdc = {
        holder: "GB_USDC_HOLDER",
        cycle_id: "cycle-1",
        currency: ["Usdc"],
        amount: 1_000_000_000n,
        usdc_share: 1_000_000_000n,
        withheld: true,
      };

      const mockClientUsdc = {
        get_holder_settlement: async () =>
          ({
            simulationData: {
              result: { retval: nativeToScVal(rawUsdc) },
            },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      const usdcResult = await readHolderSettlement(
        mockClientUsdc,
        "cycle-1",
        "GB_USDC_HOLDER",
      );

      expect(usdcResult).toEqual({
        holder: "GB_USDC_HOLDER",
        cycleId: "cycle-1",
        currency: "usdc",
        amount: 1_000_000_000n,
        usdcShare: 1_000_000_000n,
        withheld: true,
      });
    });
  });

  describe("readExitStatus", () => {
    test("missing or void retval returns undefined", async () => {
      const mockClientNoRetval = {
        exit_status: async () => ({}) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      expect(await readExitStatus(mockClientNoRetval)).toBeUndefined();

      const mockClientVoid = {
        exit_status: async () =>
          ({
            simulationData: {
              result: { retval: xdr.ScVal.scvVoid() },
            },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      expect(await readExitStatus(mockClientVoid)).toBeUndefined();
    });

    test("readExitStatus converts the bigint timestamp to a number", async () => {
      const rawExit = {
        reason: "pilot_successfully_concluded",
        at: 1718000000n,
      };

      const mockClient = {
        exit_status: async () =>
          ({
            simulationData: {
              result: { retval: nativeToScVal(rawExit) },
            },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      const exitStatus = await readExitStatus(mockClient);

      expect(exitStatus).toBeDefined();
      expect(exitStatus).toEqual({
        reason: "pilot_successfully_concluded",
        at: 1718000000,
      });
      expect(typeof exitStatus!.at).toBe("number");
      expect(exitStatus!.at).toBe(1718000000);
    });
  });

  describe("withheld and preference readers", () => {
    test("readWithheldBalance returns direct simulation result", async () => {
      const mockClient = {
        get_withheld_balance: async () =>
          ({
            result: 75_000_000n,
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      const balance = await readWithheldBalance(mockClient, "GA123");
      expect(balance).toBe(75_000_000n);
    });

    test("readTotalWithheld returns direct simulation result", async () => {
      const mockClient = {
        total_withheld_balance: async () =>
          ({
            result: 500_000_000n,
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      const total = await readTotalWithheld(mockClient);
      expect(total).toBe(500_000_000n);
    });

    test("readCurrencyPreference maps Eurc and Usdc tagged unions to strings", async () => {
      const mockClientEurc = {
        get_currency_preference: async () =>
          ({
            result: { tag: "Eurc", values: undefined },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      expect(await readCurrencyPreference(mockClientEurc, "GA123")).toBe(
        "eurc",
      );

      const mockClientUsdc = {
        get_currency_preference: async () =>
          ({
            result: { tag: "Usdc", values: undefined },
          }) as any,
      } as unknown as PilotPayoutSplitClientInterface;

      expect(await readCurrencyPreference(mockClientUsdc, "GA123")).toBe(
        "usdc",
      );
    });
  });
});
