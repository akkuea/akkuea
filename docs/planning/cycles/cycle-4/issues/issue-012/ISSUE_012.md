# Integrate smart-account-kit as a Modular Wallet Provider

## Context

The webapp currently supports wallet connections through `@creit.tech/stellar-wallets-kit`. While functional, it only covers standard Stellar wallet connections. Kalepail's `smart-account-kit` extends this with programmable Stellar smart accounts, which support features like multi-signature policies, social recovery, spending limits, and session keys. For a real estate investment platform, these capabilities translate directly to investor safety and institutional-grade account controls.

This issue integrates `smart-account-kit` as a pluggable wallet provider within a modular provider architecture, so it can be enabled or disabled independently of other wallet methods without affecting the rest of the application.

## What Needs to Be Done

Design and implement a `WalletProvider` interface that all wallet integrations conform to. Implement `smart-account-kit` as a provider that satisfies this interface. Refactor the current `stellar-wallets-kit` integration to also conform to the interface. The result should be a system where adding or removing a wallet provider requires changes only in the provider registration, not in any page or component that uses wallet functionality.

## Acceptance Criteria

- A `WalletProvider` interface exists that defines the contract for all wallet implementations.
- `smart-account-kit` is implemented as a provider conforming to this interface.
- The existing `stellar-wallets-kit` integration is refactored to conform to the same interface.
- Wallet provider selection is configurable without code changes to pages or hooks.
- The login UI presents available providers and allows the user to choose.
- All existing wallet functionality continues to work after the refactor.
- All CI workflows pass on the submitted pull request.

## Files to Create or Modify

Create `apps/webapp/src/services/wallet/` as the directory for the provider architecture. Create individual provider files inside it. Modify `apps/webapp/src/components/auth/` to use the new architecture. Update `apps/webapp/src/components/Providers.tsx` to register providers.

## Quality Standard

The interface design is the most critical part of this issue. Read the `smart-account-kit` documentation before designing the interface so it accommodates the SDK's actual API rather than an assumed one. The architecture must be genuinely modular: a provider added today must not require changes to the pages that use wallet data tomorrow. All CI workflows must pass.
