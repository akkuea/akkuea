import { describe, test, expect } from "bun:test";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
} from "@stellar/stellar-sdk";
import {
  resolveSorobanRpcUrl,
  createNodeContractSigner,
  buildContractClientOptions,
} from "../src/contracts/clientConfig.js";
import { API_ENDPOINTS } from "../src/constants/index.js";

describe("contracts/clientConfig.ts", () => {
  describe("resolveSorobanRpcUrl", () => {
    test("an explicit rpcUrl wins regardless of passphrase", () => {
      const customRpc = "https://custom-soroban-rpc.example.com";

      expect(resolveSorobanRpcUrl(Networks.PUBLIC, customRpc)).toBe(customRpc);
      expect(resolveSorobanRpcUrl(Networks.TESTNET, customRpc)).toBe(customRpc);
      expect(
        resolveSorobanRpcUrl("Custom Standalone Network ; 2026", customRpc),
      ).toBe(customRpc);
    });

    test("the public passphrase resolves to the mainnet endpoint", () => {
      expect(resolveSorobanRpcUrl(Networks.PUBLIC)).toBe(
        API_ENDPOINTS.SOROBAN_RPC.MAINNET,
      );
      expect(resolveSorobanRpcUrl(Networks.PUBLIC, undefined)).toBe(
        API_ENDPOINTS.SOROBAN_RPC.MAINNET,
      );
    });

    test("any other passphrase resolves to testnet", () => {
      expect(resolveSorobanRpcUrl(Networks.TESTNET)).toBe(
        API_ENDPOINTS.SOROBAN_RPC.TESTNET,
      );
      expect(resolveSorobanRpcUrl("Standalone Network ; September 2015")).toBe(
        API_ENDPOINTS.SOROBAN_RPC.TESTNET,
      );
      expect(resolveSorobanRpcUrl("Local Futurenet ; 2026")).toBe(
        API_ENDPOINTS.SOROBAN_RPC.TESTNET,
      );
      expect(resolveSorobanRpcUrl("")).toBe(API_ENDPOINTS.SOROBAN_RPC.TESTNET);
    });
  });

  describe("buildContractClientOptions", () => {
    const testContractId =
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    test("buildContractClientOptions defaults to the testnet passphrase", () => {
      const options = buildContractClientOptions({
        contractId: testContractId,
      });

      expect(options.contractId).toBe(testContractId);
      expect(options.networkPassphrase).toBe(Networks.TESTNET);
      expect(options.rpcUrl).toBe(API_ENDPOINTS.SOROBAN_RPC.TESTNET);
    });

    test("resolves mainnet rpc when public passphrase is provided", () => {
      const options = buildContractClientOptions({
        contractId: testContractId,
        networkPassphrase: Networks.PUBLIC,
      });

      expect(options.contractId).toBe(testContractId);
      expect(options.networkPassphrase).toBe(Networks.PUBLIC);
      expect(options.rpcUrl).toBe(API_ENDPOINTS.SOROBAN_RPC.MAINNET);
    });

    test("preserves explicit rpcUrl and optional client configurations", () => {
      const customRpc = "https://private-rpc.internal";
      const dummySigner = async (xdr: string) => ({
        signedTxXdr: xdr,
        signerAddress: "GB123",
      });

      const options = buildContractClientOptions({
        contractId: testContractId,
        networkPassphrase: Networks.PUBLIC,
        rpcUrl: customRpc,
        publicKey: "GB123",
        signTransaction: dummySigner,
        allowHttp: true,
      });

      expect(options.contractId).toBe(testContractId);
      expect(options.rpcUrl).toBe(customRpc);
      expect(options.publicKey).toBe("GB123");
      expect(options.signTransaction).toBe(dummySigner);
      expect(options.allowHttp).toBe(true);
    });
  });

  describe("createNodeContractSigner", () => {
    test("returns the matching public key and produces exactly one signature on a built XDR", async () => {
      const keypair = Keypair.random();
      const networkPassphrase = Networks.TESTNET;

      const signer = createNodeContractSigner(
        keypair.secret(),
        networkPassphrase,
      );

      // Verify matching public key
      expect(signer.publicKey).toBe(keypair.publicKey());

      // Construct a valid unsigned transaction
      const account = new Account(keypair.publicKey(), "100");
      const destinationKeypair = Keypair.random();
      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: destinationKeypair.publicKey(),
            asset: Asset.native(),
            amount: "10",
          }),
        )
        .setTimeout(30)
        .build();

      const unsignedXdr = transaction.toXDR();

      // Sign the transaction
      const signResult = await signer.signTransaction(unsignedXdr);

      expect(signResult.signerAddress).toBe(keypair.publicKey());
      expect(typeof signResult.signedTxXdr).toBe("string");

      // Verify the signed transaction produces exactly one signature
      const signedTx = TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        networkPassphrase,
      );

      expect(signedTx.signatures.length).toBe(1);
      expect(Buffer.from(signedTx.signatures[0].hint.value)).toEqual(
        keypair.signatureHint(),
      );

      // Verify cryptographic validity of signature against transaction hash
      const isValidSignature = keypair.verify(
        signedTx.hash(),
        Buffer.from(signedTx.signatures[0].signature.value),
      );
      expect(isValidSignature).toBe(true);
    });
  });
});
