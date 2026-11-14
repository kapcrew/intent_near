//! Native NEAR Testnet property participation records. Not NEP-141 / NEP-171.
//! Payments use *testnet NEAR*, not USDC or NEAR Intents.
use std::collections::BTreeMap;
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Listing {
    pub property_id: u64,
    /// Serialized as decimal JSON string to avoid JavaScript precision loss.
    pub price_yocto: String,
    pub total_cells: u64,
    pub sold_cells: u64,
    pub active: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct PropertyCells {
    owner: AccountId,
    treasury: AccountId,
    listings: BTreeMap<u64, Listing>,
    holdings: BTreeMap<String, u64>,
    transaction_count: u64,
}

#[near]
impl PropertyCells {
    #[init]
    pub fn new(owner: AccountId, treasury: AccountId) -> Self {
        require!(env::predecessor_account_id() == owner || env::predecessor_account_id() == env::current_account_id(), "Only deployer/owner may initialize");
        Self { owner, treasury, listings: BTreeMap::new(), holdings: BTreeMap::new(), transaction_count: 0 }
    }
    pub fn owner(&self) -> AccountId { self.owner.clone() }
    pub fn treasury(&self) -> AccountId { self.treasury.clone() }
    pub fn set_treasury(&mut self, treasury: AccountId) { self.assert_owner(); self.treasury = treasury; }

    pub fn configure_listing(&mut self, property_id: u64, price_yocto: String, total_cells: u64) {
        self.assert_owner();
        require!(property_id > 0 && total_cells > 0 && total_cells <= 1_000_000, "Invalid listing");
        let price = price_yocto.parse::<u128>().expect("Invalid yoctoNEAR price");
        require!(price >= 1_000_000_000_000_000_000_000, "Min price 0.001 testnet NEAR");
        if let Some(old) = self.listings.get(&property_id) { require!(old.sold_cells <= total_cells, "Supply below issued balance"); }
        let sold = self.listings.get(&property_id).map(|x| x.sold_cells).unwrap_or(0);
        self.listings.insert(property_id, Listing { property_id, price_yocto, total_cells, sold_cells: sold, active: true });
        env::log_str(&format!("PROPERTY_LISTING:{}", property_id));
    }
    pub fn set_listing_active(&mut self, property_id: u64, active: bool) {
        self.assert_owner(); self.listings.get_mut(&property_id).expect("Listing missing").active = active;
    }
    #[payable]
    pub fn buy_cells(&mut self, property_id: u64, quantity: u64) {
        require!(quantity > 0 && quantity <= 100, "Quantity must be 1..100");
        let listing = self.listings.get_mut(&property_id).expect("Unknown listing");
        require!(listing.active, "Listing paused");
        require!(listing.total_cells - listing.sold_cells >= quantity, "Insufficient cells");
        let cost = listing.price_yocto.parse::<u128>().expect("Invalid stored price").checked_mul(quantity as u128).expect("Price overflow");
        require!(env::attached_deposit().as_yoctonear() == cost, "Attach exact testnet NEAR amount");
        listing.sold_cells += quantity;
        let owner = env::predecessor_account_id();
        let key = Self::key(property_id, &owner);
        *self.holdings.entry(key).or_insert(0) += quantity;
        self.transaction_count += 1;
        env::log_str(&format!("CELL_PURCHASE:{}:{}:{}:{}", property_id, owner, quantity, cost));
    }
    pub fn transfer_cells(&mut self, property_id: u64, receiver_id: AccountId, quantity: u64) {
        require!(quantity > 0, "Positive quantity required");
        require!(self.listings.contains_key(&property_id), "Unknown listing");
        let sender = env::predecessor_account_id();
        let from_key = Self::key(property_id, &sender);
        let owned = self.holdings.get(&from_key).copied().unwrap_or(0);
        require!(owned >= quantity, "Insufficient balance");
        self.holdings.insert(from_key, owned - quantity);
        *self.holdings.entry(Self::key(property_id, &receiver_id)).or_insert(0) += quantity;
        env::log_str(&format!("CELL_TRANSFER:{}:{}:{}:{}", property_id, sender, receiver_id, quantity));
    }
    pub fn withdraw(&mut self, amount_yocto: String) -> Promise {
        self.assert_owner();
        let amount = amount_yocto.parse::<u128>().expect("Invalid amount");
        require!(amount > 0, "Amount required");
        // Do not drain the contract's balance below a storage+gas reserve.
        let available = env::account_balance().as_yoctonear();
        let storage_cost = (env::storage_usage() as u128).saturating_mul(env::storage_byte_cost().as_yoctonear());
        let reserve = storage_cost.saturating_add(100_000_000_000_000_000_000_000); // +0.1 NEAR
        require!(available >= reserve.saturating_add(amount), "Contract storage/gas reserve must remain funded");
        Promise::new(self.treasury.clone()).transfer(NearToken::from_yoctonear(amount))
    }
    pub fn get_listing(&self, property_id: u64) -> Option<Listing> { self.listings.get(&property_id).cloned() }
    pub fn get_listings(&self) -> Vec<Listing> { self.listings.values().cloned().collect() }
    pub fn get_holding(&self, property_id: u64, account_id: AccountId) -> u64 { self.holdings.get(&Self::key(property_id, &account_id)).copied().unwrap_or(0) }
    pub fn get_transaction_count(&self) -> u64 { self.transaction_count }
    fn key(id: u64, account_id: &AccountId) -> String { format!("{}:{}", id, account_id) }
    fn assert_owner(&self) { require!(env::predecessor_account_id() == self.owner, "Owner only"); }
}
