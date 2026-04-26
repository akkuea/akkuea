# C3-002: Implement Real Estate Valuation Oracle Service

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                          |
| --------------- | ---------------------------------------------- |
| Issue ID        | C3-002                                         |
| Title           | Implement real estate valuation oracle service |
| Area            | API                                            |
| Difficulty      | High                                           |
| Labels          | api, oracle, real-estate, pricing, production  |
| Dependencies    | C2-012                                         |
| Estimated Lines | 220-320                                        |

## Overview

This issue creates the pricing backbone for tokenized real estate. Unlike generic token price feeds, real estate valuations require provenance, freshness controls, support for manual review, and a clear record of how each value entered the system.

## Business Context

For real estate, valuation trust is central to both product credibility and risk control. Partners and investors need confidence that platform valuations are sourced, timestamped, reviewable, and safe to use for lending and reporting.

## Prerequisites

- Existing property and lending models
- Shared schema support for oracle-style payloads
- Agreement on what constitutes a valid valuation source for launch

## Implementation Steps

### Step 1: Define the Valuation Model

- Represent valuations in terms of property identity, valuation amount, currency, source, effective timestamp, ingestion timestamp, and optional reviewer metadata.
- Include provenance fields such as provider name, report reference, valuation method, and confidence notes where applicable.

### Step 2: Add Ingestion and Validation

- Build an internal ingestion path for new valuations.
- Validate freshness, numerical bounds, required identity fields, and source metadata.
- Reject stale, malformed, or structurally incomplete pricing events.

### Step 3: Persist Historical Records

- Store the latest valuation and maintain an append-only history of valuation updates.
- Preserve enough metadata for later partner review or audit export.

### Step 4: Expose Internal APIs

- Add endpoints to fetch latest property valuation, recent history, and any operational metadata required by internal dashboards or contract sync processes.
- Ensure these endpoints are shaped for product, operations, and contract integration use cases.

### Step 5: Prepare Contract-Facing Payloads

- Normalize values into a predictable format that the contract-side oracle consumer can rely on.
- Document what happens when a valuation exists but is not eligible for contract consumption.

## Validation Strategy

- Test valid ingestion, stale ingestion, malformed payloads, and source mismatches
- Verify historical ordering and latest-value selection
- Confirm that contract-facing values are normalized consistently

## Launch Considerations

- Manual review fallback should exist for pilot launch
- Valuation provenance must be visible in internal tools
- The service should fail closed when valuation quality is uncertain

## Definition of Done

- Latest and historical valuations are persisted and queryable
- Validation rules enforce freshness and structural integrity
- Pricing payloads include provenance and operational metadata
- Contract-facing normalization is documented and testable
- The service supports a credible real estate launch narrative
