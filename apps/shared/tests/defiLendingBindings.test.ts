import { describe, expect, test } from "bun:test";
import { Address, Keypair, scValToNative } from "@stellar/stellar-sdk";
import { Client as RwaDefiClient } from "../src/contracts/generated/rwaDefi";
import { DefiLendingContractClient } from "../src/contracts/defiLending";

const config = {
  contractId: "CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4",
  rpcUrl: "https://mock-rpc.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
};

function specInputs(name: string): string[] {
  const client = new RwaDefiClient(config);
  // stellar-sdk 17 decodes spec entries into plain objects.
  const fn = client.spec.getFunc(name) as unknown as {
    inputs: Array<{ name: { toString(): string } }>;
  };
  return fn.inputs.map((input) => input.name.toString());
}

describe("rwaDefi bindings match the defi-rwa contract", () => {
  test("liquidate takes liquidator, pool, borrower address and debt", () => {
    expect(specInputs("liquidate")).toEqual([
      "liquidator",
      "pool_id",
      "borrower_address",
      "debt_to_cover",
    ]);
  });

  test("create_pool takes close_factor before reserve_factor", () => {
    expect(specInputs("create_pool")).toEqual([
      "admin",
      "pool_id",
      "name",
      "asset",
      "asset_address",
      "collateral_factor",
      "liquidation_threshold",
      "liquidation_penalty",
      "close_factor",
      "reserve_factor",
    ]);
  });

  test("encodes liquidate arguments with the contract types", () => {
    const client = new RwaDefiClient(config);
    const liquidator = Keypair.random().publicKey();
    const borrower = Keypair.random().publicKey();
    const args = client.spec.funcArgsToScVals("liquidate", {
      liquidator,
      pool_id: "pool-usdc",
      borrower_address: borrower,
      debt_to_cover: BigInt(250),
    });

    expect(
      args.map((arg) => (arg as unknown as { type: string }).type),
    ).toEqual(["scvAddress", "scvString", "scvAddress", "scvI128"]);
    expect(Address.fromScVal(args[0]!).toString()).toBe(liquidator);
    expect(scValToNative(args[1]!)).toBe("pool-usdc");
    expect(Address.fromScVal(args[2]!).toString()).toBe(borrower);
    expect(scValToNative(args[3]!)).toBe(BigInt(250));
  });
});

describe("DefiLendingContractClient", () => {
  function recordingClient() {
    const calls: Array<{ method: string; args: unknown }> = [];
    const inner = new Proxy(
      {},
      {
        get: (_target, method: string) => async (args: unknown) => {
          calls.push({ method, args });
          return {};
        },
      },
    );
    return {
      calls,
      client: new DefiLendingContractClient(
        inner as ConstructorParameters<typeof DefiLendingContractClient>[0],
      ),
    };
  }

  test("liquidate maps to the contract argument names", async () => {
    const { calls, client } = recordingClient();
    await client.liquidate({
      liquidator: "GLIQUIDATOR",
      poolId: "pool-usdc",
      borrowerAddress: "GBORROWER",
      debtToCover: BigInt(10),
    });

    expect(calls).toEqual([
      {
        method: "liquidate",
        args: {
          liquidator: "GLIQUIDATOR",
          pool_id: "pool-usdc",
          borrower_address: "GBORROWER",
          debt_to_cover: BigInt(10),
        },
      },
    ]);
  });

  test("createPool passes the close factor", async () => {
    const { calls, client } = recordingClient();
    await client.createPool({
      admin: "GADMIN",
      poolId: "pool-usdc",
      name: "USDC",
      asset: "USDC",
      assetAddress: "CASSET",
      collateralFactor: BigInt(1),
      liquidationThreshold: BigInt(2),
      liquidationPenalty: BigInt(3),
      closeFactor: BigInt(4),
      reserveFactor: 1000,
    });

    expect(calls[0]?.method).toBe("create_pool");
    expect(calls[0]?.args).toMatchObject({ close_factor: BigInt(4) });
  });
});
