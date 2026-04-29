import {
  Keypair,
  Horizon,
  Networks,
  TransactionBuilder,
  Contract,
  StrKey,
  xdr,
  Operation as StellarOperation,
  Account,
  Transaction,
} from "@stellar/stellar-sdk";

export interface WalletSigner {
  publicKey: string;
  sign(transaction: string): Promise<string>;
}

type NetworkType = "testnet" | "mainnet";
type TransactionStatus = "pending" | "success" | "error";

const RETRY_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 5000;

export class StellarService {
  private server: Horizon.Server;
  private networkPassphrase: string;

  constructor(network: NetworkType = "testnet") {
    const rpcUrl =
      network === "testnet"
        ? "https://soroban-testnet.stellar.org"
        : "https://rpc.mainnet.stellar.org";

    this.server = new Horizon.Server(rpcUrl);
    this.networkPassphrase =
      network === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
  }

  async getAccountBalance(address: string): Promise<string> {
    try {
      this.validateAddress(address);
      const account = await this.server.accounts().accountId(address).call();
      const nativeBalance = account.balances.find(
        (b: { asset_type: string; balance?: string }) =>
          b.asset_type === "native",
      );
      return nativeBalance?.balance ?? "0";
    } catch (error) {
      throw new Error("Failed to get account balance", { cause: error });
    }
  }

  async submitTransaction(signedXdr: string): Promise<string> {
    try {
      const envelope = xdr.TransactionEnvelope.fromXDR(signedXdr, "base64");
      const transaction = new Transaction(envelope, this.networkPassphrase);
      const result = await this.server.submitTransaction(transaction);

      if (result.successful) {
        return result.hash;
      }
      const errorResult = result as { result_code?: string };
      throw new Error(
        `Transaction failed: ${errorResult.result_code || "Unknown error"}`,
      );
    } catch (error) {
      throw new Error("Failed to submit transaction", { cause: error });
    }
  }

  async getTransactionStatus(
    txHash: string,
    maxAttempts: number = RETRY_ATTEMPTS,
  ): Promise<TransactionStatus> {
    let backoffMs = INITIAL_BACKOFF_MS;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.server
          .transactions()
          .transaction(txHash)
          .call();

        return result.successful ? "success" : "error";
      } catch {
        // Retry logic: wait and try again
        if (attempt < maxAttempts - 1) {
          await this.delay(backoffMs);
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        }
      }
    }

    return "pending";
  }

  async callContract(
    contractId: string,
    method: string,
    args: xdr.ScVal[] = [],
    sourceAccount: string,
  ): Promise<string> {
    try {
      this.validateAddress(sourceAccount);

      const contract = new Contract(contractId);
      const accountRecord = await this.server
        .accounts()
        .accountId(sourceAccount)
        .call();

      // Convert AccountRecord to Account
      const account = new Account(accountRecord.id, accountRecord.sequence);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: this.networkPassphrase,
      })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .addOperation(contract.call(method, ...args) as any)
        .setTimeout(30)
        .build();

      // Note: Horizon Server doesn't support simulateTransaction
      // This would need to be called against a Soroban RPC endpoint
      // For now, return the transaction XDR to be simulated externally
      return transaction.toXDR();
    } catch (error) {
      throw new Error("Failed to call contract", { cause: error });
    }
  }

  async buildAndSignTransaction(
    source: string,
    operation: StellarOperation,
    signer: WalletSigner | Keypair,
  ): Promise<string> {
    try {
      this.validateAddress(source);

      const accountRecord = await this.server
        .accounts()
        .accountId(source)
        .call();

      // Convert AccountRecord to Account
      const account = new Account(accountRecord.id, accountRecord.sequence);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: this.networkPassphrase,
      })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .addOperation(operation as any)
        .setTimeout(30)
        .build();

      if (signer instanceof Keypair) {
        transaction.sign(signer);
      } else {
        const signedXdr = await (signer as WalletSigner).sign(
          transaction.toXDR(),
        );
        const envelope = xdr.TransactionEnvelope.fromXDR(signedXdr, "base64");
        const txEnv = envelope.v1();
        if (txEnv?.signatures) {
          Object.defineProperty(transaction, "signatures", {
            value: txEnv.signatures,
            enumerable: true,
          });
        }
      }

      return transaction.toXDR();
    } catch (error) {
      throw new Error("Failed to build transaction", { cause: error });
    }
  }

  createKeypair(): Keypair {
    return Keypair.random();
  }

  validateAddress(address: string): boolean {
    try {
      StrKey.decodeEd25519PublicKey(address);
      return true;
    } catch (error) {
      throw new Error(`Invalid Stellar address: ${address}`, { cause: error });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const stellarService = new StellarService();
