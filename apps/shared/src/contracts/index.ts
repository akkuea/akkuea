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
export * from "./game";
