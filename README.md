# INTENT Property Network × NEAR Testnet

**NEAR HACKATHON 2026 · Native Testnet contracts · Three separately deployable Rust crates.**

> **Deployment status:** SOURCE PACKAGE / NOT DEPLOYED by the author of this archive. It contains no account keys or fabricated contract IDs. To enable live writes, follow `docs/DEPLOY_NEAR_TESTNET_RU.md`. A configured ID alone does not prove successful deployment; verify using `npm run smoke:near` and NEAR Blocks.

INTENT brings a verifiable property information lifecycle to NEAR: property records, human-reviewed evidence, native testnet NEAR Property Cell settlement, and agent payments controlled by spending policies. It reuses the existing INTENT catalogue/design (50 sample properties and world map of 117 **prospective** ecosystem organizations), combining the policy ideas from `lineageProtocol` with **new native NEAR Testnet implementations**.

**Not an investment product.** This proof of concept does not verify legal ownership, tokenize legal real estate, distribute real yield, create NEP-141 fungible tokens / NEP-171 NFTs, use real USDC, or integrate mainnet-only NEAR Intents. All shown real-estate values, asset images and Cell prices are illustrative.

## One-minute overview

| Component | Onchain NEAR operation | User-visible result |
|---|---|---|
| PropertyRegistry | `register_property`, `review_property` | Human-reviewed property metadata digest |
| Living Passport | `append_evidence`, `get_evidence` | Append-only evidence history per property |
| PropertyCells | `configure_listing`, payable `buy_cells` | Wallet-linked Cell holdings, testnet NEAR paid |
| Cell transfers | `transfer_cells`, `get_holding` | Onchain participant-to-participant Cell movements |
| AgentPolicy | `configure_agent`, `set_provider` | Agent budget, provider allowlist, versioned policy hash |
| Agent payments | payable `execute_payment` + private `on_payment_complete` | Testnet NEAR provider transfer; COMPLETED / FAILED receipt |
| Emergency stop | `set_agent_freeze`, `set_global_freeze` | Block new agent payment execution |
| Frontend | Wallet Selector (My NEAR Wallet), NEAR RPC | Real account, wallet-confirmed transactions, onchain reads |
| Ecosystem map | 117 source organizations, D3 map | Original map intact, searchable and zoomable |

### Repository structure

```text
contracts/
  property_registry/src/lib.rs   # Property registration, reviewer roles, hash evidence
  property_cells/src/lib.rs      # NEAR purchases, supply, wallet balances, transfers
  agent_policy/src/lib.rs        # Agent rules, budgets, async NEAR payments, receipts
web/
  index.html                     # Branded site with NEAR Testnet navigation
  src/main.js                    # NEAR RPC + wallet transaction integration
  public/properties.json        # Original 50-property catalogue
  public/partners-data.js       # 117 organization directory records
  public/skale-partners.js      # Original D3 world map (module filename preserved)
  public/deployments.json       # Public Testnet contract IDs, initially blank
scripts/
  deploy-testnet.mjs             # Build and deploy 3 WASM contracts + init
  seed-testnet.mjs               # Idempotently register 8 synthetic sample listings
  write-deployments.mjs         # Write public website configuration
  smoke-testnet.mjs             # Check contract read functions against Testnet
  build-preview.mjs             # Offline read-only visual preview
patch/                            # Patch manifests / migration notes
preview-dist/                    # Ready-to-open READ-ONLY preview, no wallet signing
```

## Get running (on your own machine)

Use Node.js 24.15+, Rust 1.95+, `cargo-near`, `near-cli-rs`, and a NEAR **testnet** account. The official CLI documentation is at https://docs.near.org/tools/cli. No production keys are required.

```bash
cp .env.example .env
# Edit .env with REAL existing NEAR Testnet account IDs you own.
# Create/import accounts using NEAR CLI as in docs/DEPLOY_NEAR_TESTNET_RU.md.

npm run check
npm run deploy:near      # Requires Cargo + NEAR CLI keychain + existing contract accounts
npm run seed:near        # Register synthetic property records + listings
npm run smoke:near       # Must pass before you claim live deployment
npm run web:install
npm run web:dev
# http://localhost:4173
```

To build standalone HTML/CSS/JS assets after deployment, run:

```bash
npm run web:build
# Host web/dist/ at a domain root or configure Vite base for subpath deployments.
```

A **read-only preview** of the site is included for machines without Rust/npm:

```bash
python3 -m http.server 8080 --directory preview-dist
# http://localhost:8080
```

The preview CANNOT sign NEAR transactions. Judges assessing blockchain writes should use the Vite-built app and deployed contract IDs, not `preview-dist`.

## Judge walkthrough (real, reproducible)

1. Run `npm run smoke:near` — expects three deployed NEAR contract accounts, property listing data, and available view functions. If this fails, the network integration is **not** verified.
2. Open the Vite-built web app, select **Settlement**, connect a Testnet wallet, choose a listed sample property, buy 1 Cell (the seeded listing price is 0.01 testnet NEAR), confirm in wallet.
3. Select **Portfolio**, refresh, and observe one additional onchain Cell for the same account. Verify `get_holding` on NEAR CLI.
4. Use an owner/reviewer account to open **Passport**. On a registered sample, submit a review note and append SHA-256 evidence. Refresh to see the immutable evidence history.
5. Owner configures a separate testnet agent account with max per-action and daily budget; allowlists a provider. Switch to agent wallet and execute a small authorized testnet NEAR payment. Read a receipt with status `COMPLETED` after callback and inspect explorer transaction. Retry above limit, or enable freeze; the transaction must fail.
6. Open **Partners** and test map zoom, filter and 117-entry directory. These records are not represented as signed deals.

## Precise origin & hackathon contribution

The product and aesthetic predate the NEAR Hackathon. The supplied pre-existing archives were:

- `INTENT_SKALE_Website_2026-10-29(1).zip`: former SKALE app, 50 properties, original blue identity, 117 organization map, EVM settlement / x402 modules.
- `lineageProtocol.zip`: an older cross-chain/EVM INTENT agent-control-plane prototype, policy gates, owner review, lineage/receipt concepts and Solidity modules.

**New NEAR-specific work in this release:** all 3 Rust `near-sdk` contracts; deploy / seed / smoke scripts; wallet selector integration; NEAR JSON-RPC contract reads; yoctoNEAR attached-deposit settlement; NEAR-oriented app screens and architecture documentation. Original code does not count as newly written NEAR integration.

**Deliberately not ported:** SKALE BITE privacy, PayAI x402 USDC payments, ERC-8004 registry, SKALE chain-specific addresses or EVM contract bytecode. No claim that they operate on NEAR.

The site preserves 117 organizations and all 50 reference properties. Only 8 properties get onchain listings from the seed script (initially pending review). The directory is **prospective**, not a verified partner-status dataset.

## Read-only commands to verify

```bash
near contract call-function as-read-only "$REGISTRY_ID" get_properties json-args '{}' network-config testnet now
near contract call-function as-read-only "$SETTLEMENT_ID" get_listings json-args '{}' network-config testnet now
near contract call-function as-read-only "$POLICY_ID" get_recent_receipts json-args '{}' network-config testnet now
```

## Limitations / security

- These native NEAR contracts are **hackathon prototypes, unaudited, uncompiled and untested against a live network in the author's sandbox**. Do not deploy them on mainnet or fund them with real assets until audited. The supplied environment lacks Rust/cargo, NEAR CLI, wallet keys and external dependency installation.
- Property Cell balances are an internal contract ledger, **not** standardized NEP fungible or NFT assets and **not** legal real-estate units.
- PropertyRegistry and PropertyCells are independent contracts: the owner must enforce the human-review step before listing. Cross-contract enforced reviewer approval is a potential production enhancement.
- AgentPolicy transfers only the **testnet NEAR attached by the calling agent**, never the owner's funds. A policy receipt is not an invoice or a proof of offchain service completion.
- Contract state uses BTreeMap / bounded arrays for testnet simplicity; storage costs and denial-of-service controls require a full audit before real usage. Review notes are committed as SHA-256 hashes; sensitive documents stay offchain and must have independent evidence verification.
- Wallet Selector v10 is configured for `my-near-wallet` on Testnet. Wallet permission behavior across three contract IDs should be validated in the target wallet. Owner operations are also available from NEAR CLI.

## Additional documentation

- `docs/DEPLOY_NEAR_TESTNET_RU.md` — full Russian environment, account, deploy, seed, runbook.
- `docs/CONTRACT_API.md` — methods, permissions, inputs and deposits.
- `docs/HACKATHON_SUBMISSION.md` — positioning, track selection, X post and final checklist.
- `docs/ARCHITECTURE_SECURITY.md` — trust boundaries, governance and risk status.
- `patch/NEAR_MIGRATION.md` — implementation mapping and baseline differences.

The code is provided under the terms described in `LICENSE`. Assets and third-party logos remain subject to their respective owners' rights; do not assume proprietary images or inherited brand materials are relicensed.
