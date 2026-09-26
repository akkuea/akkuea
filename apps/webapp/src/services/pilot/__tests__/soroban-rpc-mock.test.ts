import { describe, expect, it } from "bun:test";
import { scValToNative } from "@stellar/stellar-sdk";
import {
  encodeEvidenceRecordScVal,
  encodeScVal,
  PilotRpcScenario,
  scenarios,
} from "../../../../e2e/fixtures/soroban-rpc";

describe("Soroban RPC Mock Layer", () => {
  describe("encodeScVal", () => {
    it("encodes primitives and objects into valid ScVal types", () => {
      const boolVal = encodeScVal(true);
      expect(scValToNative(boolVal)).toBe(true);

      const strVal = encodeScVal("hello");
      expect(scValToNative(strVal)).toBe("hello");

      const numVal = encodeScVal(42);
      expect(scValToNative(numVal)).toBe(42);

      const bigintVal = encodeScVal(BigInt(1000));
      expect(scValToNative(bigintVal)).toBe(BigInt(1000));

      const nullVal = encodeScVal(null);
      expect(scValToNative(nullVal)).toBeNull();
    });
  });

  describe("encodeEvidenceRecordScVal", () => {
    it("encodes a typed PilotEvidenceRecord into Soroban ScVal struct map", () => {
      const cycleState = {
        cycleId: "2026-03",
        status: "Submitted" as const,
        totalIncome: BigInt(12_400_0000000),
        evidenceLink: "https://example.com/2026-03.pdf",
        evidenceHashHex:
          "4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f",
        submittedAt: 1770000000,
        recordedAt: 1770000000,
        reviewedAt: 0,
        reviewReason: "",
        distributed: false,
        distributedAt: 0,
      };

      const scVal = encodeEvidenceRecordScVal(cycleState);
      const raw = scValToNative(scVal) as {
        cycle_id: string;
        total_income: bigint;
        status: [string];
        evidence_link: string;
        distributed: boolean;
      };

      expect(raw.cycle_id).toBe("2026-03");
      expect(raw.total_income).toBe(BigInt(12_400_0000000));
      expect(raw.status[0]).toBe("Submitted");
      expect(raw.evidence_link).toBe("https://example.com/2026-03.pdf");
      expect(raw.distributed).toBe(false);
    });

    it("returns void ScVal when record is undefined or empty", () => {
      const scVal = encodeEvidenceRecordScVal(undefined);
      expect(scValToNative(scVal)).toBeNull();
    });
  });

  describe("PilotRpcScenario Builder", () => {
    it("fluently builds scenarios with cycle states", () => {
      const scenario = new PilotRpcScenario()
        .cycle("2026-01")
        .distributedOnTime(BigInt(10_000_0000000))
        .cycle("2026-02")
        .disputed("Discrepancy in reported rent")
        .cycle("2026-03")
        .submitted(BigInt(12_000_0000000))
        .setPaused(true)
        .setHoldings({
          balance: BigInt(500_0000000),
          totalSupply: BigInt(1_000_0000000),
          whitelisted: true,
        });

      expect(scenario.getIsPaused()).toBe(true);
      expect(scenario.getHoldings().balance).toBe(BigInt(500_0000000));
      expect(scenario.getCycle("2026-01")?.distributed).toBe(true);
      expect(scenario.getCycle("2026-02")?.status).toBe("Disputed");
      expect(scenario.getCycle("2026-02")?.reviewReason).toBe(
        "Discrepancy in reported rent",
      );
      expect(scenario.getCycle("2026-03")?.status).toBe("Submitted");
    });

    it("supports predefined scenarios", () => {
      const defaultScenario = scenarios.defaultPilot();
      expect(defaultScenario.getCycles().length).toBeGreaterThanOrEqual(3);

      const escalatedScenario = scenarios.escalated();
      expect(escalatedScenario.getCycle("2026-02")).toBeUndefined();
      expect(escalatedScenario.getCycle("2026-03")).toBeUndefined();

      const pausedScenario = scenarios.paused();
      expect(pausedScenario.getIsPaused()).toBe(true);
    });
  });
});
