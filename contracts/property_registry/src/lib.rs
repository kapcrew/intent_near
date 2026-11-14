//! Living Property Passport / human-review registry. NEAR native, not EVM.
//! Records are attestations of submitted hashes, not legal-title verification.
use std::collections::BTreeMap;
use near_sdk::{env, near, require, AccountId, PanicOnDefault};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Property {
    pub id: u64,
    pub name: String,
    pub metadata_hash: String,
    pub owner: AccountId,
    pub review_status: String,
    pub review_note_hash: String,
    pub reviewed_by: Option<AccountId>,
    pub reviewed_at_ns: u64,
    pub created_at_ns: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Evidence {
    pub id: u64,
    pub property_id: u64,
    pub kind: String,
    pub content_hash: String,
    pub author: AccountId,
    pub created_at_ns: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct PropertyRegistry {
    owner: AccountId,
    reviewers: BTreeMap<AccountId, bool>,
    evidence_agents: BTreeMap<AccountId, bool>,
    properties: BTreeMap<u64, Property>,
    evidence: BTreeMap<u64, Vec<Evidence>>,
    next_evidence_id: u64,
}

#[near]
impl PropertyRegistry {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        require!(env::predecessor_account_id() == owner || env::predecessor_account_id() == env::current_account_id(), "Only deployer/owner may initialize");
        Self { owner, reviewers: BTreeMap::new(), evidence_agents: BTreeMap::new(), properties: BTreeMap::new(), evidence: BTreeMap::new(), next_evidence_id: 1 }
    }

    pub fn owner(&self) -> AccountId { self.owner.clone() }
    pub fn is_reviewer(&self, account_id: AccountId) -> bool { self.reviewers.get(&account_id).copied().unwrap_or(false) }
    pub fn set_reviewer(&mut self, account_id: AccountId, enabled: bool) {
        self.assert_owner(); self.reviewers.insert(account_id, enabled);
    }
    pub fn set_evidence_agent(&mut self, account_id: AccountId, enabled: bool) {
        self.assert_owner(); self.evidence_agents.insert(account_id, enabled);
    }

    pub fn register_property(&mut self, id: u64, name: String, metadata_hash: String) {
        self.assert_owner();
        require!(id > 0 && !self.properties.contains_key(&id), "Duplicate or invalid property ID");
        require!(!name.trim().is_empty() && name.len() <= 120, "Invalid property name");
        Self::check_hash(&metadata_hash);
        require!(self.properties.len() < 100, "Testnet property limit reached");
        self.properties.insert(id, Property {
            id, name, metadata_hash, owner: self.owner.clone(),
            review_status: "PENDING".into(), review_note_hash: String::new(),
            reviewed_by: None, reviewed_at_ns: 0, created_at_ns: env::block_timestamp(),
        });
        env::log_str(&format!("PROPERTY_REGISTERED:{}", id));
    }

    pub fn review_property(&mut self, property_id: u64, approved: bool, note_hash: String) {
        let caller = env::predecessor_account_id();
        require!(caller == self.owner || self.reviewers.get(&caller) == Some(&true), "Reviewer role required");
        Self::check_hash(&note_hash);
        let record = self.properties.get_mut(&property_id).expect("Property not registered");
        record.review_status = if approved { "APPROVED" } else { "REJECTED" }.into();
        record.review_note_hash = note_hash;
        record.reviewed_by = Some(caller);
        record.reviewed_at_ns = env::block_timestamp();
        env::log_str(&format!("PROPERTY_REVIEW:{}:{}", property_id, record.review_status));
    }

    pub fn append_evidence(&mut self, property_id: u64, kind: String, content_hash: String) -> u64 {
        let caller = env::predecessor_account_id();
        require!(caller == self.owner || self.reviewers.get(&caller) == Some(&true) || self.evidence_agents.get(&caller) == Some(&true), "Evidence-writer role required");
        require!(self.properties.contains_key(&property_id), "Unknown property");
        require!(!kind.trim().is_empty() && kind.len() <= 60, "Invalid evidence type");
        Self::check_hash(&content_hash);
        let list = self.evidence.entry(property_id).or_default();
        require!(list.len() < 64, "Evidence cap per property reached");
        let id = self.next_evidence_id;
        self.next_evidence_id += 1;
        list.push(Evidence { id, property_id, kind, content_hash, author: caller, created_at_ns: env::block_timestamp() });
        env::log_str(&format!("PASSPORT_EVIDENCE:{}:{}", property_id, id));
        id
    }

    pub fn get_property(&self, property_id: u64) -> Option<Property> { self.properties.get(&property_id).cloned() }
    pub fn get_properties(&self) -> Vec<Property> { self.properties.values().cloned().collect() }
    pub fn get_evidence(&self, property_id: u64) -> Vec<Evidence> { self.evidence.get(&property_id).cloned().unwrap_or_default() }

    fn assert_owner(&self) { require!(env::predecessor_account_id() == self.owner, "Owner only"); }
    fn check_hash(hash: &str) {
        require!(hash.len() == 64 && hash.bytes().all(|c| c.is_ascii_hexdigit()), "Expected SHA-256 hex (64 chars)");
    }
}
