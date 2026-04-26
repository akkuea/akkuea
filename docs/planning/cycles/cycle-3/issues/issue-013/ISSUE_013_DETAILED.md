# C3-013: Finalize Oracle Consumer and Price Guardrails in Contracts

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Issue ID        | C3-013                                                     |
| Title           | Finalize oracle consumer and price guardrails in contracts |
| Area            | CONTRACT                                                   |
| Difficulty      | Medium                                                     |
| Labels          | smart-contract, oracle, pricing, lending                   |
| Dependencies    | C3-002                                                     |
| Estimated Lines | 120-180                                                    |

## Overview

This issue completes the contract-side pricing model so that lending and risk-sensitive actions consume external valuations safely. It turns a basic oracle integration into a production-aware pricing dependency.

## Business Context

For real estate-backed lending, price quality is part of protocol safety. If stale or malformed prices are accepted on-chain, the platform risks incorrect borrowing, incorrect risk assessment, and loss of trust.

## Prerequisites

- API-side valuation service design from C3-002
- Existing `PriceOracle` module in the contract
- Borrow and risk logic already integrated with price reads

## Implementation Steps

### Step 1: Review the Current Oracle Consumer

- Audit how prices are fetched, normalized, and consumed inside borrow-related code paths.
- Identify missing staleness, decimal, and missing-value checks.

### Step 2: Add Guardrails

- Reject missing prices, invalid prices, stale prices, and values that cannot be normalized safely.
- Ensure failures are explicit and conservative.

### Step 3: Strengthen Contract Integration

- Make sure guarded prices are used consistently anywhere health-sensitive logic depends on them.
- Avoid duplicated normalization rules across code paths.

## Validation Strategy

- Test fresh, stale, malformed, and missing price scenarios
- Validate decimal normalization and edge cases
- Confirm guarded failures happen before unsafe lending actions

## Launch Considerations

- Guardrails should fail closed
- Price safety assumptions must be documented for operations and partner review

## Definition of Done

- Oracle consumer applies conservative safety checks
- Unsafe price states block sensitive operations
- Contract tests cover realistic pricing failure modes
