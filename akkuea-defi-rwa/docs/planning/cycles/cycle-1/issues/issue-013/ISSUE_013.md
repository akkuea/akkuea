# Implement User CRUD Operations in UserController

## Description

Implement the user management endpoints in the UserController including user creation, profile retrieval, updates, and user lookup by wallet address. This includes proper validation and error handling.

## Requirements

| Requirement | Description |
|-------------|-------------|
| REQ-001 | Implement user registration/creation |
| REQ-002 | Implement get user by ID |
| REQ-003 | Implement get user by wallet address |
| REQ-004 | Implement get current user profile |
| REQ-005 | Implement update user profile |
| REQ-006 | Validate wallet address format |
| REQ-007 | Handle duplicate wallet addresses |
| REQ-008 | Return appropriate error responses |

## Acceptance Criteria

| Criteria | Validation Method |
|----------|-------------------|
| User creation works correctly | Integration tests |
| Profile retrieval returns correct data | Test with valid user |
| Wallet lookup returns correct user | Test with wallet address |
| Duplicate wallet returns 409 | Test with existing wallet |
| Invalid wallet format returns 400 | Test with bad address |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/src/controllers/UserController.ts` | Modify | Implement CRUD logic |
| `apps/api/src/dto/user.dto.ts` | Create | User DTOs |
| `apps/api/src/repositories/UserRepository.ts` | Create | User data access |
| `apps/api/src/routes/users.ts` | Modify | Update routes |

## Test Requirements

| Test Case | Expected Result |
|-----------|-----------------|
| POST /users creates user | Returns 201 with user data |
| GET /users/me returns profile | Current user data |
| GET /users/wallet/:address | User by wallet address |
| PUT /users/me updates profile | Updated user data |
| Duplicate wallet | Returns 409 Conflict |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-013/ISSUE_013_DETAILED.md

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-013 |
| Title | Implement user CRUD operations in UserController |
| Area | API |
| Difficulty | Medium |
| Labels | backend, api, medium |
| Dependencies | None |
| Estimated Lines | 120-180 |
