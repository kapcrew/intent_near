# NEAR Native Contract API — 2026 Hackathon MVP

All contracts are **native Rust/near-sdk** and have separate `Cargo.toml`s and WASM deploys. No Solidity ABI.

NEAR JS `view` uses JSON-RPC `query { request_type:"call_function", finality:"final", account_id, method_name, args_base64 }`. Changes use a wallet-signed function-call action with `100 Tgas` max prepaid gas (actual used gas varies). All amounts in **yoctoNEAR strings** (`1 NEAR = 10^24 yoctoNEAR`).

## PropertyRegistry (`REGISTRY_ID`)

| Method | Role | Parameters | Meaning |
|---|---|---|---|
| `new` (init) | deploy account / owner | `owner: AccountId` | Initialize singleton state once |
| `owner` (view) | any | none | Contract governance |
| `set_reviewer` | owner | `account_id`, `enabled: bool` | Authorize/revoke human reviewer |
| `set_evidence_agent` | owner | `account_id`, `enabled` | Grant/revoke append-only agent writing |
| `is_reviewer` (view) | any | `account_id` | Check role |
| `register_property` | owner | `id: u64`, `name`, `metadata_hash` | New property with PENDING status |
| `review_property` | reviewer or owner | `property_id`, `approved: bool`, `note_hash` | Review and commit SHA-256 hash |
| `append_evidence` | owner/reviewer/evidence agent | `property_id`, `kind`, `content_hash` | Append evidence digest, capped at 64 per property |
| `get_property` (view) | any | `property_id` | Get metadata + review |
| `get_properties` (view) | any | none | List registered properties |
| `get_evidence` (view) | any | `property_id` | Append-only hash history |

Both hashes are 64-char hex SHA-256 strings. Contract checks format but **cannot verify actual contents** of document or property title. Registry capped at 100 sample properties in this prototype; no deletion and no amendment of evidence entries.

## PropertyCells (`SETTLEMENT_ID`)

| Method | Role | Parameters | Deposit | Meaning |
|---|---|---|---|---|
| `new` (init) | deploy / owner | `owner`, `treasury` | `0` | Initialize once |
| `configure_listing` | owner | `property_id`, `price_yocto: String`, `total_cells: u64` | `0` | Set price/supply; cannot lower under sold |
| `set_listing_active` | owner | `property_id`, `active` | `0` | Pause/resume purchases |
| `buy_cells` | any signed wallet | `property_id`, `quantity: u64` | **exact price × quantity** | Buy up to 100 cells in one TX |
| `transfer_cells` | current Cell holder | `property_id`, `receiver_id`, `quantity` | `0` | Transfer internal ledger units |
| `withdraw` | owner | `amount_yocto` | `0` | Send contract proceeds to treasury, preserve reserve |
| `get_listing` (view) | any | `property_id` | — | Listing or null |
| `get_listings` (view) | any | none | — | Issued listings |
| `get_holding` (view) | any | `property_id`, `account_id` | — | Account-linked Cell quantity |
| `get_transaction_count` (view) | any | none | — | Number of successful buy calls |
| `owner` / `treasury` (view) | any | none | — | Governance / recipient |

New seeded listings: `1000` Cells at `10000000000000000000000` yoctoNEAR (= `0.01` testnet NEAR each). The in-contract balance is a **non-standard internal ledger**, not an FT/NFT. Payment is attached **testnet NEAR**. Approval/allowance `ERC-20` steps do not exist. Issuer must manually enforce property-review requirement until cross-contract integration is implemented.

## AgentPolicy (`POLICY_ID`)

| Method | Role | Parameters | Deposit | Meaning |
|---|---|---|---|---|
| `new` (init) | deploy / owner | `owner` | `0` | Initialize |
| `configure_agent` | owner | `account_id`, `max_per_action_yocto`, `daily_budget_yocto`, `policy_hash` | `0` | Versioned constraints |
| `set_provider` | owner | `agent_id`, `provider_id`, `allowed` | `0` | Allowlist provider |
| `set_agent_freeze` | owner | `account_id`, `frozen` | `0` | Stop one agent |
| `set_global_freeze` | owner | `frozen` | `0` | Emergency stop all |
| `execute_payment` | **configured agent** | `provider_id`, `property_id`, `action_hash`, `amount_yocto` | **exact amount** | Validate policy and transfer NEAR to provider |
| `on_payment_complete` | contract-internal callback | `receipt_id` | `0` | COMPLETED/FAILED + refund attempt |
| `get_agent` (view) | any | `account_id` | — | Current caps/version/spend/frozen |
| `is_provider_allowed` (view) | any | `agent_id`, `provider_id` | — | Allowed status |
| `get_receipts` (view) | any | `account_id` | — | 50 latest for that agent |
| `get_recent_receipts` (view) | any | none | — | Up to 50 global receipts |
| `globally_frozen` (view) | any | none | — | Global stop |

**Flow:** policy checks signed predecessor = registered agent, provider allowlist, max amount, available UTC daily budget, and exact attached deposit. Writes `PENDING` receipt, makes async Promise transfer to provider, then private callback sets `COMPLETED` or `FAILED`. Failed transfer attempts a refund to the agent and restores same-day spending budget; no claim of an atomic cross-contract transfer. Receipts max 1000 in this prototype.

Important: caller is **the agent wallet** (or protected agent signer) that pays with its attached NEAR. There is no magical spending of the owner's wallet balance or real automated inference.

## Auth test matrix

| Attack or negative test | Expected result |
|---|---|
| User calls `register_property` without owner key | Revert `Owner only` |
| Unapproved account submits human review | Revert `Reviewer role required` |
| Evidence-agent tries to approve | Revert (evidence append only) |
| Buyer attaches less/more NEAR than exact price | Revert; Cell balance unchanged |
| Buyer buys over remaining supply | Revert |
| Holder transfers more Cells than owned | Revert |
| Agent pays unlisted provider | Revert |
| Agent exceeds max or UTC daily cap | Revert |
| Agent has `frozen` or global freeze on | Revert |
| Caller invokes private callback | Revert |

A test failure may still incur transaction gas fees; no mainnet funds should be used.
