# Ship an Environment Variable Guide, Boot-Time Validation, and CI Quality Gates

## Context

`docs/deployment/environment-variables.md` is a complete reference of every variable this project uses, but it documents *what* each variable is, not *where a contributor actually gets one*. A new contributor cloning this repository can copy `.env.example` but has no guide for where to obtain a real Stellar testnet keypair, how to get a Privy app ID, how to generate `OPERATIONS_BACKEND_CREDENTIAL`, or how to stand up the local database, without asking someone. Contributors must never add real `.env` files to the repository, but the absence of a "how do I get one" guide pushes people toward asking in chat or, worse, guessing. Separately, `CLAUDE.md` now states this project's non-negotiable rules (no em dash, no emojis, follow the design system, CI must pass) as prose; nothing currently checks any of them automatically, so they rely entirely on every contributor (human or AI) remembering to follow them.

## What Needs to Be Done

- Write `docs/ENV_SETUP.md`: for every variable in `docs/deployment/environment-variables.md`, explain where a real value comes from for local development (Stellar Laboratory or `stellar keys generate --network testnet --fund` for testnet keypairs, the Privy dashboard for `NEXT_PUBLIC_PRIVY_APP_ID` / `PRIVY_APP_SECRET`, `openssl rand -hex 32` for `OPERATIONS_BACKEND_CREDENTIAL`, `docker-compose.dev.yml` for the local database/Redis connection strings, and so on for every remaining variable). This document must never contain a real secret value, only instructions for obtaining one.
- Build a boot-time environment validation module (a reasonable location is `apps/shared/src/env/`, imported by both `apps/api` and `apps/webapp` at startup) that checks every required variable is present and well-formed (correct Stellar address/secret format, correct URL format, etc.) and fails fast with a specific, actionable error message pointing at `docs/ENV_SETUP.md`, rather than failing deep inside a request handler with a confusing stack trace.
- Add a CI step (a new small workflow or a step inside `monorepo-ci.yml`) that scans the repository for em dashes and emoji characters and fails the build if either is found outside of explicitly allowed exceptions (if any are needed, e.g. a changelog that quotes external text verbatim), operationalizing the `CLAUDE.md` rule instead of leaving it as unenforced prose.

## Acceptance Criteria

- `docs/ENV_SETUP.md` covers every variable in `docs/deployment/environment-variables.md`, with a concrete instruction for obtaining a real value for each, and contains zero real secret values.
- Starting the API or webapp with a required variable missing produces a clear, specific error identifying which variable is missing and pointing at the new guide, instead of an unrelated downstream failure.
- The new CI step correctly fails on a deliberately introduced em dash or emoji in a test commit, and passes on the current, already-cleaned codebase.
- `docs/local-setup.md` and `docs/README.md` link to the new guide.
- All five required CI workflows pass on the pull request, plus the new quality-gate check.

## Quality Standard

This issue exists to remove friction for every future contributor, human or AI, on every issue after it. The env guide must be precise enough that someone with zero prior context on this project can get a fully working local environment without asking a single question. The CI quality gate must have zero false positives against the current codebase; a check that cries wolf gets disabled, which defeats its purpose.
