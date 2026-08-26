import { describe, test, expect } from "bun:test";
import {
  PilotWhitelistClient,
  PilotIncomeTokenClient,
  PilotPayoutSplitClient,
} from "../src/contracts/pilot";
import {
  WhitelistError,
  IncomeTokenError,
  PayoutError,
} from "../src/contracts/pilot";

describe("generated pilot clients", () => {
  const mockConfig = {
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    rpcUrl: "https://mock-rpc.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  };

  test("constructs PilotWhitelistClient with mock config", () => {
    const client = new PilotWhitelistClient(mockConfig);
    expect(client).toBeDefined();
    expect(client.options.contractId).toBe(mockConfig.contractId);
  });

  test("constructs PilotIncomeTokenClient with mock config", () => {
    const client = new PilotIncomeTokenClient(mockConfig);
    expect(client).toBeDefined();
    expect(client.options.contractId).toBe(mockConfig.contractId);
  });

  test("constructs PilotPayoutSplitClient with mock config", () => {
    const client = new PilotPayoutSplitClient(mockConfig);
    expect(client).toBeDefined();
    expect(client.options.contractId).toBe(mockConfig.contractId);
  });

  test("WhitelistError contains expected error codes", () => {
    expect(WhitelistError[1].message).toBe("AlreadyInitialized");
    expect(WhitelistError[2].message).toBe("NotInitialized");
    expect(WhitelistError[3].message).toBe("Unauthorized");
  });

  test("IncomeTokenError contains expected error codes", () => {
    expect(IncomeTokenError[1].message).toBe("AlreadyInitialized");
    expect(IncomeTokenError[4].message).toBe("AlreadyMinted");
    expect(IncomeTokenError[8].message).toBe("HolderNotApproved");
  });

  test("PayoutError contains expected error codes", () => {
    expect(PayoutError[1].message).toBe("AlreadyInitialized");
    expect(PayoutError[4].message).toBe("ContractPaused");
    expect(PayoutError[10].message).toBe("CycleAlreadyDistributed");
  });
});

/**
 * Live integration test against testnet.
 *
 * This test calls the real pilot-whitelist contract on Stellar testnet
 * to verify the generated client's `is_approved` read method returns a
 * boolean without any manual XDR handling by the caller.
 *
 * Run manually: bun test tests/pilotClients.test.ts -- --test-name-pattern "live"
 *
 * Skipped in CI because testnet is not available in CI environments.
 */
describe("pilot-whitelist live testnet verification", () => {
  test.skip("is_approved returns a boolean for a testnet address", async () => {
    const client = new PilotWhitelistClient({
      contractId: "CAOIML5WZYESSX5CPRFHA2OY7UXVW2ISJLL362OVX7MY3G7CMRWN3QA4",
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    // Use the contract admin address as a known test address.
    // The result should be a boolean regardless of the input.
    const result = await client.is_approved({
      address: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });

    expect(typeof result.result).toBe("boolean");
  });
});
