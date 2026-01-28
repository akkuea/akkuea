# Add Request Validation Middleware with Zod

## Description

Implement a reusable request validation middleware for Elysia that uses Zod schemas. This middleware will validate request body, query parameters, and path parameters before the request reaches the controller.

## Requirements

| Requirement | Description                                  |
| ----------- | -------------------------------------------- |
| REQ-001     | Create body validation middleware            |
| REQ-002     | Create query parameter validation middleware |
| REQ-003     | Create path parameter validation middleware  |
| REQ-004     | Return 400 with detailed validation errors   |
| REQ-005     | Support optional validation                  |
| REQ-006     | Integrate with Elysia plugin system          |
| REQ-007     | Type-safe validated data access              |

## Acceptance Criteria

| Criteria                                    | Validation Method          |
| ------------------------------------------- | -------------------------- |
| Valid requests pass through                 | Integration tests          |
| Invalid body returns 400 with field errors  | Test with malformed body   |
| Invalid query returns 400 with field errors | Test with bad query params |
| Validated data is typed correctly           | TypeScript compilation     |
| Middleware is reusable across routes        | Usage in multiple routes   |

## Files to Create/Modify

| File                                    | Action | Purpose                      |
| --------------------------------------- | ------ | ---------------------------- |
| `apps/api/src/middleware/validation.ts` | Create | Validation middleware        |
| `apps/api/src/middleware/index.ts`      | Modify | Export validation middleware |
| `apps/api/src/routes/properties.ts`     | Modify | Apply validation middleware  |
| `apps/api/package.json`                 | Modify | Add Zod dependency           |

## Test Requirements

| Test Case                | Expected Result             |
| ------------------------ | --------------------------- |
| Valid body passes        | Request proceeds to handler |
| Missing required field   | 400 with field error        |
| Invalid field type       | 400 with type error         |
| Extra fields stripped    | Only valid fields passed    |
| Nested object validation | Deep validation works       |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-009/ISSUE_009_DETAILED.md

## Issue Metadata

| Attribute       | Value                                      |
| --------------- | ------------------------------------------ |
| Issue ID        | C1-009                                     |
| Title           | Add request validation middleware with Zod |
| Area            | API                                        |
| Difficulty      | Medium                                     |
| Labels          | backend, validation, medium                |
| Dependencies    | None                                       |
| Estimated Lines | 100-150                                    |
