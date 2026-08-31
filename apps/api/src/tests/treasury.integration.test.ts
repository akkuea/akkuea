/**
 * Integration tests for the Phase 1a treasury track, run against the real
 * DeFindex vaults deployed on Stellar testnet. Nothing here is mocked: every
 * assertion is about what the deployed contracts actually return.
 *
 * Two venues are covered:
 *   - `defindex-blend`       (DeFindex USDC vault, strategy `USDC Blend Strategy`)
 *   - `etherfuse-stablebond` (DeFindex CETES vault, strategy `CETES Blend Strategy`)
 *     (CETES is Etherfuse's tokenized Mexican sovereign-debt Stablebond)
 *
 * Reads are simulations and move no funds. The deposit test also runs against
 * the real vault: it assembles and simulates a genuine `deposit` from a
 * freshly funded account, which the deployed contract rejects at the token
 * transfer. That failure is the point, it proves the argument encoding is
 * accepted by the live WASM and that a real on-chain error decodes into the
 * typed error the API maps to an HTTP response.
 *
 * These are opt-in because they need outbound network access to Stellar
 * testnet and friendbot:
 *
 *   RUN_TREASURY_INTEGRATION_TESTS=1 bun test src/tests/treasury.integration.test.ts
 */
import { describe, expect, test } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import { DefindexVaultContractClient, DefindexVaultError } from '@akkuea/shared';
import { getTreasuryVenue, type TreasuryVenueId } from '../config/treasury';
import { mapVaultErrorToApiError } from '../services/TreasuryService';

const RUN = process.env.RUN_TREASURY_INTEGRATION_TESTS === '1';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const RPC_URL = process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const NETWORK_TIMEOUT_MS = 60_000;

const describeIntegration = RUN ? describe : describe.skip;

function venueOrThrow(id: TreasuryVenueId) {
  // The venue registry is network-scoped; these tests target testnet.
  process.env.STELLAR_NETWORK = 'testnet';
  const venue = getTreasuryVenue(id);
  if (!venue) {
    throw new Error(`Treasury venue '${id}' is not configured for testnet`);
  }
  return venue;
}

function clientFor(id: TreasuryVenueId, publicKey?: string) {
  return DefindexVaultContractClient.fromConfig({
    contractId: venueOrThrow(id).vaultContractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
  });
}

async function fundedTestnetAccount(): Promise<string> {
  const keypair = Keypair.random();
  const response = await fetch(`${FRIENDBOT_URL}?addr=${keypair.publicKey()}`);

  if (!response.ok) {
    throw new Error(`Friendbot funding failed with status ${response.status}`);
  }

  return keypair.publicKey();
}

const VENUE_EXPECTATIONS: Array<{
  id: TreasuryVenueId;
  strategyName: string;
  assetCode: string;
}> = [
  { id: 'defindex-blend', strategyName: 'USDC Blend Strategy', assetCode: 'USDC' },
  { id: 'etherfuse-stablebond', strategyName: 'CETES Blend Strategy', assetCode: 'CETES' },
];

describeIntegration('treasury venues against deployed DeFindex vaults (testnet)', () => {
  for (const expectation of VENUE_EXPECTATIONS) {
    describe(expectation.id, () => {
      test(
        'the configured vault manages the configured asset through the expected strategy',
        async () => {
          const venue = venueOrThrow(expectation.id);
          const assets = await clientFor(expectation.id).getAssets();

          const managed = assets.find((entry) => entry.address === venue.assetContractId);
          expect(managed).toBeDefined();

          const strategyNames = managed!.strategies.map((strategy) => strategy.name);
          expect(strategyNames).toContain(expectation.strategyName);
          expect(venue.assetCode).toBe(expectation.assetCode);
        },
        NETWORK_TIMEOUT_MS,
      );

      test(
        'configured decimals match what the deployed vault reports',
        async () => {
          const venue = venueOrThrow(expectation.id);
          const onChainDecimals = await clientFor(expectation.id).decimals();

          expect(onChainDecimals).toBe(venue.assetDecimals);
        },
        NETWORK_TIMEOUT_MS,
      );

      test(
        'total managed funds are internally consistent and non-negative',
        async () => {
          const venue = venueOrThrow(expectation.id);
          const managedFunds = await clientFor(expectation.id).fetchTotalManagedFunds();

          const allocation = managedFunds.find((entry) => entry.asset === venue.assetContractId);
          expect(allocation).toBeDefined();
          expect(allocation!.total_amount).toBeGreaterThanOrEqual(0n);
          expect(allocation!.idle_amount + allocation!.invested_amount).toBe(
            allocation!.total_amount,
          );

          const strategyTotal = allocation!.strategy_allocations.reduce(
            (sum, entry) => sum + entry.amount,
            0n,
          );
          expect(strategyTotal).toBe(allocation!.invested_amount);
        },
        NETWORK_TIMEOUT_MS,
      );

      test(
        'share price is readable and a share is worth at least its face value',
        async () => {
          const client = clientFor(expectation.id);
          const [totalSupply, oneShareWorth] = await Promise.all([
            client.totalSupply(),
            // 1.0 share at 7 decimals.
            client.getAssetAmountsPerShares(10_000_000n),
          ]);

          expect(totalSupply).toBeGreaterThan(0n);
          // Vaults only accrue value, so a share never redeems for less than 1:1.
          expect(oneShareWorth[0]).toBeGreaterThanOrEqual(10_000_000n);
        },
        NETWORK_TIMEOUT_MS,
      );

      test(
        'a real deposit call is accepted by the deployed vault and fails only on funding',
        async () => {
          const source = await fundedTestnetAccount();
          const client = clientFor(expectation.id, source);

          // A freshly funded account holds no USDC/CETES and has no trustline,
          // so the deployed contract must reject this at the token transfer.
          const attempt = client.deposit({
            amountsDesired: [10_000_000n],
            amountsMin: [9_950_000n],
            from: source,
            invest: true,
          });

          const error = await attempt.then(
            () => null,
            (caught: unknown) => caught as DefindexVaultError,
          );

          expect(error).toBeInstanceOf(DefindexVaultError);
          if (!error) {
            throw new Error('Expected the deployed vault to reject an unfunded deposit');
          }

          // #13 TrustlineMissingError, or #10 BalanceError if a trustline exists
          // but is empty. Either proves the call reached the token transfer,
          // which means the vault accepted the arguments.
          expect(['TrustlineMissingError', 'BalanceError']).toContain(error.errorName);
          expect(error.source).toBe('token');

          const apiError = mapVaultErrorToApiError(error);
          expect(apiError.statusCode).toBe(409);
          expect(['TREASURY_TRUSTLINE_MISSING', 'TREASURY_INSUFFICIENT_BALANCE']).toContain(
            apiError.code,
          );
        },
        NETWORK_TIMEOUT_MS,
      );
    });
  }

  test(
    'the two venues are distinct vaults holding distinct assets',
    async () => {
      const blend = venueOrThrow('defindex-blend');
      const etherfuse = venueOrThrow('etherfuse-stablebond');

      expect(blend.vaultContractId).not.toBe(etherfuse.vaultContractId);
      expect(blend.assetContractId).not.toBe(etherfuse.assetContractId);
    },
    NETWORK_TIMEOUT_MS,
  );
});

if (!RUN) {
  describe('treasury integration tests', () => {
    test('are skipped without RUN_TREASURY_INTEGRATION_TESTS=1', () => {
      expect(RUN).toBe(false);
    });
  });
}
