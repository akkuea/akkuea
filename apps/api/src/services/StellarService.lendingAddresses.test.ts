import { describe, expect, it, mock } from 'bun:test';
import { VALID_STELLAR_ADDRESS } from '@akkuea/shared';
import { StellarService } from './StellarService';

const CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

describe('StellarService lending contract addresses', () => {
  it('creates a lending pool with a Soroban asset contract address', async () => {
    const service = new StellarService();
    const submit = mock(async () => 'a'.repeat(64));
    Object.defineProperty(service, 'callAndSubmitContract', { value: submit });

    await expect(
      service.createLendingPool({
        contractId: CONTRACT_ID,
        adminPublicKey: VALID_STELLAR_ADDRESS,
        adminSecret: 'unused-by-test',
        poolId: 'test-pool',
        name: 'Test Pool',
        asset: 'XLM',
        assetAddress: CONTRACT_ID,
        collateralFactor: 75n,
        liquidationThreshold: 80n,
        liquidationPenalty: 5n,
        closeFactor: 50n,
        reserveFactor: 1000,
      }),
    ).resolves.toEqual({ txHash: 'a'.repeat(64), contractId: CONTRACT_ID });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('prepares a borrow with a Soroban collateral contract address', async () => {
    const service = new StellarService();
    const callContract = mock(async () => 'unsigned-xdr');
    Object.defineProperty(service, 'callContract', { value: callContract });

    await expect(
      service.prepareLendingAction({
        contractId: CONTRACT_ID,
        action: 'borrow',
        wallet: VALID_STELLAR_ADDRESS,
        poolId: 'test-pool',
        amount: 1n,
        collateralAsset: CONTRACT_ID,
        collateralAmount: 2n,
      }),
    ).resolves.toEqual({ xdr: 'unsigned-xdr', contractId: CONTRACT_ID });
    expect(callContract).toHaveBeenCalledTimes(1);
  });
});
