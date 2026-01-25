# Implement Property CRUD Operations in PropertyController

## Description

Implement the full CRUD (Create, Read, Update, Delete) operations in the PropertyController. Replace placeholder implementations with actual business logic including validation, error handling, and proper response formatting.

## Requirements

| Requirement | Description                                    |
| ----------- | ---------------------------------------------- |
| REQ-001     | Implement getAll with pagination and filtering |
| REQ-002     | Implement getById with proper error handling   |
| REQ-003     | Implement create with input validation         |
| REQ-004     | Implement update with partial updates support  |
| REQ-005     | Implement delete with authorization check      |
| REQ-006     | Return consistent response format              |
| REQ-007     | Log all operations                             |
| REQ-008     | Handle edge cases gracefully                   |

## Acceptance Criteria

| Criteria                               | Validation Method            |
| -------------------------------------- | ---------------------------- |
| All CRUD operations work correctly     | Integration tests            |
| Pagination returns correct results     | Test with various page sizes |
| Filters work correctly                 | Test each filter parameter   |
| Invalid input returns 400 with details | Test with malformed data     |
| Non-existent resource returns 404      | Test with invalid ID         |
| Unauthorized delete returns 403        | Test without proper auth     |

## Files to Create/Modify

| File                                              | Action | Purpose              |
| ------------------------------------------------- | ------ | -------------------- |
| `apps/api/src/controllers/PropertyController.ts`  | Modify | Implement CRUD logic |
| `apps/api/src/dto/property.dto.ts`                | Create | Property DTOs        |
| `apps/api/src/repositories/PropertyRepository.ts` | Create | Property data access |

## Test Requirements

| Test Case                                   | Expected Result          |
| ------------------------------------------- | ------------------------ |
| GET /properties returns list                | Array of properties      |
| GET /properties?page=2 returns second page  | Correct offset applied   |
| GET /properties/:id returns single property | Property object          |
| POST /properties creates property           | Returns created property |
| DELETE /properties/:id removes property     | Returns 204              |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-005/ISSUE_005_DETAILED.md

## Issue Metadata

| Attribute       | Value                                                    |
| --------------- | -------------------------------------------------------- |
| Issue ID        | C1-005                                                   |
| Title           | Implement property CRUD operations in PropertyController |
| Area            | API                                                      |
| Difficulty      | Medium                                                   |
| Labels          | backend, api, medium                                     |
| Dependencies    | None                                                     |
| Estimated Lines | 150-200                                                  |
