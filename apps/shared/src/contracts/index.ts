// The current Soroban deployment is a single combined contract, so these domain
// wrappers share the same underlying contract ID while exposing typed APIs by area.
export {
  buildContractClientOptions,
  createNodeContractSigner,
  resolveSorobanRpcUrl,
  type SorobanClientConfig,
} from "./clientConfig";
export { RealEstateTokenContractClient } from "./realEstateToken";
export { DefiLendingContractClient } from "./defiLending";
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
} from "./defindexVault";
export {
  PilotPayoutContractClient,
  PilotIncomeTokenContractClient,
  PilotWhitelistContractClient,
  type DistributionSummary,
  type EvidenceRecord,
  type PilotEvidenceRecord,
  type EvidenceStatus,
  type PilotEvidenceStatusTag,
  type FlagDisputeArgs,
  type RecordEvidenceArgs,
  type ReviewEvidenceArgs,
  type SubmitEvidenceArgs,
} from "./pilotPayout";
export * from "./game";
export * from "./pilot";
