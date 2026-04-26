# C3-004: Create Launch-Grade Test Harnesses and Staging Fixtures

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Issue ID        | C3-004                                                  |
| Title           | Create launch-grade test harnesses and staging fixtures |
| Area            | SHARED                                                  |
| Difficulty      | Medium                                                  |
| Labels          | testing, qa, staging, shared                            |
| Dependencies    | C1-006                                                  |
| Estimated Lines | 120-180                                                 |

## Overview

Launch readiness depends on repeatable testing. This issue creates shared fixtures and staging scenarios that mirror how the tokenized real estate platform will actually be used during a pilot.

## Business Context

High-confidence launches require more than unit tests. The team needs realistic seeded scenarios that exercise property creation, verification, investment, valuation updates, lending, monitoring, and investor reporting.

## Prerequisites

- Existing test suites in contracts, API, and webapp
- Agreement on the minimum launch scenario to simulate

## Implementation Steps

### Step 1: Define Canonical Staging Scenarios

- Create one or two representative property scenarios with realistic values, share counts, and investor activity.
- Include KYC-ready users, verified properties, valuation events, and lending positions.

### Step 2: Build Shared Factories

- Extract common setup helpers for users, properties, pools, valuations, and transactions.
- Remove duplicated launch setup logic from individual tests where practical.

### Step 3: Add Smoke-Test Fixtures

- Support a baseline scenario that can be reused for manual QA and smoke checks before demo or deploy.
- Ensure data is deterministic enough for regression use.

## Validation Strategy

- Run representative contract, API, and webapp tests using the shared fixtures
- Verify that a new engineer can use the fixtures without bespoke setup knowledge

## Launch Considerations

- Fixtures should look like real real-estate product flows, not abstract toy data
- Staging data should support demos, screenshots, and internal validation

## Definition of Done

- Shared launch fixtures exist and are documented
- Test duplication is reduced in critical paths
- Smoke tests can run against predictable staging data
