# Build Player Onboarding and Starter Property Claim

## Context

The first two minutes of a new player's experience determine whether they stay or leave. In most blockchain games, those two minutes are spent fighting with wallets, seed phrases, and gas fees before seeing anything resembling a game. Akkuea Land can be different: Pollar handles the wallet entirely, and the onboarding flow should take the player from zero to owning their first property without them needing to understand any of that infrastructure.

## What Needs to Be Done

After a player completes the Pollar login for the first time, redirect them to the onboarding flow at `/onboarding` before they reach the city map. Store completion in `localStorage` keyed to the wallet address so the flow does not repeat.

The flow has three steps with a persistent progress indicator at the top.

Step 1: Welcome. A brief visual introduction to the game: what Akkuea Land is, what properties are, what LAND is. Two sentences maximum per concept. A hero image or illustration of the city grid. A "Get Started" button to advance.

Step 2: Claim LAND. Explains the testnet faucet. A large "Claim 1,000 LAND" button calls the faucet entry point on the LandToken contract via `pollar.signAndSubmitTx()`. While processing, the button shows "Claiming..." and a progress message ("Preparing your wallet on Stellar..."). On success, the LAND amount appears with a brief sparkle animation, and the "Continue" button becomes active.

Step 3: Claim your first property. A compact city map showing only a 5x5 section of the grid with available treasury properties highlighted. The player taps a tile to select it, then taps "Claim Free Property" to initiate the transaction. On success, a celebration animation plays (confetti burst, brief full-screen overlay), then the player is navigated to the full city map with their new property selected and the detail panel open.

Every step must have a visible "Skip" link in the upper right corner.

## Acceptance Criteria

- Onboarding flow renders after first login and not on subsequent logins.
- Faucet claim works end-to-end with loading and success states.
- Starter property selection and claim works.
- Each step has a functional "Skip" link.
- Success animation plays on property claim.
- All CI workflows pass on the submitted pull request.

## Quality Standard

The tone of every screen must be welcoming, not technical. No blockchain jargon on any onboarding screen; "wallet" is acceptable, "XDR" and "ledger sequence" are not. Loading states must have a message telling the player exactly what is happening. The celebration on property claim is not optional: it is the emotional payoff of the entire onboarding sequence.
