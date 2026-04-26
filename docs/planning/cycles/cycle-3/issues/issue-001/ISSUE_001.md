# Harden Smart Contract Deployment and Initialization

## Description

Create a production-grade deployment workflow for the tokenized real estate contracts. The deployment flow must be deterministic, documented, environment-aware, and aligned with the actual Soroban contract entrypoints used by the codebase.

## Requirements

| Requirement | Description                                                 |
| ----------- | ----------------------------------------------------------- |
| REQ-001     | Audit current deployment scripts against real contract API  |
| REQ-002     | Implement reproducible testnet deployment flow              |
| REQ-003     | Support environment-specific contract configuration         |
| REQ-004     | Capture deployed contract addresses and initialization data |
| REQ-005     | Add validation and failure handling to deploy scripts       |
| REQ-006     | Document rollback and redeploy procedures                   |
| REQ-007     | Ensure frontend and API consume deployed addresses safely   |

## Acceptance Criteria

| Criteria                                               | Validation Method              |
| ------------------------------------------------------ | ------------------------------ |
| Deployment script matches actual contract entrypoints  | Manual review and dry run      |
| Testnet deployment succeeds end-to-end                 | Deployment verification        |
| Contract IDs are persisted for app consumption         | Integration test or smoke test |
| Initialization parameters are documented and validated | Documentation review           |
| Redeploy path is clear and repeatable                  | Runbook review                 |

## Files to Create/Modify

| File                                     | Action | Purpose                                 |
| ---------------------------------------- | ------ | --------------------------------------- |
| `scripts/deploy.sh`                      | Modify | Correct and harden deployment flow      |
| `docs/contracts/deployment.md`           | Modify | Align deploy documentation with reality |
| `apps/contracts/contracts/defi-rwa/src/` | Review | Confirm callable entrypoints and config |
| `apps/api/src/`                          | Modify | Read deployed contract configuration    |
| `apps/webapp/src/`                       | Modify | Consume deployment environment safely   |

## Test Requirements

| Test Case                                     | Expected Result                    |
| --------------------------------------------- | ---------------------------------- |
| Deploy to testnet with valid credentials      | Contracts deploy and initialize    |
| Run deploy with missing environment variables | Script fails with actionable error |
| Run post-deploy smoke checks                  | Expected contract reads succeed    |
| Switch app config to deployed addresses       | Frontend and API boot successfully |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-3/issues/issue-001/ISSUE_001_DETAILED.md

## Issue Metadata

| Attribute       | Value                                               |
| --------------- | --------------------------------------------------- |
| Issue ID        | C3-001                                              |
| Title           | Harden smart contract deployment and initialization |
| Area            | CONTRACT                                            |
| Difficulty      | High                                                |
| Labels          | smart-contract, soroban, deployment, production     |
| Dependencies    | C2-016                                              |
| Estimated Lines | 180-260                                             |
