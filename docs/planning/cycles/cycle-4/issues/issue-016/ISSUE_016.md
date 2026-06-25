# Migrate CONTRACT_IDS to JSON and Document Testnet Deployment

## Context

Contract addresses are currently stored as empty TypeScript string constants in `apps/shared/src/constants/index.ts`. This format has two problems: the values are empty and therefore useless, and TypeScript constants are the wrong format for deployment artifacts that change per environment and are updated outside the build process.

JSON files are the appropriate format for deployment artifacts. They can be read by scripts, updated by deploy pipelines, excluded from type-checking, and committed separately from application code.

## What Needs to Be Done

Create a `contracts.json` deployment artifact format that stores contract IDs per network. Migrate the `CONTRACT_IDS` constants to read from this JSON file. Deploy the `defi-rwa` contracts to Stellar testnet and populate the testnet values. Document the deployment transaction hashes and update the deployment guide.

## Acceptance Criteria

- A `contracts.json` file or equivalent JSON structure defines contract IDs per network (testnet, mainnet).
- The `CONTRACT_IDS` TypeScript constants are replaced or populated from the JSON file.
- Testnet contract IDs are populated with real deployed addresses in C format (starting with `C`).
- Deployment transaction hashes are recorded in `docs/contracts/deployment.md`.
- The API reads contract IDs from this source rather than from empty constants.
- All CI workflows pass on the submitted pull request.

## Files to Create or Modify

Create `apps/shared/src/contracts.testnet.json` (and a corresponding `contracts.mainnet.json` with placeholder values). Modify `apps/shared/src/constants/index.ts` to derive `CONTRACT_IDS` from the JSON file. Update `docs/contracts/deployment.md` with the deployment record. Update `apps/api/.env.example` if the API reads contract IDs from environment variables rather than the shared constants.

## Quality Standard

The deployed contract IDs must be verified by calling a read-only function against each deployed contract before committing them. Do not commit unverified addresses. The JSON format must be clean and self-documenting. All CI workflows must pass.
