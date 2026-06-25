# C5-017: Write Game Rules Guide and Developer Setup Documentation

## Issue Metadata

| Attribute       | Value                  |
| --------------- | ---------------------- |
| Issue ID        | C5-017                 |
| Area            | SHARED                 |
| Difficulty      | Trivial                |
| Labels          | documentation, trivial |
| Dependencies    | None                   |
| Estimated Lines | 200-300 (markdown)     |

## GAME_RULES.md Outline

Create `docs/game/GAME_RULES.md`. Target audience: someone who has never touched a blockchain product.

**What is Akkuea Land**
A real estate game on Stellar. You buy virtual properties, earn income over time, and trade with other players. Everything happens on Stellar, which is a fast and cheap blockchain. You don't need to know what a blockchain is to play.

**Getting In**
Sign in with Google, GitHub, or your email address. A Stellar wallet is created for you automatically. You don't need to install anything.

**LAND Tokens**
LAND is the in-game currency. New players can claim 1,000 LAND from the faucet during setup. You earn more LAND by collecting rental income from your properties.

**The City**
The city is a 20x20 grid of 400 property tiles. Each tile has grid coordinates like (3, 7). You can see all tiles on the City Map. Colors show who owns each property.

**Buying Properties**
Vacant properties (owned by the Treasury) cost 500 LAND. Once you own a property, it starts generating rental income. You can also buy properties from other players on the Marketplace.

**Rental Income**
Every 100 ledgers, your property earns rental income automatically. A ledger is a unit of time on Stellar (roughly 5 seconds each), so 100 ledgers is about 8 minutes.

| Building Level | Income per 100 Ledgers |
| -------------- | ---------------------- |
| Vacant         | 10 LAND                |
| Residential    | 15 LAND                |
| Commercial     | 30 LAND                |
| Skyscraper     | 60 LAND                |

Income doesn't disappear if you don't collect it immediately; it accumulates until you claim it from the Dashboard.

**Improving Buildings**
You can upgrade your property to earn more income. Each upgrade is permanent.

| Upgrade                   | Cost       |
| ------------------------- | ---------- |
| Vacant to Residential     | 200 LAND   |
| Residential to Commercial | 600 LAND   |
| Commercial to Skyscraper  | 1,800 LAND |

Click a property you own on the City Map, then click "Improve."

**Selling Properties**
Open the City Map, click your property, and click "List for Sale." Enter the price you want. Other players can buy it from the Marketplace. You can cancel a listing at any time before someone buys it.

**Strategy**

- Buy properties early and improve them over time.
- Skyscrapers earn 6x more than vacant lots; the upgrade cost pays for itself quickly.
- The Marketplace lists how long each property has been for sale. Long-listed properties may be overpriced.
- Your Dashboard shows your total accrued income. Claim it regularly to reinvest.

---

## DEVELOPER_SETUP.md Outline

Create `docs/game/DEVELOPER_SETUP.md`. Target audience: a contributor who wants to run the game locally.

**Prerequisites**

- Rust 1.70 or higher: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Stellar CLI: `cargo install stellar-cli --locked`
- Bun 1.x: `curl -fsSL https://bun.sh/install | bash`
- A Pollar API key: register at https://pollar.xyz to get a testnet key (`pub_testnet_...`)

**Running Contract Tests**

```bash
cd apps/contracts
cargo test -p game-property-nft
cargo test -p game-land-token
cargo test -p game-marketplace
cargo test -p game-engine
# or run all at once:
cargo test
```

**Running the Game App with Mock Data (No Contracts Needed)**

```bash
cp apps/akkuea-land/.env.example apps/akkuea-land/.env.local
# In .env.local, set NEXT_PUBLIC_USE_MOCK=true and add your Pollar key

cd apps/akkuea-land
bun install
bun run dev
```

Open http://localhost:3001. All data comes from `src/mocks/game/`. Wallet login requires a real Pollar key.

**Running Against Testnet Contracts**

After C5-015 is complete, fill in the contract IDs in `.env.local`:

```env
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_GAME_NFT_CONTRACT_ID=CXXX...
NEXT_PUBLIC_GAME_TOKEN_CONTRACT_ID=CXXX...
NEXT_PUBLIC_GAME_MARKETPLACE_CONTRACT_ID=CXXX...
NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID=CXXX...
```

The app connects to Stellar testnet using the public Soroban RPC at `https://soroban-testnet.stellar.org`.

**Running All Game Tests**

```bash
# Contracts
cd apps/contracts && cargo test

# Frontend (type checking)
cd apps/akkuea-land && bun run type-check
```

**Deploying Contracts**

See `docs/game/../../contracts/deployment.md` and `docs/planning/cycles/cycle-5/issues/issue-015/ISSUE_015_DETAILED.md` for step-by-step deployment instructions.

## Definition of Done

- `docs/game/GAME_RULES.md` covers all mechanics with no blockchain jargon.
- `docs/game/DEVELOPER_SETUP.md` works on a fresh environment.
- All shell commands verified before committing.
- All CI workflows pass on the pull request.
