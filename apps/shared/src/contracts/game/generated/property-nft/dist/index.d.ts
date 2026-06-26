import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type { u32, u64, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export interface PropertyMeta {
    approved_spender: u32;
    last_claimed_ledger: u64;
    level: u32;
}
export interface PropertyOwner {
    address: string;
}
export interface PropertyCoords {
    x: u32;
    y: u32;
}
export interface PropertyState {
    approved: Option<string>;
    id: u32;
    last_claimed_ledger: u64;
    level: u32;
    owner: string;
    x: u32;
    y: u32;
}
export declare const NftError: {
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
    6: {
        message: string;
    };
};
export interface Client {
    /**
     * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    pause: ({ admin }: {
        admin: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Approve spender
     */
    approve: ({ owner, spender, property_id }: {
        owner: string;
        spender: string;
        property_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    unpause: ({ admin }: {
        admin: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Transfer property
     */
    transfer: ({ from, to, property_id }: {
        from: string;
        to: string;
        property_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_owner: ({ property_id }: {
        property_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Mint all 400 tiles to `treasury` logically.
     */
    initialize: ({ treasury, game_engine }: {
        treasury: string;
        game_engine: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_property transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get property
     */
    get_property: ({ property_id }: {
        property_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<PropertyState>>;
    /**
     * Construct and simulate a list_by_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    list_by_owner: ({ owner }: {
        owner: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Array<u32>>>;
    /**
     * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Transfer from approved spender
     */
    transfer_from: ({ spender, from, to, property_id }: {
        spender: string;
        from: string;
        to: string;
        property_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_improvement_level transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_improvement_level: ({ caller, property_id, level }: {
        caller: string;
        property_id: u32;
        level: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a set_last_claimed_ledger transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_last_claimed_ledger: ({ caller, property_id, ledger }: {
        caller: string;
        property_id: u32;
        ledger: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
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
        pause: (json: string) => AssembledTransaction<null>;
        approve: (json: string) => AssembledTransaction<null>;
        unpause: (json: string) => AssembledTransaction<null>;
        transfer: (json: string) => AssembledTransaction<null>;
        get_owner: (json: string) => AssembledTransaction<string>;
        initialize: (json: string) => AssembledTransaction<null>;
        get_property: (json: string) => AssembledTransaction<PropertyState>;
        list_by_owner: (json: string) => AssembledTransaction<number[]>;
        transfer_from: (json: string) => AssembledTransaction<null>;
        set_improvement_level: (json: string) => AssembledTransaction<null>;
        set_last_claimed_ledger: (json: string) => AssembledTransaction<null>;
    };
}
