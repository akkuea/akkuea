# C6-007: Ship an Environment Variable Guide, Boot-Time Validation, and CI Quality Gates

## Issue Metadata

| Attribute       | Value                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Issue ID        | C6-007                                                                                                          |
| Area            | TOOLING (SHARED + API + WEBAPP)                                                                                 |
| Difficulty      | High                                                                                                            |
| Labels          | documentation, shared, backend, high                                                                            |
| Dependencies    | None                                                                                                            |
| Estimated Lines | 4000-5000 (env schema + validator + tests across three workspaces, CI workflow, and a genuinely thorough guide) |

**Description**

Ship `docs/ENV_SETUP.md`, a schema-driven env validator shared across `apps/api` and `apps/webapp`, and a CI quality gate enforcing the `CLAUDE.md` no-em-dash / no-emoji rule.

**Requirements and context**

- `docs/ENV_SETUP.md` structure: one section per variable group already established in `docs/deployment/environment-variables.md` (Database, API Server, Internal Security, KYC, Stellar/Soroban Network, Stellar/Soroban Admin Identity, Stellar/Soroban Contracts), each entry answering "where do I get a real value for local development" concretely:
  - Stellar keypairs: `stellar keys generate --network testnet --fund`, or Stellar Laboratory's account creator, both already referenced elsewhere in this repo's docs.
  - `NEXT_PUBLIC_PRIVY_APP_ID` / `PRIVY_APP_SECRET`: the Privy dashboard at dashboard.privy.io, already referenced in `apps/webapp/.env.example`'s comments.
  - `OPERATIONS_BACKEND_CREDENTIAL`: `openssl rand -hex 32`, already noted in `environment-variables.md`.
  - `DATABASE_URL` / `REDIS_URL`: `docker-compose.dev.yml`'s default local credentials.
  - `KYC_UPLOAD_DIR`: any local writable directory for development; document the production expectation separately (not publicly accessible).
  - Contract ID variables: point to the relevant deployment doc (`docs/deployment/deploy-contracts.md`, `docs/deployment/deploy-game-contracts.md`, and the new pilot deployment doc from C6-001) rather than a real value.
- Env schema/validator: a plausible shape is a Zod schema per workspace's required variable set (`apps/shared/src/env/apiEnvSchema.ts`, `webappEnvSchema.ts`, or a single schema with per-consumer subsets), validated once at process start (`apps/api/src/index.ts`, and the earliest feasible point in `apps/webapp`'s server startup), throwing a clear aggregated error listing every missing/malformed variable at once, not one at a time across multiple restart cycles.
- CI quality gate: a small script (Python or a shell one-liner with `grep`, whichever is more maintainable) that scans tracked files for the em dash character and common emoji Unicode ranges, excluding `node_modules`, `.git`, lockfiles, and any other generated-content directories; wire it as a step in `monorepo-ci.yml` or a new lightweight workflow.

**Suggested execution**

1. `git checkout -b feature/env-guide-validation-and-quality-gates`
2. Write `docs/ENV_SETUP.md` first; it clarifies exactly which variables the validator needs to check and how.
3. Build the env schema and validator in `apps/shared/src/env/`, with unit tests covering both the success case and several documented failure cases (missing variable, malformed Stellar address, malformed URL).
4. Wire the validator into `apps/api`'s startup and `apps/webapp`'s startup.
5. Build and test the em-dash/emoji CI scanner script.
6. Add it as a CI step, confirm it passes on the current codebase and fails on a deliberately introduced violation in a throwaway test commit (revert the test commit before merging).
7. Link the new guide from `docs/local-setup.md` and `docs/README.md`.

**Test and commit**

- [ ] Env validator unit tests cover success and every documented failure mode
- [ ] API and webapp both fail fast with a clear, specific message when a required variable is missing, verified by an integration test that unsets a variable and asserts the resulting error
- [ ] CI quality gate correctly fails against a deliberately introduced em dash and a deliberately introduced emoji, verified during development and then reverted before merge
- [ ] CI quality gate passes cleanly against the current `develop` state

Example commit:
`git commit -m "feat(shared): add env schema validation and ci quality gates for style rules"`

**Guidelines**

- `docs/ENV_SETUP.md` must never contain a real secret value; every example should be either a placeholder or an instruction for generating one locally.
- The validator's error output is a developer-experience surface; write it as carefully as any user-facing error message.
- Keep the CI scanner's false-positive rate at zero against the current codebase before merging; a noisy check will get disabled rather than fixed.
