# Integrate Privy for Embedded Stellar Wallet Login

## Context

The platform currently requires users to have an existing Stellar wallet before they can connect. This creates a significant onboarding barrier for new investors who are not already familiar with blockchain wallets. Privy provides embedded wallets that allow users to sign in with familiar methods like email or social login, and receive a Stellar wallet automatically without needing to install an extension or manage seed phrases.

This issue integrates Privy as a wallet provider within the modular provider architecture established in C4-012.

## What Needs to Be Done

Install and configure the Privy SDK for Stellar. Implement a `PrivyWalletProvider` that conforms to the `WalletProvider` interface from C4-012. Register it in the provider registry so it appears as a login option alongside the existing providers. Users selecting Privy should be able to sign in with email or a social provider and immediately have a functional Stellar address for interacting with the platform.

## Acceptance Criteria

- Privy SDK is installed and configured with a Stellar-compatible project ID.
- `PrivyWalletProvider` conforms to the `WalletProvider` interface from C4-012.
- Users can log in via email or social login through Privy and receive a Stellar wallet address.
- The connected Privy wallet can sign transactions for Stellar network operations.
- The Privy provider is registered and appears in the login UI.
- All existing wallet providers continue to work.
- All CI workflows pass on the submitted pull request.

## Dependencies

This issue depends on C4-012 because it builds on the `WalletProvider` interface and provider registry established there. Complete C4-012 before starting this issue.

## Files to Create or Modify

Create `apps/webapp/src/services/wallet/providers/privy.ts`. Register the provider in `apps/webapp/src/components/Providers.tsx`. Add the required Privy environment variables to `apps/webapp/.env.example`.

## Quality Standard

Read the Privy documentation for Stellar support before writing code. Confirm that Privy's current Stellar integration supports the transaction signing flow required by this platform before investing implementation time. If Privy's Stellar support has limitations, document them clearly in the pull request. All CI workflows must pass.
