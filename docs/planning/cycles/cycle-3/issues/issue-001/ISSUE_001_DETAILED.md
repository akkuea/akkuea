# C3-001: Harden Smart Contract Deployment and Initialization

## Detailed Implementation Guide

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

## Overview

The current deployment layer must be upgraded from a development script into a professional launch workflow. This issue ensures that contracts can be deployed, initialized, verified, and consumed by the API and webapp using a repeatable process suitable for tokenized real estate pilots.

## Business Context

Contract deployment is not a background technical concern. It is part of investor trust. If deployment artifacts, initialization parameters, and contract addresses are unclear or inconsistent, the platform cannot credibly support pilot properties, partner reviews, or launch readiness.

## Prerequisites

- Familiarity with Soroban deployment tooling
- Understanding of current contract entrypoints and initialization behavior
- Access to Stellar testnet credentials and deployment accounts

## Implementation Steps

### Step 1: Audit the Current Deployment Path

- Compare `scripts/deploy.sh`, `docs/contracts/deployment.md`, and the actual contract entrypoints in `apps/contracts/contracts/defi-rwa/src/lib.rs`.
- Remove assumptions about non-existent files or incorrect initialization function names.
- Confirm which contract address, admin address, oracle address, and network variables are required at deploy time.

### Step 2: Redesign the Deployment Script

- Make the deploy script fail fast on missing tools, missing credentials, or missing environment variables.
- Separate build, deploy, initialize, and verify phases so failures are easier to diagnose.
- Print contract IDs and persist them in a format that frontend and API configuration can consume safely.

### Step 3: Standardize Environment Consumption

- Define a single source of truth for deployed contract addresses per environment.
- Ensure API and webapp do not hardcode contract IDs.
- Document expected environment variable names and their ownership.

### Step 4: Add Post-Deploy Verification

- Add smoke checks that confirm the contract is reachable and initialized correctly.
- Verify at least one read path for property logic and one read path for lending logic.
- Capture the expected outputs in the deployment guide.

### Step 5: Write the Operational Runbook

- Document how to deploy to testnet, how to rotate deployer credentials, how to redeploy safely, and how to recover from partial failures.
- Include a clear rollback or redeploy procedure if initialization fails.

## Validation Strategy

- Dry-run the deployment process in a clean environment
- Verify that produced contract IDs can be consumed by API and webapp without manual patching
- Confirm that setup instructions are sufficient for another engineer to repeat the flow

## Launch Considerations

- Deployment output must be auditable and easy to share internally
- Secrets should never be embedded in scripts or docs
- Contract addresses should be environment-scoped and versioned

## Definition of Done

- Deployment script matches actual contract behavior
- Testnet deployment is reproducible end-to-end
- Contract IDs are stored and documented cleanly
- Post-deploy smoke checks are written and usable
- Deployment documentation is accurate and professional
