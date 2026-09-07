// The current Soroban deployment is a single combined contract, so these domain
// wrappers share the same underlying contract ID while exposing typed APIs by area.
export {
  buildContractClientOptions,
  createNodeContractSigner,
  resolveSorobanRpcUrl,
  type SorobanClientConfig,
} from "./clientConfig.js";
export { RealEstateTokenContractClient } from "./realEstateToken.js";
export { DefiLendingContractClient } from "./defiLending.js";
export {
  DefindexVaultContractClient,
  DefindexVaultError,
  toDefindexVaultError,
  type AssetStrategySet,
  type CurrentAssetInvestmentAllocation,
  type StrategyAllocation,
  type VaultDepositArgs,
  type VaultMethodOptions,
  type VaultWithdrawArgs,
} from "./defindexVault.js";
export * from "./game/index.js";
export * from "./pilot/index.js";
