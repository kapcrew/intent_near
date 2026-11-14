//! Owner-controlled property agents, budgets, provider allowlists, freeze, receipts.
//! Agent pays provider from its *own attached NEAR*; this does NOT custody owner funds.
use std::collections::BTreeMap;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseResult};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Agent {
    pub account_id: AccountId,
    pub max_per_action_yocto: String,
    pub daily_budget_yocto: String,
    pub spent_today_yocto: String,
    pub utc_day: u64,
    pub policy_version: u64,
    pub policy_hash: String,
    pub frozen: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Receipt {
    pub id: u64,
    pub agent_id: AccountId,
    pub provider_id: AccountId,
    pub property_id: u64,
    pub action_hash: String,
    pub amount_yocto: String,
    pub policy_version: u64,
    pub timestamp_ns: u64,
    pub status: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AgentPolicy {
    owner: AccountId,
    globally_frozen: bool,
    agents: BTreeMap<AccountId, Agent>,
    providers: BTreeMap<String, bool>,
    receipts: Vec<Receipt>,
}

#[near]
impl AgentPolicy {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        require!(env::predecessor_account_id() == owner || env::predecessor_account_id() == env::current_account_id(), "Only deployer/owner may initialize");
        Self { owner, globally_frozen: false, agents: BTreeMap::new(), providers: BTreeMap::new(), receipts: Vec::new() }
    }
    pub fn owner(&self) -> AccountId { self.owner.clone() }
    pub fn globally_frozen(&self) -> bool { self.globally_frozen }
    pub fn set_global_freeze(&mut self, frozen: bool) {
        self.assert_owner(); self.globally_frozen = frozen;
        env::log_str(&format!("GLOBAL_FREEZE:{}", frozen));
    }
    pub fn configure_agent(&mut self, account_id: AccountId, max_per_action_yocto: String, daily_budget_yocto: String, policy_hash: String) {
        self.assert_owner();
        Self::check_hash(&policy_hash);
        let max = max_per_action_yocto.parse::<u128>().expect("Invalid max amount");
        let daily = daily_budget_yocto.parse::<u128>().expect("Invalid daily budget");
        require!(max > 0 && max <= daily, "0 < max_per_action <= daily_budget required");
        let old = self.agents.get(&account_id);
        let day = Self::today();
        let old_spent = if old.map(|x| x.utc_day == day).unwrap_or(false) { old.unwrap().spent_today_yocto.clone() } else { "0".into() };
        let version = old.map(|x| x.policy_version + 1).unwrap_or(1);
        let frozen = old.map(|x| x.frozen).unwrap_or(false);
        self.agents.insert(account_id.clone(), Agent { account_id, max_per_action_yocto, daily_budget_yocto, spent_today_yocto: old_spent, utc_day: day, policy_version: version, policy_hash, frozen });
    }
    pub fn set_agent_freeze(&mut self, account_id: AccountId, frozen: bool) {
        self.assert_owner(); self.agents.get_mut(&account_id).expect("Unknown agent").frozen = frozen;
    }
    pub fn set_provider(&mut self, agent_id: AccountId, provider_id: AccountId, allowed: bool) {
        self.assert_owner(); require!(self.agents.contains_key(&agent_id), "Configure agent first");
        self.providers.insert(Self::provider_key(&agent_id, &provider_id), allowed);
    }
    pub fn is_provider_allowed(&self, agent_id: AccountId, provider_id: AccountId) -> bool {
        self.providers.get(&Self::provider_key(&agent_id, &provider_id)) == Some(&true)
    }
    /// Agent attaches *exact* testnet NEAR deposit, forwards to whitelisted provider.
    /// Authorized receipts begin as PENDING and update via private callback.
    #[payable]
    pub fn execute_payment(&mut self, provider_id: AccountId, property_id: u64, action_hash: String, amount_yocto: String) -> Promise {
        let caller = env::predecessor_account_id();
        require!(!self.globally_frozen, "Emergency freeze active");
        require!(property_id > 0, "Invalid property");
        Self::check_hash(&action_hash);
        require!(self.is_provider_allowed(caller.clone(), provider_id.clone()), "Provider not allowlisted");
        let amount = amount_yocto.parse::<u128>().expect("Invalid amount");
        require!(amount > 0 && env::attached_deposit().as_yoctonear() == amount, "Attach exact testnet NEAR amount");
        let day = Self::today();
        let agent = self.agents.get_mut(&caller).expect("Agent not registered");
        require!(!agent.frozen, "Agent frozen");
        let max = agent.max_per_action_yocto.parse::<u128>().expect("Stored max invalid");
        let daily = agent.daily_budget_yocto.parse::<u128>().expect("Stored budget invalid");
        if agent.utc_day != day { agent.utc_day = day; agent.spent_today_yocto = "0".into(); }
        let spent = agent.spent_today_yocto.parse::<u128>().unwrap_or(0);
        require!(amount <= max && spent.checked_add(amount).expect("Overflow") <= daily, "Policy spending limit exceeded");
        require!(self.receipts.len() < 1_000, "Testnet receipt limit reached");
        agent.spent_today_yocto = (spent + amount).to_string();
        let receipt_id = self.receipts.len() as u64 + 1;
        self.receipts.push(Receipt { id: receipt_id, agent_id: caller, provider_id: provider_id.clone(), property_id, action_hash, amount_yocto, policy_version: agent.policy_version, timestamp_ns: env::block_timestamp(), status: "PENDING".into() });
        env::log_str(&format!("AGENT_PAYMENT_PENDING:{}", receipt_id));
        let args = near_sdk::serde_json::json!({"receipt_id": receipt_id}).to_string().into_bytes();
        Promise::new(provider_id).transfer(NearToken::from_yoctonear(amount)).then(
            Promise::new(env::current_account_id()).function_call("on_payment_complete", args, NearToken::from_yoctonear(0), Gas::from_tgas(20))
        )
    }
    #[private]
    pub fn on_payment_complete(&mut self, receipt_id: u64) -> bool {
        require!(receipt_id > 0 && (receipt_id as usize) <= self.receipts.len(), "Unknown receipt");
        let receipt = &mut self.receipts[receipt_id as usize - 1];
        require!(receipt.status == "PENDING", "Already finalized");
        let success = matches!(env::promise_result(0), PromiseResult::Successful(_));
        receipt.status = if success { "COMPLETED" } else { "FAILED" }.into();
        if !success {
            let agent_id = receipt.agent_id.clone();
            let amount = receipt.amount_yocto.parse::<u128>().unwrap_or(0);
            let day = receipt.timestamp_ns / 86_400_000_000_000;
            if let Some(agent) = self.agents.get_mut(&agent_id) {
                if agent.utc_day == day {
                    let spent = agent.spent_today_yocto.parse::<u128>().unwrap_or(0);
                    agent.spent_today_yocto = spent.saturating_sub(amount).to_string();
                }
            }
            Promise::new(agent_id).transfer(NearToken::from_yoctonear(amount));
        }
        env::log_str(&format!("AGENT_PAYMENT_{}:{}", receipt.status, receipt_id));
        success
    }
    pub fn get_agent(&self, account_id: AccountId) -> Option<Agent> { self.agents.get(&account_id).cloned() }
    pub fn get_receipts(&self, account_id: AccountId) -> Vec<Receipt> {
        self.receipts.iter().rev().filter(|r| r.agent_id == account_id).take(50).cloned().collect()
    }
    pub fn get_recent_receipts(&self) -> Vec<Receipt> { self.receipts.iter().rev().take(50).cloned().collect() }
    fn assert_owner(&self) { require!(env::predecessor_account_id() == self.owner, "Owner only"); }
    fn provider_key(agent: &AccountId, provider: &AccountId) -> String { format!("{}|{}", agent, provider) }
    fn today() -> u64 { env::block_timestamp() / 86_400_000_000_000 }
    fn check_hash(hash: &str) { require!(hash.len() == 64 && hash.bytes().all(|c| c.is_ascii_hexdigit()), "Expected SHA-256 hex"); }
}
