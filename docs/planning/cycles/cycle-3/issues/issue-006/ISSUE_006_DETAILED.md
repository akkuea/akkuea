# C3-006: Implement Dividend and Cashflow Distribution

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                        |
| --------------- | -------------------------------------------- |
| Issue ID        | C3-006                                       |
| Title           | Implement dividend and cashflow distribution |
| Area            | CONTRACT                                     |
| Difficulty      | Medium                                       |
| Labels          | smart-contract, real-estate, distributions   |
| Dependencies    | C2-010                                       |
| Estimated Lines | 160-240                                      |

## Overview

Tokenized real estate becomes meaningfully investable when cashflows can be represented and distributed with confidence. This issue adds the contract-side accounting required for professional investor distributions.

## Business Context

Real estate investors expect rent-linked or servicing-linked economic flows. Even if off-chain servicing remains manual, the on-chain accounting model must be clear enough to support trust, reporting, and future automation.

## Prerequisites

- Share ownership model from earlier cycles
- Property verification and purchase flows already working
- Agreement on MVP distribution model for launch

## Implementation Steps

### Step 1: Define Distribution Model

- Decide whether the launch model is direct claim-based, snapshot-based, or allocation-based.
- Capture period boundaries, property identity, total distributed amount, and eligible share base.

### Step 2: Persist Distribution State

- Track whether an investor has already claimed for a distribution period.
- Preserve enough metadata for reporting and dispute resolution.

### Step 3: Emit Distribution Events

- Add events for distribution creation and investor claim completion.
- Make event payloads useful for downstream reporting systems.

### Step 4: Handle Safety Constraints

- Prevent duplicate claims
- Prevent distributions on invalid or unsupported property state
- Document assumptions around off-chain cash custody and on-chain accounting

## Validation Strategy

- Test single investor and multi-investor scenarios
- Validate proportional distribution logic
- Test duplicate claim prevention and edge-case rounding

## Launch Considerations

- Cashflow reporting should be clear to both operations and investors
- The MVP may still require manual treasury steps, but accounting must be auditable

## Definition of Done

- Contract supports property-linked distributions
- Investors can claim correctly
- Safety checks prevent common accounting failures
- Events and docs support operational trust
