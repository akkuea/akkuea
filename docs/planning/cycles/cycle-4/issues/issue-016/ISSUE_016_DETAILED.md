# C4-016: Migrate CONTRACT_IDS to JSON and Document Testnet Deployment

## Issue Metadata

| Attribute       | Value                              |
| --------------- | ---------------------------------- |
| Issue ID        | C4-016                             |
| Area            | SHARED                             |
| Difficulty      | Medium                             |
| Labels          | shared, stellar, contracts, medium |
| Dependencies    | None                               |
| Estimated Lines | 50-100                             |

## Overview

This issue migrates contract addresses from empty TypeScript constants to a structured JSON format and populates the testnet values by deploying the contracts.

## JSON File Format

Create two files under `apps/shared/src/`:

**contracts.testnet.json**

```json
{
  "network": "testnet",
  "deployedAt": "2026-05-XX",
  "contracts": {
    "REAL_ESTATE_TOKEN": {
      "contractId": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "txHash": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "deployedBy": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    },
    "DEFI_LENDING": {
      "contractId": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "txHash": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "deployedBy": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    }
  }
}
```

**contracts.mainnet.json**

```json
{
  "network": "mainnet",
  "deployedAt": null,
  "contracts": {
    "REAL_ESTATE_TOKEN": {
      "contractId": null,
      "txHash": null,
      "deployedBy": null
    },
    "DEFI_LENDING": {
      "contractId": null,
      "txHash": null,
      "deployedBy": null
    }
  }
}
```

## Updating the Constants

In `apps/shared/src/constants/index.ts`, replace the hardcoded empty strings with values derived from the JSON files. Use a simple conditional based on an environment variable:

```typescript
import testnetContracts from "../contracts.testnet.json";
import mainnetContracts from "../contracts.mainnet.json";

const network = process.env.STELLAR_NETWORK ?? "testnet";
const contracts = network === "mainnet" ? mainnetContracts : testnetContracts;

export const CONTRACT_IDS = {
  REAL_ESTATE_TOKEN: {
    TESTNET: testnetContracts.contracts.REAL_ESTATE_TOKEN.contractId ?? "",
    MAINNET: mainnetContracts.contracts.REAL_ESTATE_TOKEN.contractId ?? "",
  },
  DEFI_LENDING: {
    TESTNET: testnetContracts.contracts.DEFI_LENDING.contractId ?? "",
    MAINNET: mainnetContracts.contracts.DEFI_LENDING.contractId ?? "",
  },
} as const;
```

Ensure `tsconfig.json` in `apps/shared` has `"resolveJsonModule": true`. If it does not, add it.

## Deploying to Testnet

Follow the deployment guide in `docs/contracts/deployment.md`. The process requires:

1. A Stellar testnet account with sufficient XLM for deployment fees.
2. The compiled WASM artifacts from `cargo build --target wasm32v1-none --release`.
3. The Stellar CLI with the `contract deploy` command.

After deploying each contract:

1. Record the contract ID (starts with `C`).
2. Record the deployment transaction hash.
3. Verify the contract is reachable by calling a read-only function:

```bash
stellar contract invoke \
  --id CXXXXXXXXX \
  --network testnet \
  -- \
  get_pool_info
```

A successful response confirms the contract is deployed and initialized.

## Updating Documentation

Update `docs/contracts/deployment.md` with a deployment log entry:

```markdown
## Testnet Deployment - 2026-05-XX

| Contract          | Contract ID | Transaction Hash | Deployer |
| ----------------- | ----------- | ---------------- | -------- |
| REAL_ESTATE_TOKEN | CXXX...     | txhash...        | GXXX...  |
| DEFI_LENDING      | CXXX...     | txhash...        | GXXX...  |
```

## TypeScript Configuration

Ensure `apps/shared/tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

## Definition of Done

- `contracts.testnet.json` and `contracts.mainnet.json` exist in `apps/shared/src/`.
- Testnet contract IDs are populated with verified deployed addresses.
- `CONTRACT_IDS` derives its values from the JSON files.
- Deployment transaction hashes are recorded in `docs/contracts/deployment.md`.
- `bun run type-check` passes in `apps/shared`.
- All CI workflows pass on the pull request.
