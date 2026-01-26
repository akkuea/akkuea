# Issue Creation Guide

This document provides guidelines and templates for creating issues in the Akkuea DeFi RWA project. Following these standards ensures consistency, clarity, and efficient project management across all development areas.

## Table of Contents

| Section | Description |
|---------|-------------|
| [Issue Structure](#issue-structure) | Overview of issue organization |
| [Difficulty Levels](#difficulty-levels) | Classification criteria |
| [Dependency Rules](#dependency-rules) | Cross-cycle dependency guidelines |
| [Issue Naming Convention](#issue-naming-convention) | File and title formats |
| [Templates](#templates) | Development templates by area |
| [Labels](#labels) | Standard label definitions |

---

## Issue Structure

Each issue in this project consists of two documentation files:

| File Type | Purpose | Audience |
|-----------|---------|----------|
| `ISSUE_XXX.md` | Professional summary with clear requirements | Project managers, reviewers |
| `ISSUE_XXX_DETAILED.md` | Technical implementation guide with code examples | Software developers |

### Professional File Structure

The professional file (`ISSUE_XXX.md`) must contain:

1. Issue metadata table (ID, area, difficulty, dependencies)
2. Clear description
3. Requirements list
4. Acceptance criteria
5. Estimated scope

### Detailed File Structure

The detailed file (`ISSUE_XXX_DETAILED.md`) must contain:

1. All content from professional file
2. Code examples and snippets
3. File paths and locations
4. Implementation steps
5. Testing guidelines
6. Related resources and references

---

## Difficulty Levels

| Level | Description | Typical Scope | Time Estimate |
|-------|-------------|---------------|---------------|
| Trivial | Typos, small bug fixes, minor copy changes, configuration updates | 1-20 lines of code | Less than 2 hours |
| Medium | Standard features, involved bug fixes, component implementations | 20-200 lines of code | 2-8 hours |
| High | Complex features, major refactors, new integrations, architectural changes | 200+ lines of code | 8+ hours |

### Criteria for Classification

**Trivial**
- Single file changes
- No new dependencies
- No architectural impact
- Straightforward implementation path

**Medium**
- Multiple file changes within same module
- May introduce minor dependencies
- Limited architectural impact
- Clear implementation path with some complexity

**High**
- Cross-module changes
- New external dependencies or integrations
- Significant architectural considerations
- Requires design decisions and research

---

## Dependency Rules

Dependencies define the relationship between issues and determine execution order.

### Allowed Dependencies

| Scenario | Allowed |
|----------|---------|
| Issue in Cycle 2 depends on Issue in Cycle 1 | Yes |
| Issue in Cycle 3 depends on Issue in Cycle 1 | Yes |
| Issue in Cycle 3 depends on Issue in Cycle 2 | Yes |
| Issue in Cycle 1 depends on Issue in Cycle 1 | No |
| Issue in Cycle 2 depends on Issue in Cycle 2 | No |

### Dependency Declaration Format

```markdown
| Dependencies | C1-003, C1-007 |
```

When an issue has no dependencies:

```markdown
| Dependencies | None |
```

### Dependency Chain Limit

- Maximum dependency chain depth: 3 cycles
- Circular dependencies are not permitted
- Each issue should minimize dependencies to enable parallel work

---

## Issue Naming Convention

### File Names

```
ISSUE_XXX.md
ISSUE_XXX_DETAILED.md
```

Where `XXX` is a zero-padded three-digit number (001, 002, ... 017).

### Directory Structure

```
docs/planning/cycles/cycle-N/issues/issue-XXX/
├── ISSUE_XXX.md
└── ISSUE_XXX_DETAILED.md
```

### Issue ID Format

| Component | Format | Example |
|-----------|--------|---------|
| Cycle prefix | C + cycle number | C1, C2, C3 |
| Issue number | Three digits | 001, 002, 017 |
| Full ID | Prefix + hyphen + number | C1-001, C2-017 |

### Title Format

```
[AREA] Brief description of the task
```

Areas:
- `[API]` - Backend development
- `[CONTRACT]` - Smart contract development
- `[SHARED]` - Shared library development
- `[WEBAPP]` - Frontend development

---

## Templates

### Frontend Development Template

```markdown
---
name: Frontend Development
about: Task template for frontend implementation work
title: 'feat: '
labels: frontend
assignees: ''
---

**Description**

Implement [specific component/page/feature] according to the provided specification.

**Requirements and context**

- Component must handle loading, error, success, and disconnected states
- Display correct data format in [specific UI element] when success
- Show user-friendly error message when API / Soroban query returns failure
- Disable interactive elements during loading/disconnected
- Maintain visual consistency with existing [related component/page]
- Responsive layout required for mobile (≤768px) and desktop

**Suggested execution**

1. git checkout -b feature/[short-description-kebab-case]
2. Create/update component(s) in `src/components/[FeatureName]/`
3. Implement state management using [zustand/react-query/context] as appropriate
4. Add corresponding styles in `src/styles/components/` or module CSS
5. Update page/route in `src/pages/` or `src/routes/` if needed
6. Add necessary types in `src/types/`

**Test and commit**

- [ ] Component renders without crashing in all four states
- [ ] All interactive elements are disabled during loading/disconnected
- [ ] Error message appears for failed requests/queries
- [ ] Visual regression test passed (if applicable)
- [ ] All new strings are added to i18n files

Example commit:
`git commit -m "feat: implement staking position card with loading/error states"`
or
`git commit -m "fix: disable claim button during pending transaction"`

**Guidelines**

- Must be assigned before starting work
- Use existing component library primitives when possible
- No inline styles except for dynamic calculations
- All new components must export types
- PR must include before/after screenshots in description
```

---

### Backend Development Template

```markdown
---
name: Backend Development
about: Task template for backend implementation work
title: 'feat: '
labels: backend
assignees: ''
---

**Description**

Implement [specific endpoint/service/feature] in the backend.

**Requirements and context**

- New endpoint: [METHOD] /api/v1/[resource]/[action]
- Request body validation using [zod/joi/class-validator]
- Return 201 on successful creation, 200 on update/success
- Return 400 with detailed validation errors
- Return 404 when referenced resource not found
- Return 429 when rate limit exceeded
- Include proper error code and message in error responses
- Log request/response metadata at INFO level
- Soroban interaction errors must be mapped to appropriate HTTP status

**Suggested execution**

1. git checkout -b feature/[short-description-kebab-case]
2. Create/update controller in `src/controllers/v1/`
3. Add/update service logic in `src/services/`
4. Define DTO/schema in `src/dto/` or `src/schemas/`
5. Register route in `src/routes/v1/`
6. Add input validation middleware if needed
7. Update Soroban interaction helpers in `src/lib/soroban/` if required
8. Update OpenAPI spec in `openapi.yaml` or controller decorators

**Test and commit**

- [ ] Unit tests cover happy path + all error cases
- [ ] Integration tests verify database changes and Soroban simulation results
- [ ] Validation rejects malformed/invalid input
- [ ] 401/403 returned when unauthorized
- [ ] Response matches OpenAPI schema

Example commit:
`git commit -m "feat: add claim rewards endpoint with Soroban transaction submission"`
or
`git commit -m "fix: improve error mapping for Soroban invokeHostFunction failures"`

**Guidelines**

- Assignment required before starting
- Use existing service layer patterns
- Never commit secrets, private keys or hardcoded credentials
- All new endpoints must have OpenAPI documentation
- Keep controller methods ≤ 30 lines when possible
```

---

### Smart Contract Development Template

```markdown
---
name: Smart Contract Development
about: Task template for Soroban smart contract implementation work
title: 'feat: '
labels: smart-contract, soroban
assignees: ''
---

**Description**

Implement [specific contract / functionality / upgrade] on Soroban.

**Requirements and context**

- Contract written in Rust for Soroban platform
- Must implement required interfaces (e.g. custom interface, token interface if applicable)
- Support [list of functions] with correct events emitted
- Enforce access control using [ownable / roles / address checks]
- Include reentrancy protection where external calls are made
- Prevent panic on overflow/underflow (use checked arithmetic)
- Include admin-controlled pause / emergency stop functionality
- Contract storage usage and invocation cost must stay reasonable

**Suggested execution**

1. git checkout -b feature/[short-description-kebab-case]
2. Create/update contract in `contracts/src/[contract_name].rs`
3. Add comprehensive contract-level and function-level doc comments
4. Implement storage, events, and function logic
5. Add/modify tests in `contracts/tests/`
6. Update deployment / initialization script in `deploy/` if needed

**Test and commit**

- [ ] All unit tests pass (cargo test)
- [ ] 100% branch coverage on new/changed logic
- [ ] Contract compiles with stable Soroban SDK version
- [ ] Soroban CLI simulation succeeds for main functions
- [ ] No high/medium severity issues from soroban-tools / clippy
- [ ] Invocation budget stays below target limits in tests

Example commit:
`git commit -m "feat(soroban): implement staking pool with reward distribution"`
or
`git commit -m "fix(soroban): add missing access control on admin withdraw function"`

**Guidelines**

- Must be assigned before starting work
- Use current stable Soroban SDK version
- Never hardcode secret/private keys in source
- All public/external functions must have full doc comments
- PR must include simulation output / budget usage for main functions
- Tests must cover failure modes and edge cases
```

---

### Shared Library Development Template

```markdown
---
name: Shared Library Development
about: Task template for shared library implementation work
title: 'feat: '
labels: shared
assignees: ''
---

**Description**

Implement [specific utility/type/service] in the shared library.

**Requirements and context**

- Code must be framework-agnostic (usable by both webapp and API)
- Full TypeScript type coverage required
- No side effects in utility functions
- Must export all public types and functions from index.ts
- Documentation comments required for all exports
- Consider bundle size impact for webapp consumers

**Suggested execution**

1. git checkout -b feature/[short-description-kebab-case]
2. Create/update module in `apps/shared/src/[module]/`
3. Define types in `apps/shared/src/types/`
4. Add utility functions in `apps/shared/src/utils/`
5. Export from `apps/shared/src/index.ts`
6. Add unit tests in `apps/shared/tests/`

**Test and commit**

- [ ] All unit tests pass
- [ ] TypeScript strict mode passes
- [ ] No circular dependencies introduced
- [ ] Exports are properly documented
- [ ] Bundle size impact is acceptable

Example commit:
`git commit -m "feat(shared): add property validation utilities"`
or
`git commit -m "fix(shared): correct LendingPool type definition"`

**Guidelines**

- Must be assigned before starting work
- Prefer pure functions over stateful modules
- Use semantic versioning for breaking changes
- All public APIs must have JSDoc comments
- Consider backwards compatibility
```

---

## Labels

| Label | Description | Color |
|-------|-------------|-------|
| `frontend` | Frontend/webapp related tasks | Blue |
| `backend` | Backend/API related tasks | Green |
| `smart-contract` | Soroban contract tasks | Purple |
| `shared` | Shared library tasks | Orange |
| `soroban` | Stellar/Soroban blockchain tasks | Yellow |
| `trivial` | Low complexity task | Gray |
| `medium` | Medium complexity task | Yellow |
| `high` | High complexity task | Red |
| `blocked` | Task is blocked by dependency | Red |
| `in-progress` | Task is being worked on | Blue |
| `review` | Task is ready for review | Purple |
| `done` | Task is completed | Green |

---

## Checklist for Issue Creation

Before submitting a new issue, verify:

| Item | Verified |
|------|----------|
| Issue ID follows naming convention | |
| Difficulty level is appropriate | |
| Dependencies are correctly declared | |
| No same-cycle dependencies exist | |
| Both professional and detailed files created | |
| Code examples included in detailed file | |
| Acceptance criteria are measurable | |
| Appropriate labels assigned | |
| Area tag is correct | |

---

## Example Issue

See `docs/planning/cycles/cycle-1/issues/issue-001/` for a complete example of properly formatted issue documentation.
