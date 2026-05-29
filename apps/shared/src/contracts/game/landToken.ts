// Generated from WASM using Stellar SDK — contract: game-land-token
// Post-processing: renamed Client → LandTokenClient to avoid barrel-export collisions.
// The ContractSpec XDR was extracted from the compiled WASM artifact via
// WebAssembly.Module.customSections(module, "contractspecv0").
// ContractClient dynamically injects contract methods (e.g. init) onto instances
// at construction time from the spec — no manual method declarations needed.
import {
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type { ClientOptions as ContractClientOptions } from "@stellar/stellar-sdk/contract";

export class LandTokenClient extends ContractClient {
  constructor(options: ContractClientOptions) {
    super(new ContractSpec(["AAAAAAAAAAAAAAAEaW5pdAAAAAAAAAAA"]), options);
  }
}
