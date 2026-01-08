# Akkuea Funding Contract Tests

## Overview

Tests for milestone-based community funding of educational projects.

## Test Categories

### Core Functions

- **Project Registration**: Create projects with milestones and funding goals
- **Voting System**: Community voting with duplicate prevention
- **Milestone Completion**: Track progress by project creators
- **Fund Release**: Automatic release when all milestones complete
- **Project Info**: Retrieve project status and metadata

### Security & Validation

- Empty title/description rejection
- Zero funding goal prevention
- Unauthorized milestone completion blocking
- Duplicate voting prevention
- Fund release authorization checks

### Edge Cases

- Multiple projects independence
- Invalid milestone IDs
- Already completed milestones
- Already released funds

## Running Tests

```bash
cd packages/soroban/contracts/akkuea-funding-contract
soroban contract test
```

## Test Coverage

- ✅ Happy path scenarios
- ✅ Error conditions
- ✅ Security validations
- ✅ Edge cases
- ✅ Integration workflows
