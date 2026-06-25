import { CONTRACT_IDS } from '@real-estate-defi/shared';

/**
 * Resolves Soroban contract IDs for the API.
 *
 * Source of truth is the shared per-network deployment artifacts
 * (`apps/shared/src/contracts.<network>.json`, surfaced via `CONTRACT_IDS`).
 * An explicit environment variable still wins when set, so operators can point
 * the API at a custom/local deployment without editing committed artifacts.
 */

type NetworkKey = 'TESTNET' | 'MAINNET';

const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

/**
 * Determine the active network from configuration. `STELLAR_NETWORK` takes
 * precedence; otherwise the network passphrase is inspected. Defaults to
 * testnet, matching the rest of the Stellar configuration in this service.
 */
export function resolveNetworkKey(): NetworkKey {
  const network = (process.env.STELLAR_NETWORK ?? '').trim().toLowerCase();
  if (network === 'mainnet' || network === 'public') {
    return 'MAINNET';
  }
  if (network === 'testnet') {
    return 'TESTNET';
  }

  const passphrase = process.env.STELLAR_NETWORK_PASSPHRASE ?? '';
  return passphrase === MAINNET_PASSPHRASE ? 'MAINNET' : 'TESTNET';
}

/** Real Estate Token contract ID (env override → shared deployment artifact). */
export function getRealEstateTokenContractId(): string {
  const fromEnv = process.env.REAL_ESTATE_TOKEN_CONTRACT_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return CONTRACT_IDS.REAL_ESTATE_TOKEN[resolveNetworkKey()] ?? '';
}

/** DeFi RWA / lending contract ID (env override → shared deployment artifact). */
export function getDefiRwaContractId(): string {
  const fromEnv = process.env.DEFI_RWA_CONTRACT_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return CONTRACT_IDS.DEFI_LENDING[resolveNetworkKey()] ?? '';
}
