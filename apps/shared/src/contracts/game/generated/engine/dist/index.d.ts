import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export type StorageKey = {
    tag: "NftContract";
    values: void;
} | {
    tag: "TokenContract";
    values: void;
} | {
    tag: "Treasury";
    values: void;
} | {
    tag: "Initialized";
    values: void;
};
export declare const EngineError: {
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    3: {
        message: string;
    };
    4: {
        message: string;
    };
    5: {
        message: string;
    };
};
export interface PropertyState {
    approved: Option<string>;
    id: u32;
    last_claimed_ledger: u64;
    level: u32;
    owner: string;
    x: u32;
    y: u32;
}
export interface Client {
    /**
     * Construct and simulate a improve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    improve: ({ caller, property_id }: {
        caller: string;
        property_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    initialize: ({ nft_contract, token_contract, treasury }: {
        nft_contract: string;
        token_contract: string;
        treasury: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a claim_rental transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    claim_rental: ({ caller, property_id }: {
        caller: string;
        property_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_accrued_income transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_accrued_income: ({ property_id }: {
        property_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<i128>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        improve: (json: string) => AssembledTransaction<null>;
        initialize: (json: string) => AssembledTransaction<null>;
        claim_rental: (json: string) => AssembledTransaction<null>;
        get_accrued_income: (json: string) => AssembledTransaction<bigint>;
    };
}
