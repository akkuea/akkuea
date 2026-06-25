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
exports.Client = exports.NftError = exports.rpc = exports.contract = void 0;
const buffer_1 = require("buffer");
const contract_1 = require("@stellar/stellar-sdk/contract");
__exportStar(require("@stellar/stellar-sdk"), exports);
exports.contract = __importStar(require("@stellar/stellar-sdk/contract"));
exports.rpc = __importStar(require("@stellar/stellar-sdk/rpc"));
if (typeof window !== "undefined") {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || buffer_1.Buffer;
}
exports.NftError = {
    1: { message: "AlreadyInitialized" },
    2: { message: "NotOwner" },
    3: { message: "NotApproved" },
    4: { message: "InvalidProperty" },
    5: { message: "ContractPaused" },
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
        super(new contract_1.Spec(["AAAAAQAAAAAAAAAAAAAADFByb3BlcnR5TWV0YQAAAAMAAAAAAAAAEGFwcHJvdmVkX3NwZW5kZXIAAAAEAAAAAAAAABNsYXN0X2NsYWltZWRfbGVkZ2VyAAAAAAYAAAAAAAAABWxldmVsAAAAAAAABA==",
            "AAAAAQAAAAAAAAAAAAAADVByb3BlcnR5T3duZXIAAAAAAAABAAAAAAAAAAdhZGRyZXNzAAAAABM=",
            "AAAAAQAAAAAAAAAAAAAADlByb3BlcnR5Q29vcmRzAAAAAAACAAAAAAAAAAF4AAAAAAAABAAAAAAAAAABeQAAAAAAAAQ=",
            "AAAAAQAAAAAAAAAAAAAADVByb3BlcnR5U3RhdGUAAAAAAAAHAAAAAAAAAAhhcHByb3ZlZAAAA+gAAAATAAAAAAAAAAJpZAAAAAAABAAAAAAAAAATbGFzdF9jbGFpbWVkX2xlZGdlcgAAAAAGAAAAAAAAAAVsZXZlbAAAAAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAABeAAAAAAAAAQAAAAAAAAAAXkAAAAAAAAE",
            "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
            "AAAAAAAAAA9BcHByb3ZlIHNwZW5kZXIAAAAAB2FwcHJvdmUAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAQAAAAA",
            "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAA",
            "AAAAAAAAABFUcmFuc2ZlciBwcm9wZXJ0eQAAAAAAAAh0cmFuc2ZlcgAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAALcHJvcGVydHlfaWQAAAAABAAAAAA=",
            "AAAAAAAAAAAAAAAJZ2V0X293bmVyAAAAAAAAAQAAAAAAAAALcHJvcGVydHlfaWQAAAAABAAAAAEAAAAT",
            "AAAAAAAAACtNaW50IGFsbCA0MDAgdGlsZXMgdG8gYHRyZWFzdXJ5YCBsb2dpY2FsbHkuAAAAAAppbml0aWFsaXplAAAAAAACAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAAAAAAC2dhbWVfZW5naW5lAAAAABMAAAAA",
            "AAAAAAAAAAxHZXQgcHJvcGVydHkAAAAMZ2V0X3Byb3BlcnR5AAAAAQAAAAAAAAALcHJvcGVydHlfaWQAAAAABAAAAAEAAAfQAAAADVByb3BlcnR5U3RhdGUAAAA=",
            "AAAAAAAAAAAAAAANbGlzdF9ieV9vd25lcgAAAAAAAAEAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAPqAAAABA==",
            "AAAAAAAAAB5UcmFuc2ZlciBmcm9tIGFwcHJvdmVkIHNwZW5kZXIAAAAAAA10cmFuc2Zlcl9mcm9tAAAAAAAABAAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAAC3Byb3BlcnR5X2lkAAAAAAQAAAAA",
            "AAAAAAAAAAAAAAAVc2V0X2ltcHJvdmVtZW50X2xldmVsAAAAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAEAAAAAAAAAAVsZXZlbAAAAAAAAAQAAAAA",
            "AAAAAAAAAAAAAAAXc2V0X2xhc3RfY2xhaW1lZF9sZWRnZXIAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAtwcm9wZXJ0eV9pZAAAAAAEAAAAAAAAAAZsZWRnZXIAAAAAAAYAAAAA",
            "AAAABAAAAAAAAAAAAAAACE5mdEVycm9yAAAABgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAAhOb3RPd25lcgAAAAIAAAAAAAAAC05vdEFwcHJvdmVkAAAAAAMAAAAAAAAAD0ludmFsaWRQcm9wZXJ0eQAAAAAEAAAAAAAAAA5Db250cmFjdFBhdXNlZAAAAAAABQAAAAAAAAAMVW5hdXRob3JpemVkAAAABg==",
            "AAAABQAAAAAAAAAAAAAADEFwcHJvdmVFdmVudAAAAAEAAAANYXBwcm92ZV9ldmVudAAAAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAI=",
            "AAAABQAAAAAAAAAAAAAADVRyYW5zZmVyRXZlbnQAAAAAAAABAAAADnRyYW5zZmVyX2V2ZW50AAAAAAADAAAAAAAAAARmcm9tAAAD6AAAABMAAAAAAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAI="]), options);
        this.options = options;
    }
    fromJSON = {
        pause: (this.txFromJSON),
        approve: (this.txFromJSON),
        unpause: (this.txFromJSON),
        transfer: (this.txFromJSON),
        get_owner: (this.txFromJSON),
        initialize: (this.txFromJSON),
        get_property: (this.txFromJSON),
        list_by_owner: (this.txFromJSON),
        transfer_from: (this.txFromJSON),
        set_improvement_level: (this.txFromJSON),
        set_last_claimed_ledger: (this.txFromJSON)
    };
}
exports.Client = Client;
