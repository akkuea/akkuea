# Contract Deployment Records

> **This document's step-by-step deployment instructions have been superseded** by [`docs/deployment/deploy-contracts.md`](../deployment/deploy-contracts.md) (the `defi-rwa` platform contract) and [`docs/deployment/deploy-game-contracts.md`](../deployment/deploy-game-contracts.md) (the four Akkuea Land game contracts) - use those for actually deploying. This document now keeps only what those two don't cover: the historical deployment records and the mainnet approval process, both still accurate and referenced elsewhere in this repo.

## Where contract IDs live

Deployed contract addresses are stored as JSON deployment artifacts at `apps/shared/src/contracts.testnet.json`, `apps/shared/src/contracts.mainnet.json`, and `apps/shared/src/contracts/game-contracts.testnet.json`. The shared `CONTRACT_IDS` constant (`apps/shared/src/constants/index.ts`) and the API (`apps/api/src/config/contracts.ts`) read contract IDs from these files, so recording a new deployment is a data change, not a code change.

## Pilot Contracts Testnet Deployment Record (2026-08-18)

The three Cycle 6 pilot contracts were built with `stellar contract build` (target `wasm32v1-none`) and deployed to Stellar testnet as an independent system from `defi-rwa`.

- **Network**: testnet (`Test SDF Network ; September 2015`)
- **Deployer / admin account**: `GCG62FA2P6OFRYBRSDD2D4FRWVZ5HFLM233KE5LGIL3OV4QRVM7YYBFY`
- **Operator signer**: `GCG62FA2P6OFRYBRSDD2D4FRWVZ5HFLM233KE5LGIL3OV4QRVM7YYBFY`
- **Ally signer**: `GCG62FA2P6OFRYBRSDD2D4FRWVZ5HFLM233KE5LGIL3OV4QRVM7YYBFY`
- **Platform fee recipient**: `GCG62FA2P6OFRYBRSDD2D4FRWVZ5HFLM233KE5LGIL3OV4QRVM7YYBFY`
- **USDC SAC**: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
- **Deployed on**: 2026-08-18
- **Source of truth**: [`apps/shared/src/contracts.testnet.json`](../../apps/shared/src/contracts.testnet.json)

| Contract | Contract ID | Upload tx | Deploy tx | Init tx |
| --- | --- | --- | --- | --- |
| `PILOT_WHITELIST` | `CAOIML5WZYESSX5CPRFHA2OY7UXVW2ISJLL362OVX7MY3G7CMRWN3QA4` | `5b7602fa4c7bf84e5c7afe326abadc88cdc646167e61ff0bf8b82d0cebd413fe` | `3e7086788c38c8edc4d57c11f41481dd19401770a30533dfc636ef59bea4c529` | `8fb3027f1360c267463edacf50208a16faa7f568336a1fc9dc090cae2df35588` |
| `PILOT_INCOME_TOKEN` | `CB7VETI4NSQJNLJ34PK2M637UIPNCZA3QYYBMQ5B76DK5OBLXS6OGKYS` | `cfb5088de68c0df1d95015e65de282ae505db125708267216ca0a8762bde5a76` | `ad7b41ca1fbfae055ba64e7f5de54c8eacce5cf82be123da9cea0e4de9f01c39` | `7a3100706433fdacfb4d89bd35066447cc3c6a751a8f2a7e7ce6b7d74ae57bcc` |
| `PILOT_PAYOUT_SPLIT` | `CB33EZGTFZN73R3EKKEZ474WARXZURAFXO2GEU54P6HPWO5G3TRYR6HZ` | `a1df8ac826a226675d16ef89a35627a5b39efcfed193d306f78f76a796953e01` | `fb84cde5de1e5d061a70d281d0a43b3a6af2c12f3fe6cc41012ae92a4a1c73e9` | `4067dba74a20568face2ade5964b95268a491be8b3b78be3615fbbcedabdac24` |

Explorer links:

- PILOT_WHITELIST: <https://stellar.expert/explorer/testnet/contract/CAOIML5WZYESSX5CPRFHA2OY7UXVW2ISJLL362OVX7MY3G7CMRWN3QA4>
- PILOT_INCOME_TOKEN: <https://stellar.expert/explorer/testnet/contract/CB7VETI4NSQJNLJ34PK2M637UIPNCZA3QYYBMQ5B76DK5OBLXS6OGKYS>
- PILOT_PAYOUT_SPLIT: <https://stellar.expert/explorer/testnet/contract/CB33EZGTFZN73R3EKKEZ474WARXZURAFXO2GEU54P6HPWO5G3TRYR6HZ>
- USDC SAC: <https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA>

Build, deployment, initialization, and verification commands: see [`docs/deployment/deploy-pilot-contracts.md`](../deployment/deploy-pilot-contracts.md).

## Game Contracts Testnet Deployment Record (2026-06-24)

All four Akkuea Land game contracts were built with `stellar contract build` (target `wasm32v1-none`) and deployed to Stellar testnet. Deployment order: PropertyNFT and LandToken first (no inter-dependencies), then GameMarketplace and GameEngine (both depend on the first two).

- **Network**: testnet (`Test SDF Network ; September 2015`)
- **Deployer / admin account**: `GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M`
- **Deployed on**: 2026-06-24
- **Source of truth**: [`apps/shared/src/contracts/game-contracts.testnet.json`](../../apps/shared/src/contracts/game-contracts.testnet.json)

| Contract            | Contract ID                                                | Deploy tx                                                          | Init tx                                                            |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `GAME_PROPERTY_NFT` | `CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE` | `2b982bdbc7e29c7f334d35d57f9566d124fd9b30722f551fff23df310d298fc5` | `889d9a0f7da7c543cc6abeb913506eb55b6b31f67177c4d3f2fc18670c81bbb2` |
| `GAME_LAND_TOKEN`   | `CBQBXOWI3YB5SFICLVPYHK2EL3SY3XIZUZA6QZIGGXDKMVXAT74IOR3K` | `3a7619ea0d637ac60f2d6c43dfac10cc7810c663b3ea65b84f54d7b1f07cbdf7` | `1e3d8961cce31d0d5016705ef1f8aecf78761ef1203136cb41ccc6c08729be53` |
| `GAME_MARKETPLACE`  | `CDKRZTY5PFNA4DHI2GFPSTOAADI2WV7SXYVS4VMTDC6M7IKKIPQJP5A3` | `a84eabafffc0bf75bb75676c8add0616ff970cda82c75f2ebf439ca14528fbbb` | `4fbaa0df4a51c266fb3258490b202cd962209b04c495264d85096da5ef623560` |
| `GAME_ENGINE`       | `CBTPPGX6LT2EPKR7JD7LLUB23E6HI5EFQRXKV3VQNZ6QWJTJ3EZ76RSH` | `fc8bcb20360d909ea4fbd7187edadadf3ed25f3aa29810e5b806917318d0cafa` | `33641f100f7c6d23452a417b2d4d16a111554398c69aa5cab969f224a98a7714` |

Explorer links:

- GAME_PROPERTY_NFT: <https://stellar.expert/explorer/testnet/contract/CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE>
- GAME_LAND_TOKEN: <https://stellar.expert/explorer/testnet/contract/CBQBXOWI3YB5SFICLVPYHK2EL3SY3XIZUZA6QZIGGXDKMVXAT74IOR3K>
- GAME_MARKETPLACE: <https://stellar.expert/explorer/testnet/contract/CDKRZTY5PFNA4DHI2GFPSTOAADI2WV7SXYVS4VMTDC6M7IKKIPQJP5A3>
- GAME_ENGINE: <https://stellar.expert/explorer/testnet/contract/CBTPPGX6LT2EPKR7JD7LLUB23E6HI5EFQRXKV3VQNZ6QWJTJ3EZ76RSH>

Full initialization arguments and CLI verification commands: see [`docs/deployment/deploy-game-contracts.md`](../deployment/deploy-game-contracts.md).

## `defi-rwa` Testnet Deployment Record

Both instances were deployed from the same `rwa_defi_contract.wasm` (built with `stellar contract build`, target `wasm32v1-none`) on **Stellar testnet**.

- **Network**: testnet (`Test SDF Network ; September 2015`)
- **Deployer / admin account**: `GBN4ABG3ES6NHKY4BURL3EMP5RA6EFQJDR4EET6U66M6YIRADPWJ7OQ6`
- **Uploaded WASM hash**: `c13878bd0845d4965a5eb26138b77db617fdccbb70a70dc47acd8c460af6a0b1`
- **Deployed on**: 2026-05-31
- **Source of truth**: [`apps/shared/src/contracts.testnet.json`](../../apps/shared/src/contracts.testnet.json)

| Contract            | Contract ID                                                | Deploy (create) tx                                                 |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `REAL_ESTATE_TOKEN` | `CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4` | `ff4c6b52080df05d9ad443a6a3907894fb771e187b04dbd837306c62add89724` |
| `DEFI_LENDING`      | `CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX` | `490a50682d4da46c85a8080cc5ae6b50d727bf1156c97a2c9a00c532c441bdd4` |

**WASM upload transaction** (shared by both instances; submitted with the first deploy): `c5e2fd6753437a1c8dc217e5a9797b4abdd7621aed6747fedbd03c9c72ab8079`

Explorer links:

- REAL_ESTATE_TOKEN: <https://stellar.expert/explorer/testnet/contract/CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4>
- DEFI_LENDING: <https://stellar.expert/explorer/testnet/contract/CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX>

Full build/deploy/verification steps: see [`docs/deployment/deploy-contracts.md`](../deployment/deploy-contracts.md).

## Mainnet Deployment: approvals and checklist

Deploying smart contracts to Stellar mainnet requires a rigorous process to ensure security, compliance, and platform integrity.

### 1. Required Approvals

Mainnet deployments are restricted and must be formally approved by:

- **Lead Smart Contract Engineer**: verifies code correctness and alignment with architectural specifications.
- **Lead Security Auditor**: confirms all vulnerabilities identified in audits have been resolved.
- **Product / Governance Multisig Signers**: requires M-of-N signatures from the authorized multisig key holders to authorize transaction submission and execute initial setup.

### 2. Pre-Deployment Checklist

- [ ] **Security Audit**: an external security audit of the smart contracts must be completed with all critical and high-severity issues fixed and verified.
- [ ] **Test Coverage**: contract code must have complete unit and integration test coverage; all test suites in the monorepo must pass.
- [ ] **Smoke Tests**: run the full smoke test suite on testnet to verify end-to-end integration with the API and frontend (see [`docs/testing/smoke-tests.md`](../testing/smoke-tests.md)).
- [ ] **Multisig Wallet Setup**: a mainnet multisig account (e.g. M-of-N) must be established to act as the contract admin/owner.
- [ ] **Account Funding**: ensure the deployer account has sufficient XLM balance (at least 20-50 XLM to cover fee surges and storage deposits).

### 3. Post-Deployment: Populating `contracts.mainnet.json`

1. Locate `apps/shared/src/contracts.mainnet.json`.
2. Populate the keys with the generated contract IDs (ensuring they start with `C` and are 56 characters long):
   ```json
   {
     "REAL_ESTATE_TOKEN": "C...",
     "DEFI_LENDING": "C...",
     "GAME_ENGINE": "C...",
     "GAME_LAND_TOKEN": "C...",
     "GAME_PROPERTY_NFT": "C...",
     "GAME_MARKETPLACE": "C..."
   }
   ```
3. Commit the changes and open a pull request.

### 4. Verifying Mainnet Contracts

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <your_account> \
  --network mainnet \
  --send=no \
  -- get_oracle_config   # or the equivalent read-only getter for the contract in question
```

Cross-check the deployment on a public explorer: `https://stellar.expert/explorer/public/contract/<CONTRACT_ID>`.
