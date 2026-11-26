import { describe, expect, it } from 'bun:test';
import {
  Account,
  Contract,
  Networks,
  SorobanDataBuilder,
  TransactionBuilder,
  rpc as SorobanRpc,
  xdr,
} from '@stellar/stellar-sdk';
import { VALID_STELLAR_ADDRESS } from '@akkuea/shared';
import { assembleLendingTransactionWithFeeBuffer } from './StellarService';

const CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

describe('Lending Soroban resource fee buffer', () => {
  it('adds a 50% resource-fee buffer to the simulated transaction', () => {
    const raw = new TransactionBuilder(new Account(VALID_STELLAR_ADDRESS, '1'), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(new Contract(CONTRACT_ID).call('withdraw'))
      .setTimeout(30)
      .build();
    const simulation: SorobanRpc.Api.SimulateTransactionSuccessResponse = {
      id: '1',
      latestLedger: 1,
      events: [],
      _parsed: true,
      minResourceFee: '1000',
      transactionData: new SorobanDataBuilder().setResourceFee('1000'),
      result: { auth: [], retval: xdr.ScVal.scvVoid() },
    };

    const transaction = assembleLendingTransactionWithFeeBuffer(raw, simulation).build();
    const ext = transaction.toEnvelope().value.tx.ext;
    if (ext.type !== 'sorobanData') throw new Error('Expected Soroban transaction data');
    const sorobanData = ext.value;

    expect(sorobanData.resourceFee.toString()).toBe('1500');
    expect(transaction.fee).toBe('1600');
    expect(transaction.sequence).toBe(raw.sequence);
  });
});
