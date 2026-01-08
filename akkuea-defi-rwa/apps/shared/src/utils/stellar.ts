import * as StellarSdk from 'stellar-sdk';
import { Server } from 'soroban-client';

export class StellarService {
  private server: Server;
  private networkPassphrase: string;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    const rpcUrl = network === 'testnet' 
      ? 'https://soroban-testnet.stellar.org'
      : 'https://rpc.mainnet.stellar.org';
    
    this.server = new Server(rpcUrl);
    this.networkPassphrase = network === 'testnet' 
      ? StellarSdk.Networks.TESTNET
      : StellarSdk.Networks.PUBLIC;
  }

  async getAccountBalance(address: string): Promise<string> {
    try {
      const account: any = await this.server.getAccount(address);
      const balances = account.balances || [];
      const nativeBalance = balances.find((b: any) => b.asset_type === 'native');
      return nativeBalance?.balance || '0';
    } catch (error) {
      throw new Error(`Failed to get account balance: ${error}`);
    }
  }

  async submitTransaction(signedXdr: string): Promise<string> {
    try {
      const result: any = await this.server.sendTransaction(signedXdr as any);
      
      if (result.status === 'SUCCESS') {
        return result.hash;
      } else {
        throw new Error(`Transaction failed: ${result.errorResult || 'Unknown error'}`);
      }
    } catch (error) {
      throw new Error(`Failed to submit transaction: ${error}`);
    }
  }

  async getTransactionStatus(txHash: string): Promise<'pending' | 'success' | 'error'> {
    try {
      const result = await this.server.getTransaction(txHash);
      
      if (result.status === 'SUCCESS') {
        return 'success';
      } else if (result.status === 'FAILED') {
        return 'error';
      } else {
        return 'pending';
      }
    } catch (error) {
      return 'pending';
    }
  }

  async callContract(
    contractId: string,
    method: string,
    args: any[] = [],
    sourceAccount?: string
  ): Promise<any> {
    try {
      const contract = new StellarSdk.Contract(contractId);
      const source = sourceAccount || StellarSdk.Keypair.random().publicKey();
      
      // Get account details
      let account: any;
      try {
        account = await this.server.getAccount(source);
      } catch {
        // Account doesn't exist, create a minimal account object
        account = {
          accountId: () => source,
          sequenceNumber: () => '0',
          incrementSequenceNumber: () => {}
        };
      }
      
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(method, ...args)
        )
        .setTimeout(30)
        .build();

      const simulated: any = await this.server.simulateTransaction(transaction as any);
      
      if (simulated.transactionData) {
        return simulated.transactionData.toXdr('base64');
      } else if (simulated.error) {
        throw new Error(`Contract call failed: ${simulated.error}`);
      } else {
        throw new Error(`Contract call failed: Unknown simulation result`);
      }
    } catch (error) {
      throw new Error(`Failed to call contract: ${error}`);
    }
  }

  buildAndSignTransaction(
    source: string,
    secretKey: string,
    operation: any
  ): string {
    try {
      const keypair = StellarSdk.Keypair.fromSecret(secretKey);
      const account = {
        accountId: () => source,
        sequenceNumber: () => '1',
        incrementSequenceNumber: () => {}
      };

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(operation as any)
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      return transaction.toXDR();
    } catch (error) {
      throw new Error(`Failed to build transaction: ${error}`);
    }
  }

  createKeypair(): { publicKey: string; secretKey: string } {
    const keypair = StellarSdk.Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  }

  validateAddress(address: string): boolean {
    try {
      StellarSdk.StrKey.decodeEd25519PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}

export const stellarService = new StellarService();