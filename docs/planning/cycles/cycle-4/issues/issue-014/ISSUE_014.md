# Integrate Pollar as Embedded Wallet SDK

## Context

Pollar (pollar.xyz) is an embedded wallet and onboarding SDK for Stellar, comparable to Privy on EVM chains. It is not a governance platform — it has no polling, voting, or on-chain governance features. Pollar handles social login (Google, GitHub, email OTP) and Freighter/Albedo passthrough, automatically creates non-custodial Stellar wallets, and provides a fee-bump-inclusive `signAndSubmitTx` API so users never need XLM for fees.

This issue adds `PollarProvider` to `apps/webapp` as an additional `WalletProvider` in the registry from C4-012, giving users a frictionless sign-in path without installing a browser extension. The governance page described in the original version of this issue is removed entirely.

## Design Note

`WalletProvider.signTransaction` returns a signed XDR string. Pollar's API does not expose a bare sign step — it signs and submits atomically via `signAndSubmitTx(xdr)`. The implementer must decide whether to: (a) extend the `WalletProvider` interface with an optional `submitTransaction` method, or (b) wrap Pollar so that `connect/disconnect/getAccount` work normally while `signTransaction` delegates to Pollar's full submit flow. Document the chosen approach in the pull request.

## What Needs to Be Done

- Install `@pollar/react` and `@pollar/core`.
- Create `apps/webapp/src/services/wallet/providers/pollar.ts` implementing `WalletProvider`.
- Create `apps/webapp/src/components/auth/PollarWrapper.tsx` wiring Pollar hooks to the provider interface via `setPollarInterface`.
- Register `pollarProvider` in `apps/webapp/src/components/Providers.tsx`.
- Add `NEXT_PUBLIC_POLLAR_API_KEY` to `apps/webapp/.env.example`.

## Out of Scope

On-chain governance, community polls, and token voting. Pollar does not provide these features. Pollar integration for `apps/akkuea-land` is covered separately by C5-008 (#840).

## Dependencies

This issue depends on C4-012 for the `WalletProvider` interface. Complete C4-012 before starting.

## Acceptance Criteria

- `PollarProvider` conforms to the `WalletProvider` interface from C4-012.
- Users can sign in via Google, GitHub, or email OTP through Pollar.
- The connected address is a valid Stellar address.
- The sign/submit mismatch is resolved and the chosen approach documented in the pull request.
- All existing providers (stellar-wallets-kit, smart-account-kit, Privy) continue to work.
- `NEXT_PUBLIC_POLLAR_API_KEY` is documented in `.env.example`.
- All CI workflows pass on the submitted pull request.
