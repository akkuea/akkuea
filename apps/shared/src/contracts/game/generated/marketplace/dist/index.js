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
exports.Client = exports.rpc = exports.contract = void 0;
const buffer_1 = require("buffer");
const contract_1 = require("@stellar/stellar-sdk/contract");
__exportStar(require("@stellar/stellar-sdk"), exports);
exports.contract = __importStar(require("@stellar/stellar-sdk/contract"));
exports.rpc = __importStar(require("@stellar/stellar-sdk/rpc"));
if (typeof window !== "undefined") {
    //@ts-ignore Buffer exists
    window.Buffer = window.Buffer || buffer_1.Buffer;
}
class Client extends contract_1.Client {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return contract_1.Client.deploy(null, options);
    }
    constructor(options) {
        super(new contract_1.Spec(["AAAAAAAAAAAAAAAEaW5pdAAAAAAAAAAA"]), options);
        this.options = options;
    }
    fromJSON = {
        init: (this.txFromJSON)
    };
}
exports.Client = Client;
