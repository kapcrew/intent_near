# Patch manifest — SKALE / Lineage to NEAR Testnet

This file belongs in `patch/`, not in the project root (project convention).

| Baseline behavior | NEAR Testnet equivalent | Status |
|---|---|---|
| Existing blue INTENT visuals | CSS, logos, illustrations retained | Included |
| 50-property discovery catalogue | `web/public/properties.json` | Included as illustrative catalogue |
| Global map + 117 prospective companies | Original `partners-data.js` and D3 `skale-partners.js` | Retained |
| SKALE EVM wallet | My NEAR Wallet / Wallet Selector v10 | Replaced in web source; requires Vite install & live wallet test |
| SKALE/EVM contract calls | NEAR JSON-RPC + native Rust WASM | Sources included, NOT DEPLOYED |
| Living Passport | `property_registry` metadata digest + evidence + human review | Native testnet source |
| Property Cell mint / purchases | `property_cells` internal ledger + attached NEAR purchase | Native testnet source, not NEP-141 / NFT |
| Agent owner/allowlist/safety | `agent_policy` per action + UTC day limits + freeze + receipts | Native testnet source |
| EVM ERC-20 approval & payment | Exact native NEAR attached deposit | No fake USDC integration |
| EVM x402 / SKALE BITE / ERC-8004 | N/A | Not ported; not claimed |
| Old Solidity code | `legacy_reference/lineage_solidity/*.sol` | Reference ONLY; will not deploy to NEAR |
| CI / launch / deploy | 3 independent Cargo crates, deploy/seed/smoke scripts | Prepared, requires real environment |
| Standalone preview | `preview-dist` static copy with wallet disabled | Read-only; not blockchain proof |

**Critical separation:** This is a native NEAR redevelopment of selected workflows and UI, not a transparent in-place port of every legacy SKALE/EVM service. Historical user-facing features not listed above may not exist in this edition.

**Safety:** Never copy `.env`, private keys, `secretFiles`, old RPC auth tokens or hidden Mac metadata from `lineageProtocol.zip` into public commits. This package carries only 10 Solidity source files as historical references, not the legacy environment.
