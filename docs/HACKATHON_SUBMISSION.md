# NEAR Hackathon 2026 — submission dossier

**Project:** INTENT Property Network — NEAR Testnet Edition.

**One sentence:** A programmable, reviewable real-estate information and participation workflow, combining Living Property Passports, native NEAR testnet Cell settlement and rule-constrained agent payments.

## Submission candidate

**Primary track: Real-World Money.** Verifiable record → reviewed evidence → programmable participation and auditable testnet payments. **Other reasonable alignments:** Autonomous Business (agent spending policies) and AI Security & Defense (owner policies, spending limits, emergency freeze). Don't claim AI inference or NEAR Intents integration; this MVP implements onchain controls for *externally orchestrated* agents.

**Suggested title:** INTENT — Property Passports & Policy-Governed Agents on NEAR.

**Short description (EN, first-person):**

> I am extending INTENT Property Network into NEAR with native Rust/WASM smart contracts for property registration, human-reviewed document hashes, wallet-linked Property Cells, and policy-controlled agent payments. On NEAR Testnet, users can inspect an append-only Living Property Passport, purchase and transfer illustrative Cells using testnet NEAR, and verify agent payment receipts against owner-configured daily and per-transaction limits. The integration preserves INTENT’s original 50-property catalogue and map of 117 prospective ecosystem organizations. This is a blockchain infrastructure proof of concept, not a legal property-token offering or an audited financial product.

## Original versus new work — REQUIRED disclosure

Pre-existing: INTENT SKALE site and 50-entry catalogue, blue visual identity, 117 prospective organizations, original EVM/Solidity prototypes, legacy Lineage policy ideas. See `legacy_reference/lineage_solidity/*.sol` (reference only; **not deployed**).

New NEAR hackathon contribution: Rust `near-sdk` contract code in `contracts/*/src/lib.rs`; new NEAR JSON-RPC integration and MyNearWallet/Testnet signing logic in `web/src/main.js`; independent deployment, seeding, smoke checks, and onchain evidence flow; ported, native-NEAR reinterpretation of agent policies with async transfer callback.

**NEAR Intents note:** The official hackathon rules state that NEAR Intents does not have its own Testnet. This submission **does not pretend** to demonstrate that protocol on Testnet. It demonstrates three *native NEAR Testnet* contracts instead.

## 75–100 second English demo video storyboard

| Time | Screen | Narration / proof |
|---|---|---|
| 0–10s | Landing hero + chain status | “INTENT makes real-world asset information reviewable and programmable on NEAR.” |
| 10–25s | Passport #1 | “Here is an actual Testnet property record, review status and append-only evidence hashes.” Show NEAR Block Explorer account. |
| 25–45s | Settlement | Connect wallet, show attached 0.01 test NEAR for 1 Cell, confirm transaction. |
| 45–55s | Portfolio | Show `get_holding` increasing for your wallet and paste transaction ID. |
| 55–80s | Agent Operations | Owner sets per-action/daily budget, allowlists provider; agent makes payment; show COMPLETED receipt. |
| 80–90s | Negative test | Freeze agent or set disallowed provider; display failed policy check. |
| 90–100s | Partners & architecture | Show all 117 organizations as prospective directory, 3 contract account IDs and source repository. |

Record **only after real Testnet deployment, purchase, review, and agent receipt are verified**. Don't substitute the read-only `preview-dist` for actual blockchain activity.

## Suggested X post (EN, first-person)

> I just brought INTENT Property Network to NEAR Testnet for #NEARHackathon. I built native NEAR contracts for Living Property Passports, illustrative Property Cells, and agent payments constrained by owner-set budgets and provider allowlists. Each operation can be inspected onchain. Demo + source: [ADD_REAL_LINKS]. @NEARProtocol

Post must include a working video or screenshots. Replace placeholders with public links **after** obtaining them; don't invent TX IDs.

## Submission fields & verification

- Public GitHub containing **actual new NEAR source** and a README that explicitly distinguishes old/new.
- A working `web/dist` production build with configured `web/public/deployments.json` and verified network.
- Three deployed NEAR Testnet contract IDs and explorer links.
- At least two verified signed Testnet transactions: one Cell buy and one AgentPolicy payment, preferably also evidence review.
- A genuine screenshot/video and X post tagging `@NEARProtocol` and `#NEARHackathon`.
- Project submission at https://nearhackathon.com/ by **November 14, 2026, 23:59 UTC** (verify exact current rules before submitting).
- If a payout wallet is requested, separate the real mainnet payout wallet from all Testnet demonstration addresses. Never put wallet private keys in the repository.

**Status at archive preparation:** none of the above public submission/chain transactions was performed by the assistant; the files supply source and reproducible deployment commands. A claim of a completed application would be incorrect.

Official rules: https://nearhackathon.com/HACKATHON.md
