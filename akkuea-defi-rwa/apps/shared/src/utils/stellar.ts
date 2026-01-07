import * as StellarSdk from 'stellar-sdk';
import { SorobanRpc } from 'soroban-client';

export class StellarService {
  private server: SorobanRpc.Server;
  private networkPassphrase: string;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    const rpcUrl = network === 'testnet' 
      ? 'https://soroban-testnet.stellar.org'
      : 'https://rpc.mainnet.stellar.org';
    
    this.server = new SorobanRpc.Server(rpcUrl);
    this.networkPassphrase = network === 'testnet' 
      ? StellarSdk.Networks.TESTNET
      : StellarSdk.Networks.PUBLIC;
  }

  async getAccountBalance(address: string): Promise<string> {
    try {
      const account = await this.server.getAccount(address);
      return account.balances.find(b => b.asset_type === 'native')?.balance || '0';
    } catch (error) {
      throw new Error(`Failed to get account balance: ${error}`);
    }
  }

  async submitTransaction(transaction: StellarSdk.Transaction): Promise<string> {
    try {
      const preparedTransaction = await this.server.prepareTransaction(transaction);
      const transactionSigned = preparedTransaction.signXdr();
      
      const result = await this.server.sendTransaction(transactionSigned);
      
      if (result.status === 'SUCCESS') {
        return result.hash!;
      } else {
        throw new Error(`Transaction failed: ${result.errorResultXdr}`);
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
    sourceAccount?: StellarSdk.Account
  ): Promise<any> {
    try {
      const contract = new StellarSdk.Contract(contractId);
      const transaction = new StellarSdk.TransactionBuilder(
        sourceAccount || new StellarSdk.Account(StellarSdk.Keypair.random().publicKey(), '0'),
        {
          fee: '100',
          networkPassphrase: this.networkPassphrase,
        }
      )
        .addOperation(
          contract.call(method, ...args)
        )
        .setTimeout(30)
        .build();

      const simulated = await this.server.simulateTransaction(transaction);
      
      if (StellarSdk.SorobanData.Api.isSimulatedTransactionSuccess(simulated)) {
        return simulated.result?.toXdr('base64');
      } else {
        throw new Error(`Contract call failed: ${simulated.error}`);
      }
    } catch (error) {
      throw new Error(`Failed to call contract: ${error}`);
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