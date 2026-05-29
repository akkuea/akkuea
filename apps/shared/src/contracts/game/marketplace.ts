// Generated from WASM using Stellar SDK — contract: game-marketplace
// Post-processing: renamed Client → GameMarketplaceClient to avoid barrel-export collisions.
// The ContractSpec XDR was extracted from the compiled WASM artifact via
// WebAssembly.Module.customSections(module, "contractspecv0").
// Declaration merging (interface + class) is the standard Stellar SDK pattern for
// typed contract clients; the interface provides method types, the class provides
// the runtime implementation injected by ContractClient's constructor.
import { Client as ContractClient, Spec as ContractSpec } from "@stellar/stellar-sdk/contract";
import type {
    AssembledTransaction,
    ClientOptions as ContractClientOptions,
    MethodOptions,
} from "@stellar/stellar-sdk/contract";

/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
export interface GameMarketplaceClient {
    init: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
}

export class GameMarketplaceClient extends ContractClient {
    constructor(options: ContractClientOptions) {
        super(
            new ContractSpec(["AAAAAAAAAAAAAAAEaW5pdAAAAAAAAAAA"]),
            options
        );
    }
}
/* eslint-enable @typescript-eslint/no-unsafe-declaration-merging */
