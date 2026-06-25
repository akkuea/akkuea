# Integrate Pollar Authentication and Wallet Provider

## Context

Akkuea Land targets players, not crypto-native investors. Requiring them to install Freighter, fund a wallet, and manage transaction fees before they can play a single move is a conversion killer. Pollar solves this: it provisions a Stellar wallet behind a social login (Google, GitHub, or email OTP) and sponsors all transaction fees so players never see gas costs.

This issue wires Pollar into akkuea-land as the single authentication and signing layer. Every subsequent game action (buying a property, improving a building, listing on the marketplace) flows through `pollar.signAndSubmitTx()`.

## What Needs to Be Done

Install `@pollar/react` and `@pollar/core`. Wrap the app root with `PollarProvider` configured with the publishable API key (`pub_testnet_...`). Create the login page at `/(auth)/login/page.tsx` with three options: Google, email OTP, and "Connect Freighter" for existing Stellar users who prefer their own key custody.

Implement route protection: any unauthenticated request to `/map`, `/marketplace`, or `/dashboard` redirects to `/login`. On successful login, redirect back to the intended destination.

Create a `useGameWallet` hook that wraps `usePollar()` and exposes the shape the rest of the app expects: `wallet` (address and balance), `login`, `logout`, and `signAndSubmitTx`. This abstraction means no other component imports from `@pollar/react` directly; they all go through `useGameWallet`.

Build the wallet status widget in the game shell nav: shows the abbreviated wallet address and LAND balance when connected, and a "Connect" button when not.

## Acceptance Criteria

- Players can log in with Google, email, or Freighter.
- Unauthenticated routes redirect to `/login`.
- `useGameWallet` exposes wallet state and `signAndSubmitTx` to all game components.
- Wallet status in the nav updates immediately after login and logout.
- All CI workflows pass on the submitted pull request.

## Quality Standard

The login page is the first screen new players see. It must be polished: clear value proposition, no blockchain jargon, fast. The three login options should be visually distinct. Error states (invalid email, wallet rejected) must surface a readable message, not a raw error code. No `@pollar/react` imports outside of `useGameWallet` and `PollarProvider`.
