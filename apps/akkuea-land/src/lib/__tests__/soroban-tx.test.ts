/**
 * soroban-tx - contract ID wiring regression tests
 *
 * Before this fix, PROPERTY_NFT_CONTRACT_ID / GAME_ENGINE_CONTRACT_ID /
 * MARKETPLACE_CONTRACT_ID fell back to IDs from the unrelated defi-rwa
 * deployment (contracts.testnet.json - REAL_ESTATE_TOKEN / DEFI_LENDING)
 * whenever an env var override was not set, so every simulated transaction
 * silently targeted the wrong contract.
 *
 * These tests import the real (unmocked) module and confirm every contract
 * ID + the treasury address now default to the actually-deployed game
 * contracts recorded in game-contracts.testnet.json.
 */

import { describe, it, expect, vi, afterEach } from "bun:test";
import {
  Account,
  Keypair,
  nativeToScVal,
  type Transaction,
} from "@stellar/stellar-sdk";
import gameContractsTestnet from "@akkuea/shared/game-contracts.testnet.json";
import defiRwaContractsTestnet from "@akkuea/shared/contracts.testnet.json";
// Other test files replace "@/lib/soroban-tx" with vi.mock, and Bun shares
// module mocks across files in one run. A query-suffixed specifier loads a
// separate, unmocked instance so all tests here always hit the real code.
const UNMOCKED_SOROBAN_TX = "../soroban-tx?unmocked";
const {
  PROPERTY_NFT_CONTRACT_ID,
  GAME_ENGINE_CONTRACT_ID,
  MARKETPLACE_CONTRACT_ID,
  LAND_TOKEN_CONTRACT_ID,
  TREASURY_ADDRESS,
  propertyIdToU32,
  buildApproveMarketplaceXdr,
  buildFaucetClaimXdr,
  fetchLandBalance,
  getSorobanServer,
  landUnitsToDecimal,
} = (await import(UNMOCKED_SOROBAN_TX)) as typeof import("@/lib/soroban-tx");

describe("soroban-tx - game contract ID resolution", () => {
  it("PROPERTY_NFT_CONTRACT_ID defaults to the deployed GAME_PROPERTY_NFT contract", () => {
    expect(PROPERTY_NFT_CONTRACT_ID).toBe(
      gameContractsTestnet.contracts.GAME_PROPERTY_NFT.contractId,
    );
  });

  it("GAME_ENGINE_CONTRACT_ID defaults to the deployed GAME_ENGINE contract", () => {
    expect(GAME_ENGINE_CONTRACT_ID).toBe(
      gameContractsTestnet.contracts.GAME_ENGINE.contractId,
    );
  });

  it("MARKETPLACE_CONTRACT_ID defaults to the deployed GAME_MARKETPLACE contract", () => {
    expect(MARKETPLACE_CONTRACT_ID).toBe(
      gameContractsTestnet.contracts.GAME_MARKETPLACE.contractId,
    );
  });

  it("LAND_TOKEN_CONTRACT_ID defaults to the deployed GAME_LAND_TOKEN contract", () => {
    expect(LAND_TOKEN_CONTRACT_ID).toBe(
      gameContractsTestnet.contracts.GAME_LAND_TOKEN.contractId,
    );
  });

  it("TREASURY_ADDRESS defaults to the game contracts deployer, not a placeholder string", () => {
    expect(TREASURY_ADDRESS).toBe(gameContractsTestnet.deployedBy);
    expect(TREASURY_ADDRESS).not.toBe("GBTREASURY");
    // A real Stellar public key: 56 chars, starts with G.
    expect(TREASURY_ADDRESS).toMatch(/^G[A-Z0-9]{55}$/);
  });

  it("never falls back to the unrelated defi-rwa deployment", () => {
    expect(PROPERTY_NFT_CONTRACT_ID).not.toBe(
      defiRwaContractsTestnet.contracts.REAL_ESTATE_TOKEN,
    );
    expect(GAME_ENGINE_CONTRACT_ID).not.toBe(
      defiRwaContractsTestnet.contracts.DEFI_LENDING,
    );
    expect(MARKETPLACE_CONTRACT_ID).not.toBe(
      defiRwaContractsTestnet.contracts.REAL_ESTATE_TOKEN,
    );
  });

  it("every game contract ID is unique (no accidental cross-wiring)", () => {
    const ids = [
      PROPERTY_NFT_CONTRACT_ID,
      GAME_ENGINE_CONTRACT_ID,
      MARKETPLACE_CONTRACT_ID,
      LAND_TOKEN_CONTRACT_ID,
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("soroban-tx - propertyIdToU32 (regression, still real)", () => {
  it('still converts "prop-3-7" to 67 with the real module import path', () => {
    expect(propertyIdToU32("prop-3-7")).toBe(67);
  });
});

describe("soroban-tx - new real-contract builders exist", () => {
  it("exports buildFaucetClaimXdr for the onboarding LAND claim step", () => {
    expect(typeof buildFaucetClaimXdr).toBe("function");
  });

  it("exports buildApproveMarketplaceXdr for the list-for-sale approval step", () => {
    expect(typeof buildApproveMarketplaceXdr).toBe("function");
  });
});

describe("soroban-tx - landUnitsToDecimal", () => {
  it("converts 7-decimal base units to whole LAND", () => {
    expect(landUnitsToDecimal(BigInt("10000000000"))).toBe("1000");
    expect(landUnitsToDecimal(BigInt("15000000"))).toBe("1.5");
    expect(landUnitsToDecimal(BigInt("0"))).toBe("0");
  });

  it("keeps full precision for the smallest unit and large balances", () => {
    expect(landUnitsToDecimal(BigInt("1"))).toBe("0.0000001");
    expect(landUnitsToDecimal(BigInt("123456789012345678901234567"))).toBe(
      "12345678901234567890.1234567",
    );
  });
});

describe("soroban-tx - fetchLandBalance", () => {
  const address = Keypair.random().publicKey();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockServer(simulation: unknown) {
    const server = getSorobanServer();
    vi.spyOn(server, "getAccount").mockResolvedValue(new Account(address, "1"));
    return vi
      .spyOn(server, "simulateTransaction")
      .mockResolvedValue(simulation as never);
  }

  function simulatedFunctionName(call: unknown[]): string {
    const tx = call[0] as Transaction;
    const op = tx.operations[0] as unknown as {
      func: { invokeContract: { functionName: { toString(): string } } };
    };
    return op.func.invokeContract.functionName.toString();
  }

  it("simulates the token's balance function and returns whole LAND", async () => {
    const simulate = mockServer({
      result: {
        retval: nativeToScVal(BigInt("10000000000"), { type: "i128" }),
      },
    });

    await expect(fetchLandBalance(address)).resolves.toBe("1000");
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(simulatedFunctionName(simulate.mock.calls[0])).toBe("balance");
  });

  it("returns fractional balances without float rounding", async () => {
    mockServer({
      result: { retval: nativeToScVal(BigInt("15000000"), { type: "i128" }) },
    });

    await expect(fetchLandBalance(address)).resolves.toBe("1.5");
  });

  it("throws when the simulation fails", async () => {
    mockServer({ error: "HostError: missing function" });

    await expect(fetchLandBalance(address)).rejects.toThrow(
      "LAND balance check failed",
    );
  });
});
