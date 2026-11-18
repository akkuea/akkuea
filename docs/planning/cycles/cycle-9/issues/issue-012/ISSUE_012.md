# Pilot environment variables are outside the shared env schema, and the ally address is undocumented

| Field           | Value   |
| --------------- | ------- |
| ID              | C9-012  |
| Area            | DX      |
| Difficulty      | Medium  |
| Dependencies    | C6-007  |
| Estimated Lines | 150-300 |

## Context

`apps/shared/src/env/` validates the environment at startup. None of the pilot variables are in it:

- Webapp: `NEXT_PUBLIC_PILOT_ALLY_ADDRESS`, `NEXT_PUBLIC_PILOT_START_CYCLE`, `NEXT_PUBLIC_PILOT_PAYMENT_DAY`, `NEXT_PUBLIC_PILOT_PROPERTY_SPLAT_URL`, and the three `NEXT_PUBLIC_PILOT_*_CONTRACT_ID` overrides.
- API: the `PILOT_ESCALATION_*` variables read in `apps/api/src/workers/pilotEscalationJob.ts`.

A bad value is silently replaced by a default in `apps/webapp/src/services/pilot/config.ts`: a start cycle of `2026-1` becomes `2026-01`, a payment day of `31` becomes `5`. `NEXT_PUBLIC_PILOT_ALLY_ADDRESS` is also missing from every `.env.example` and from `docs/deployment/environment-variables.md`, and without it every co-signed action throws `PilotAllyNotConfiguredError`.

## What Needs to Be Done

- Add the pilot variables to the shared env schema with their formats: Stellar public key, contract id, `YYYY-MM`, integer 1 to 28, https URL, ISO date, positive numbers.
- Make an invalid value fail validation with a message that names the variable.
- Keep the documented defaults for variables that are optional.
- Add every variable to the `.env.example` files and to `docs/deployment/environment-variables.md`, with what it is for and who sets it.
- Add schema tests under `apps/shared/src/env/__tests__/`.

## Scope

In scope: shared env schema and tests, `.env.example` files, the env documentation.

Out of scope: removing `NEXT_PUBLIC_PILOT_ALLY_ADDRESS`, changing the escalation job's behavior (C9-006).

## Acceptance Criteria

- [ ] An invalid ally address, start cycle, payment day or contract id fails validation with a message naming the variable.
- [ ] A missing optional variable still resolves to its documented default.
- [ ] Every pilot variable read in code appears in `.env.example` and in the documentation.
- [ ] The new schema tests pass in `apps/shared`.

## How to Verify

```bash
cd apps/shared && bun test && bun run type-check
```
