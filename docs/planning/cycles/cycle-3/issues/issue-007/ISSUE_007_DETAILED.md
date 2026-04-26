# C3-007: Create Admin Operations Dashboard for Property Verification

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Issue ID        | C3-007                                                      |
| Title           | Create admin operations dashboard for property verification |
| Area            | WEBAPP                                                      |
| Difficulty      | Medium                                                      |
| Labels          | frontend, admin, operations, real-estate                    |
| Dependencies    | C2-003                                                      |
| Estimated Lines | 180-260                                                     |

## Overview

This issue creates the internal operational surface required to verify, review, and manage real estate assets before and during launch. It should feel like an internal product for a serious operating team, not an ad hoc admin page.

## Business Context

Property verification is one of the strongest trust levers in tokenized real estate. Internal reviewers need a clear view of asset readiness, valuation quality, documentation status, and risk before an asset is made investable.

## Prerequisites

- Property data and verification state available from the API
- KYC and valuation metadata available or planned
- Basic route protection strategy for internal users

## Implementation Steps

### Step 1: Define the Review Queue

- Create a clear queue for draft, pending review, approved, rejected, and blocked properties.
- Surface which properties are missing valuation, legal review, metadata, or tokenization readiness.

### Step 2: Design Operational Detail Views

- Provide internal views for property summary, ownership context, asset documents, valuation status, KYC readiness, and approval history.
- Prioritize readability and decision support over visual flair.

### Step 3: Add Controlled Actions

- Support approve, reject, request changes, and operational hold actions.
- Require explicit confirmations for actions that change property state.

### Step 4: Support Auditability

- Show who performed the last action and when.
- Prepare the dashboard to consume audit events and valuation provenance as those services mature.

## Validation Strategy

- Test reviewer flows for approve, reject, and review backlog handling
- Confirm unauthorized users cannot access internal routes
- Validate that internal state remains understandable on desktop and tablet

## Launch Considerations

- The dashboard should support partner demos and internal launch operations
- Internal reviewers need concise decision context without searching multiple systems

## Definition of Done

- Internal review queue exists and is usable
- Property verification actions are available and safe
- Operational context is visible and actionable
- Access control and confirmation patterns are in place
