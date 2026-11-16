import { describe, expect, test } from "bun:test";
import { DefiLendingContractClient } from "../src/contracts/defiLending";
import type { Client as GeneratedClient } from "../src/contracts/generated/rwaDefi";

describe("DefiLendingContractClient", () => {
  const mockConfig = {
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    rpcUrl: "https://mock-rpc.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  };

  test("constructs fromConfig with generated rwaDefi client", () => {
    const client = DefiLendingContractClient.fromConfig(mockConfig);
    expect(client).toBeDefined();
  });

  test("passes close_factor to create_pool", async () => {
    let capturedArgs: unknown;
    const fakeGenerated = {
      create_pool: async (args: unknown) => {
        capturedArgs = args;
        return {} as Awaited<ReturnType<GeneratedClient["create_pool"]>>;
      },
    } as unknown as GeneratedClient;

    const client = new DefiLendingContractClient(fakeGenerated);
    await client.createPool({
      admin: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      poolId: "usdc-pool",
      name: "USDC Pool",
      asset: "USDC",
      assetAddress: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      collateralFactor: 750_000_000_000_000_000n,
      liquidationThreshold: 800_000_000_000_000_000n,
      liquidationPenalty: 50_000_000_000_000_000n,
      closeFactor: 500_000_000_000_000_000n,
      reserveFactor: 1000,
    });

    expect(capturedArgs).toEqual({
      admin: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      pool_id: "usdc-pool",
      name: "USDC Pool",
      asset: "USDC",
      asset_address: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      collateral_factor: 750_000_000_000_000_000n,
      liquidation_threshold: 800_000_000_000_000_000n,
      liquidation_penalty: 50_000_000_000_000_000n,
      close_factor: 500_000_000_000_000_000n,
      reserve_factor: 1000,
    });
  });

  test("maps 4-argument liquidate call to generated client", async () => {
    let capturedArgs: unknown;
    const fakeGenerated = {
      liquidate: async (args: unknown) => {
        capturedArgs = args;
        return {} as Awaited<ReturnType<GeneratedClient["liquidate"]>>;
      },
    } as unknown as GeneratedClient;

    const client = new DefiLendingContractClient(fakeGenerated);
    await client.liquidate({
      liquidator: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      poolId: "usdc-pool",
      borrowerAddress:
        "GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON",
      debtToCover: 250_0000000n,
    });

    expect(capturedArgs).toEqual({
      liquidator: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
      pool_id: "usdc-pool",
      borrower_address:
        "GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON",
      debt_to_cover: 250_0000000n,
    });
  });
});
