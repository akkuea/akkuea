import { describe, test, expect } from "bun:test";
// Trigger CI workflow
import {
  PropertyNftClient,
  LandTokenClient,
  MarketplaceClient,
  EngineClient,
} from "../src/contracts/game";

describe("generated game clients", () => {
  test("constructs client instances with mock config", () => {
    const config = {
      contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      rpcUrl: "https://mock-rpc.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    };

    const propertyNft = new PropertyNftClient(config);
    const landToken = new LandTokenClient(config);
    const marketplace = new MarketplaceClient(config);
    const engine = new EngineClient(config);

    expect(propertyNft).toBeDefined();
    expect(landToken).toBeDefined();
    expect(marketplace).toBeDefined();
    expect(engine).toBeDefined();

    expect(propertyNft.options.contractId).toBe(config.contractId);
    expect(landToken.options.contractId).toBe(config.contractId);
    expect(marketplace.options.contractId).toBe(config.contractId);
    expect(engine.options.contractId).toBe(config.contractId);
  });
});
