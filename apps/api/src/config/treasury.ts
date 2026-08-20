import { resolveNetworkKey } from './contracts';

/**
 * Configuration for the Phase 1a treasury track.
 *
 * The platform fee sits idle in a Stellar account. Rather than leave it there,
 * it is deposited into DeFi venues that are already deployed and already
 * audited, so the balance earns yield and the whole position stays checkable on
 * a block explorer by anyone. This file is the registry of those venues.
 *
 * Both venues are DeFindex Vaults, and both are reachable through the same
 * contract interface:
 *
 *  - `defindex-blend`       — a USDC vault whose only strategy lends into Blend.
 *  - `etherfuse-stablebond` — a CETES vault. CETES is Etherfuse's tokenized
 *                             Mexican sovereign-debt Stablebond; the vault's
 *                             strategy holds it and lends it on Blend.
 *
 * Etherfuse does not publish a direct Soroban mint/redeem interface for
 * Stablebonds — the on-chain path documented by both projects is the DeFindex
 * strategy — so that is the path used here.
 *
 * Addresses below are copied from the upstream deployment registry
 * (https://github.com/defindex-io/stellar-contracts/blob/main/public/testnet.contracts.json)
 * and were verified against the live testnet contracts on 2026-08-18 by reading
 * `get_assets`, `fetch_total_managed_funds` and `decimals` off-chain. See
 * `docs/operations/runbook-treasury-track.md` for the verification transcript.
 *
 * Mainnet has no committed defaults: DeFindex vaults on mainnet are deployed
 * per-partner through the factory, so akkuea's mainnet vault addresses must be
 * supplied through environment variables once that vault exists.
 */

export const TREASURY_VENUE_IDS = ['defindex-blend', 'etherfuse-stablebond'] as const;

export type TreasuryVenueId = (typeof TREASURY_VENUE_IDS)[number];

export interface TreasuryVenue {
  id: TreasuryVenueId;
  /** Short label for API responses and UI. */
  label: string;
  /** Protocol operating the vault. */
  provider: string;
  /** What the vault's strategy actually does with the deposit. */
  strategy: string;
  /** DeFindex Vault contract (the dfToken). */
  vaultContractId: string;
  /** Underlying asset the vault accepts, as a Soroban token contract. */
  assetContractId: string;
  /** Ticker of the underlying asset. */
  assetCode: string;
  /**
   * Decimal precision of the underlying asset and the dfToken.
   *
   * Held in config rather than read per-request to avoid an extra RPC round
   * trip on every position read. `treasury.integration.test.ts` asserts this
   * matches what the deployed contract reports, so a drift fails CI rather
   * than silently mis-scaling a balance.
   */
  assetDecimals: number;
}

interface VenueDefaults {
  vaultContractId: string;
  assetContractId: string;
  assetCode: string;
  assetDecimals: number;
}

const VENUE_DEFAULTS: Record<
  TreasuryVenueId,
  Record<'TESTNET' | 'MAINNET', VenueDefaults | null>
> = {
  'defindex-blend': {
    TESTNET: {
      // `usdc_paltalabs_vault` — strategy `USDC Blend Strategy`
      vaultContractId: 'CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN',
      // SAC for USDC:GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56
      assetContractId: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
      assetCode: 'USDC',
      assetDecimals: 7,
    },
    MAINNET: null,
  },
  'etherfuse-stablebond': {
    TESTNET: {
      // `cetes_paltalabs_vault` — strategy `CETES Blend Strategy`
      vaultContractId: 'CBIS5TEMTNNOTBE3WXPQUAGUEDYZZVIWAKTXEQCOUJ34OJJ3FJ5NLF2P',
      // SAC for CETES:GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4
      assetContractId: 'CC72F57YTPX76HAA64JQOEGHQAPSADQWSY5DWVBR66JINPFDLNCQYHIC',
      assetCode: 'CETES',
      assetDecimals: 7,
    },
    MAINNET: null,
  },
};

const VENUE_METADATA: Record<
  TreasuryVenueId,
  Pick<TreasuryVenue, 'label' | 'provider' | 'strategy'>
> = {
  'defindex-blend': {
    label: 'DeFindex Blend strategy',
    provider: 'DeFindex',
    strategy: 'Lends the deposited USDC into Blend',
  },
  'etherfuse-stablebond': {
    label: 'Etherfuse Stablebonds',
    provider: 'DeFindex / Etherfuse',
    strategy: 'Holds CETES, Etherfuse tokenized Mexican sovereign debt, and lends it on Blend',
  },
};

const ENV_KEYS: Record<TreasuryVenueId, { vault: string; asset: string; decimals: string }> = {
  'defindex-blend': {
    vault: 'TREASURY_DEFINDEX_BLEND_VAULT_ID',
    asset: 'TREASURY_DEFINDEX_BLEND_ASSET_ID',
    decimals: 'TREASURY_DEFINDEX_BLEND_ASSET_DECIMALS',
  },
  'etherfuse-stablebond': {
    vault: 'TREASURY_ETHERFUSE_VAULT_ID',
    asset: 'TREASURY_ETHERFUSE_ASSET_ID',
    decimals: 'TREASURY_ETHERFUSE_ASSET_DECIMALS',
  },
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Resolve one venue, or `null` when it is not configured for the active
 * network. A null venue is a normal state (mainnet before the vault exists),
 * not an error — callers report it as unconfigured rather than throwing.
 */
export function getTreasuryVenue(id: TreasuryVenueId): TreasuryVenue | null {
  const network = resolveNetworkKey();
  const defaults = VENUE_DEFAULTS[id][network];
  const envKeys = ENV_KEYS[id];

  const vaultContractId = readEnv(envKeys.vault) ?? defaults?.vaultContractId;
  const assetContractId = readEnv(envKeys.asset) ?? defaults?.assetContractId;
  const assetCode = defaults?.assetCode ?? id.toUpperCase();
  const decimalsFromEnv = readEnv(envKeys.decimals);
  const assetDecimals = decimalsFromEnv
    ? Number.parseInt(decimalsFromEnv, 10)
    : (defaults?.assetDecimals ?? 7);

  if (!vaultContractId || !assetContractId || !Number.isInteger(assetDecimals)) {
    return null;
  }

  return {
    id,
    ...VENUE_METADATA[id],
    vaultContractId,
    assetContractId,
    assetCode,
    assetDecimals,
  };
}

/** Every venue configured for the active network, in a stable order. */
export function getConfiguredTreasuryVenues(): TreasuryVenue[] {
  return TREASURY_VENUE_IDS.map(getTreasuryVenue).filter(
    (venue): venue is TreasuryVenue => venue !== null,
  );
}

export function isTreasuryVenueId(value: string): value is TreasuryVenueId {
  return (TREASURY_VENUE_IDS as readonly string[]).includes(value);
}

export interface TreasurySourceAccount {
  publicKey: string;
  secret: string;
}

/**
 * The account holding the accumulated platform fee, which is what deposits are
 * drawn from and what withdrawals return to.
 *
 * Falls back to the existing Soroban admin credentials so a deployment that
 * already has them configured does not need a second keypair, but a dedicated
 * treasury key is preferred and takes precedence.
 */
export function getTreasurySourceAccount(): TreasurySourceAccount | null {
  const publicKey = readEnv('TREASURY_SOURCE_PUBLIC_KEY') ?? readEnv('STELLAR_ADMIN_PUBLIC_KEY');
  const secret = readEnv('TREASURY_SOURCE_SECRET') ?? readEnv('STELLAR_ADMIN_SECRET');

  if (!publicKey || !secret) {
    return null;
  }

  return { publicKey, secret };
}

/** Read-only endpoints work without a signing key; only the address is needed. */
export function getTreasurySourcePublicKey(): string | null {
  return readEnv('TREASURY_SOURCE_PUBLIC_KEY') ?? readEnv('STELLAR_ADMIN_PUBLIC_KEY') ?? null;
}

/** Base URL for the explorer links surfaced alongside every position. */
export function getStellarExpertBaseUrl(): string {
  return resolveNetworkKey() === 'MAINNET'
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';
}
