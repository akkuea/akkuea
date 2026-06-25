"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = exports.TokenError = exports.rpc = exports.contract = void 0;
const buffer_1 = require("buffer");
const contract_1 = require("@stellar/stellar-sdk/contract");
__exportStar(require("@stellar/stellar-sdk"), exports);
exports.contract = __importStar(require("@stellar/stellar-sdk/contract"));
exports.rpc = __importStar(require("@stellar/stellar-sdk/rpc"));
if (typeof window !== "undefined") {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || buffer_1.Buffer;
}
exports.TokenError = {
    1: { message: "AlreadyInitialized" },
    2: { message: "InsufficientBalance" },
    3: { message: "InsufficientAllowance" },
    4: { message: "FaucetDisabled" },
    5: { message: "FaucetAlreadyClaimed" },
    6: { message: "Unauthorized" }
};
class Client extends contract_1.Client {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return contract_1.Client.deploy(null, options);
    }
    constructor(options) {
        super(new contract_1.Spec(["AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAEAAAAAAAAAB0JhbGFuY2UAAAAAAQAAABMAAAABAAAAAAAAAAlBbGxvd2FuY2UAAAAAAAACAAAAEwAAABMAAAAAAAAAAAAAAAVBZG1pbgAAAAAAAAAAAAAAAAAAB1Rlc3RuZXQAAAAAAQAAAAAAAAAKQXV0aG9yaXplZAAAAAAAAQAAABMAAAABAAAAAAAAAA1GYXVjZXRDbGFpbWVkAAAAAAAAAQAAABM=",
            "AAAABAAAAAAAAAAAAAAAClRva2VuRXJyb3IAAAAAAAYAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAACAAAAAAAAABVJbnN1ZmZpY2llbnRBbGxvd2FuY2UAAAAAAAADAAAAAAAAAA5GYXVjZXREaXNhYmxlZAAAAAAABAAAAAAAAAAURmF1Y2V0QWxyZWFkeUNsYWltZWQAAAAFAAAAAAAAAAxVbmF1dGhvcml6ZWQAAAAG",
            "AAAAAAAAAAAAAAAEYnVybgAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
            "AAAAAAAAAAAAAAAEbWludAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
            "AAAAAAAAAAAAAAAEbmFtZQAAAAAAAAABAAAAEA==",
            "AAAAAAAAAAAAAAAGZmF1Y2V0AAAAAAABAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAA==",
            "AAAAAAAAAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
            "AAAAAAAAAAAAAAAHYXBwcm92ZQAAAAAEAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAEWV4cGlyYXRpb25fbGVkZ2VyAAAAAAAABAAAAAA=",
            "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAABAAAAAAAAAAJpZAAAAAAAEwAAAAEAAAAL",
            "AAAAAAAAAAAAAAAIZGVjaW1hbHMAAAAAAAAAAQAAAAQ=",
            "AAAAAAAAAAAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
            "AAAAAAAAAAAAAAAJYWxsb3dhbmNlAAAAAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAL",
            "AAAAAAAAAAAAAAAJYnVybl9mcm9tAAAAAAAAAwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
            "AAAAAAAAAAAAAAAKYXV0aG9yaXplZAAAAAAAAQAAAAAAAAACaWQAAAAAABMAAAABAAAAAQ==",
            "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAx0ZXN0bmV0X21vZGUAAAABAAAAAA==",
            "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
            "AAAAAAAAAAAAAAAOc2V0X2F1dGhvcml6ZWQAAAAAAAIAAAAAAAAAAmlkAAAAAAATAAAAAAAAAAlhdXRob3JpemUAAAAAAAABAAAAAA==",
            "AAAAAAAAAAAAAAARc3BlbmRhYmxlX2JhbGFuY2UAAAAAAAABAAAAAAAAAAJpZAAAAAAAEwAAAAEAAAAL"]), options);
        this.options = options;
    }
    fromJSON = {
        burn: (this.txFromJSON),
        mint: (this.txFromJSON),
        name: (this.txFromJSON),
        faucet: (this.txFromJSON),
        symbol: (this.txFromJSON),
        approve: (this.txFromJSON),
        balance: (this.txFromJSON),
        decimals: (this.txFromJSON),
        transfer: (this.txFromJSON),
        allowance: (this.txFromJSON),
        burn_from: (this.txFromJSON),
        authorized: (this.txFromJSON),
        initialize: (this.txFromJSON),
        transfer_from: (this.txFromJSON),
        set_authorized: (this.txFromJSON),
        spendable_balance: (this.txFromJSON)
    };
}
exports.Client = Client;
