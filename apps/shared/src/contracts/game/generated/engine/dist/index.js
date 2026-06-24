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
exports.Client = exports.EngineError = exports.rpc = exports.contract = void 0;
const buffer_1 = require("buffer");
const contract_1 = require("@stellar/stellar-sdk/contract");
__exportStar(require("@stellar/stellar-sdk"), exports);
exports.contract = __importStar(require("@stellar/stellar-sdk/contract"));
exports.rpc = __importStar(require("@stellar/stellar-sdk/rpc"));
if (typeof window !== "undefined") {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || buffer_1.Buffer;
}
exports.EngineError = {
    1: { message: "AlreadyInitialized" },
    2: { message: "NotOwner" },
    3: { message: "AlreadyMaxLevel" },
    4: { message: "NothingToClaim" },
    5: { message: "InsufficientBalance" }
};
class Client extends contract_1.Client {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return contract_1.Client.deploy(null, options);
    }
    constructor(options) {
        super(new contract_1.Spec(["AAAAAgAAAAAAAAAAAAAAClN0b3JhZ2VLZXkAAAAAAAQAAAAAAAAAAAAAAAtOZnRDb250cmFjdAAAAAAAAAAAAAAAAA1Ub2tlbkNvbnRyYWN0AAAAAAAAAAAAAAAAAAAIVHJlYXN1cnkAAAAAAAAAAAAAAAtJbml0aWFsaXplZAA=",
            "AAAAAAAAAAAAAAAHaW1wcm92ZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAQAAAAA",
            "AAAABAAAAAAAAAAAAAAAC0VuZ2luZUVycm9yAAAAAAUAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAQAAAAAAAAAITm90T3duZXIAAAACAAAAAAAAAA9BbHJlYWR5TWF4TGV2ZWwAAAAAAwAAAAAAAAAOTm90aGluZ1RvQ2xhaW0AAAAAAAQAAAAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAABQ==",
            "AAAAAQAAAAAAAAAAAAAADVByb3BlcnR5U3RhdGUAAAAAAAAHAAAAAAAAAAhhcHByb3ZlZAAAA+gAAAATAAAAAAAAAAJpZAAAAAAABAAAAAAAAAATbGFzdF9jbGFpbWVkX2xlZGdlcgAAAAAGAAAAAAAAAAVsZXZlbAAAAAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAABeAAAAAAAAAQAAAAAAAAAAXkAAAAAAAAE",
            "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAwAAAAAAAAAMbmZ0X2NvbnRyYWN0AAAAEwAAAAAAAAAOdG9rZW5fY29udHJhY3QAAAAAABMAAAAAAAAACHRyZWFzdXJ5AAAAEwAAAAA=",
            "AAAAAAAAAAAAAAAMY2xhaW1fcmVudGFsAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAEAAAAAA==",
            "AAAAAAAAAAAAAAASZ2V0X2FjY3J1ZWRfaW5jb21lAAAAAAABAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAEAAAAAQAAAAs="]), options);
        this.options = options;
    }
    fromJSON = {
        improve: (this.txFromJSON),
        initialize: (this.txFromJSON),
        claim_rental: (this.txFromJSON),
        get_accrued_income: (this.txFromJSON)
    };
}
exports.Client = Client;
