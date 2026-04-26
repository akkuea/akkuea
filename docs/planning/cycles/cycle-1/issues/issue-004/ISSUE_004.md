# Add API Client Service Layer

## Description

Implement a centralized API client service layer for the webapp to communicate with the backend API. This includes creating typed fetch wrappers, error handling, and request/response interceptors.

## Requirements

| Requirement | Description                                              |
| ----------- | -------------------------------------------------------- |
| REQ-001     | Create base API client with configurable base URL        |
| REQ-002     | Implement typed request methods (GET, POST, PUT, DELETE) |
| REQ-003     | Add request interceptor for authentication headers       |
| REQ-004     | Add response interceptor for error handling              |
| REQ-005     | Create property API service module                       |
| REQ-006     | Create lending API service module                        |
| REQ-007     | Create user API service module                           |
| REQ-008     | Implement request timeout handling                       |
| REQ-009     | Add retry logic for failed requests                      |
| REQ-010     | Export all services from central index                   |

## Acceptance Criteria

| Criteria                                             | Validation Method       |
| ---------------------------------------------------- | ----------------------- |
| All API methods return properly typed responses      | TypeScript compilation  |
| Error responses are transformed to consistent format | Unit tests              |
| Request headers include auth token when available    | Integration test        |
| Timeout triggers appropriate error                   | Test with slow endpoint |
| Retry logic attempts correct number of retries       | Mock test               |

## Files to Create/Modify

| File                                         | Action | Purpose                  |
| -------------------------------------------- | ------ | ------------------------ |
| `apps/webapp/src/services/api/client.ts`     | Create | Base API client          |
| `apps/webapp/src/services/api/types.ts`      | Create | API types and interfaces |
| `apps/webapp/src/services/api/properties.ts` | Create | Property API methods     |
| `apps/webapp/src/services/api/lending.ts`    | Create | Lending API methods      |
| `apps/webapp/src/services/api/users.ts`      | Create | User API methods         |
| `apps/webapp/src/services/api/index.ts`      | Create | Service exports          |
| `apps/webapp/src/services/index.ts`          | Create | Main services export     |

## Test Requirements

| Test Case                         | Expected Result        |
| --------------------------------- | ---------------------- |
| GET request returns typed data    | Correct type inference |
| POST request sends body correctly | Request body matches   |
| 401 response triggers auth error  | AuthError thrown       |
| Network timeout triggers error    | TimeoutError thrown    |
| Retry on 5xx errors               | 3 retries attempted    |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-004/ISSUE_004_DETAILED.md

## Issue Metadata

| Attribute       | Value                        |
| --------------- | ---------------------------- |
| Issue ID        | C1-004                       |
| Title           | Add API client service layer |
| Area            | WEBAPP                       |
| Difficulty      | Medium                       |
| Labels          | frontend, api, medium        |
| Dependencies    | None                         |
| Estimated Lines | 200-300                      |
