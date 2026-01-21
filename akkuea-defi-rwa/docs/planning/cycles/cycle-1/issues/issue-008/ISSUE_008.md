# Implement Real Wallet Connection with Stellar Wallets Kit

## Description

Replace the mock wallet context with a real Stellar wallet integration using Stellar Wallets Kit. This kit provides a unified interface for multiple Stellar wallets (xBull, Freighter, Albedo, Rabet, WalletConnect, Lobstr, Hana, Hot Wallet, Klever Wallet) with a built-in modal for wallet selection. This includes wallet connection/disconnection, fetching balances, and handling wallet state changes.

## Requirements

| Requirement | Description |
|-------------|-------------|
| REQ-001 | Initialize Stellar Wallets Kit with supported modules |
| REQ-002 | Implement wallet connection flow with modal selection |
| REQ-003 | Implement wallet disconnection |
| REQ-004 | Fetch and display wallet balances |
| REQ-005 | Handle network switching (testnet/mainnet) |
| REQ-006 | Persist connection state using Zustand store |
| REQ-007 | Handle wallet state change events |
| REQ-008 | Show appropriate UI for each wallet state |
| REQ-009 | Implement transaction signing interface |

## Acceptance Criteria

| Criteria | Validation Method |
|----------|-------------------|
| Wallet modal opens with available wallets | Manual testing |
| Connection flow completes successfully | Manual testing |
| Balances are fetched and displayed | Visual verification |
| Disconnection clears state | State inspection |
| Network changes are handled | Network switch test |
| Session persistence works | Page reload test |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/webapp/src/components/auth/constant/walletKit.ts` | Create | Initialize Stellar Wallets Kit |
| `apps/webapp/src/components/auth/hooks/useWallet.hook.ts` | Create | Custom wallet hook |
| `apps/webapp/src/components/auth/store/data/index.ts` | Create | Zustand store exports |
| `apps/webapp/src/components/auth/store/data/slices/authentication.slice.ts` | Create | Authentication state slice |
| `apps/webapp/src/components/auth/store/data/@types/authentication.entity.ts` | Create | TypeScript types |
| `apps/webapp/src/components/wallet/ConnectButton.tsx` | Modify | Update connection UI |
| `apps/webapp/package.json` | Modify | Add Stellar Wallets Kit dependency |

## Test Requirements

| Test Case | Expected Result |
|-----------|-----------------|
| Click connect button | Wallet modal opens |
| Select wallet from modal | Connection initiated |
| Connection succeeds | Address displayed |
| Connection rejected by user | Modal closes gracefully |
| Balance fetch | Correct balance displayed |

## Reference Implementation

- Stellar Wallets Kit Documentation: https://stellarwalletskit.dev
- Example PR: https://github.com/ScaffoldRust/SRust-Basic-Stellar-nextjs-bun/pull/16

- If you want to read more about this issue, you can read the https://github.com/akkuea/akkuea/tree/develop/akkuea-defi-rwa/docs/planning/cycles/cycle-1/issues/issue-008/ISSUE_008_DETAILED.md

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-008 |
| Title | Implement real wallet connection with Stellar Wallets Kit |
| Area | WEBAPP |
| Difficulty | High |
| Labels | frontend, wallet, stellar, high |
| Dependencies | None |
| Estimated Lines | 200-300 |
