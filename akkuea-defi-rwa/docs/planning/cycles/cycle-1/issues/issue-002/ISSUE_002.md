# Implement Database Connection and ORM Setup

## Description

Set up PostgreSQL database connection and Drizzle ORM for the API. This includes configuring the connection pool, defining database schemas, creating migration infrastructure, and implementing the base repository pattern.

## Requirements

| Requirement | Description |
|-------------|-------------|
| REQ-001 | Configure PostgreSQL connection with connection pooling |
| REQ-002 | Set up Drizzle ORM with TypeScript support |
| REQ-003 | Create database schema for properties table |
| REQ-004 | Create database schema for users table |
| REQ-005 | Create database schema for lending pools table |
| REQ-006 | Create database schema for positions table |
| REQ-007 | Create database schema for transactions table |
| REQ-008 | Implement migration system |
| REQ-009 | Add database health check endpoint |
| REQ-010 | Create base repository class |
| REQ-011 | Add environment variable configuration |

## Acceptance Criteria

| Criteria | Validation Method |
|----------|-------------------|
| Database connects successfully on startup | Health check endpoint returns 200 |
| All tables created via migrations | Migration execution verification |
| Connection pool handles concurrent requests | Load test with 50 concurrent connections |
| Graceful shutdown closes connections | Process termination test |
| TypeScript types generated from schema | Type inference in IDE |
| Environment variables properly loaded | Config validation on startup |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/src/db/index.ts` | Create | Database connection and export |
| `apps/api/src/db/schema/index.ts` | Create | Schema exports |
| `apps/api/src/db/schema/properties.ts` | Create | Properties table schema |
| `apps/api/src/db/schema/users.ts` | Create | Users table schema |
| `apps/api/src/db/schema/lending.ts` | Create | Lending tables schema |
| `apps/api/src/db/schema/transactions.ts` | Create | Transactions table schema |
| `apps/api/src/db/migrate.ts` | Create | Migration runner |
| `apps/api/src/repositories/BaseRepository.ts` | Create | Base repository class |
| `apps/api/drizzle.config.ts` | Create | Drizzle configuration |
| `apps/api/package.json` | Modify | Add dependencies |
| `apps/api/.env.example` | Modify | Add database variables |

## Test Requirements

| Test Case | Expected Result |
|-----------|-----------------|
| Database connection success | Connection established |
| Database connection failure handling | Graceful error with retry |
| Migration up execution | Tables created |
| Migration down execution | Tables dropped |
| Health check with active connection | Returns healthy status |
| Health check with dead connection | Returns unhealthy status |

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-002/ISSUE_002_DETAILED.md

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-002 |
| Title | Implement database connection and ORM setup |
| Area | API |
| Difficulty | High |
| Labels | backend, database, high |
| Dependencies | None |
| Estimated Lines | 300-400 |
