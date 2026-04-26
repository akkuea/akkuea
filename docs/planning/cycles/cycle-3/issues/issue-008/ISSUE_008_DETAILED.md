# C3-008: Implement Risk Monitoring and Liquidation Readiness Service

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Issue ID        | C3-008                                                      |
| Title           | Implement risk monitoring and liquidation readiness service |
| Area            | API                                                         |
| Difficulty      | Medium                                                      |
| Labels          | api, monitoring, risk, lending                              |
| Dependencies    | C2-012                                                      |
| Estimated Lines | 160-240                                                     |

## Overview

This issue adds the operational risk layer required to supervise borrower health and prepare for safe liquidation support, even if full automated liquidation is still staged behind additional controls.

## Business Context

Lending without active monitoring is not launch-ready. The team needs to know which positions are healthy, which are deteriorating, and which require intervention, communication, or future liquidation handling.

## Prerequisites

- Existing borrow position tracking
- Health factor computation logic
- Basic internal API surface for operations

## Implementation Steps

### Step 1: Define Risk States

- Create a shared classification for safe, warning, critical, and action-required states.
- Use thresholds that are understandable to operations and support future liquidation decisions.

### Step 2: Build Monitoring Service

- Evaluate active borrow positions on schedule or on demand.
- Persist state transitions so the team can see how a position evolves over time.

### Step 3: Expose Monitoring Data

- Add internal endpoints for risk dashboards, notification triggers, and operational review.
- Support both summary and position-level detail views.

### Step 4: Connect to Notification and Audit Paths

- Prepare the service to generate actionable events for warnings and critical states.
- Make monitoring output suitable for admin dashboards and future liquidation execution.

## Validation Strategy

- Test threshold boundaries carefully
- Validate idempotent monitoring runs
- Confirm empty-state and stale-data handling

## Launch Considerations

- Monitoring should support manual intervention before full liquidation automation
- Thresholds should be conservative for early launch

## Definition of Done

- Risk states are computed and persisted
- Internal monitoring endpoints are available
- Warning and critical conditions can feed notifications
- Monitoring behavior is documented for launch operations
