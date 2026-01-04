//! Test Token - Simple CEP-18 token for testing the AMM

use odra::prelude::*;
use odra::casper_types::U256;
use odra_modules::cep18_token::Cep18;

/// Simple test token for pairing with CSPR in the pool
#[odra::module]
pub struct TestToken {
    /// Underlying CEP-18 token
    cep18: SubModule<Cep18>,
}

#[odra::module]
impl TestToken {
    /// Initialize the test token with initial supply to deployer
    pub fn init(&mut self, name: String, symbol: String, decimals: u8, initial_supply: U256) {
        let deployer = self.env().caller();
        self.cep18.init(
            symbol.clone(),
            name,
            decimals,
            initial_supply,
        );
        // Mint initial supply to deployer
        if initial_supply > U256::zero() {
            self.cep18.raw_mint(&deployer, &initial_supply);
        }
    }

    /// Mint tokens (for testing)
    pub fn mint(&mut self, to: &Address, amount: &U256) {
        self.cep18.raw_mint(to, amount);
    }

    /// Get total supply
    pub fn total_supply(&self) -> U256 {
        self.cep18.total_supply()
    }

    /// Get balance of address
    pub fn balance_of(&self, owner: &Address) -> U256 {
        self.cep18.balance_of(owner)
    }

    /// Transfer tokens
    pub fn transfer(&mut self, recipient: &Address, amount: &U256) {
        self.cep18.transfer(recipient, amount);
    }

    /// Transfer from
    pub fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256) {
        self.cep18.transfer_from(owner, recipient, amount);
    }

    /// Approve spender
    pub fn approve(&mut self, spender: &Address, amount: &U256) {
        self.cep18.approve(spender, amount);
    }

    /// Get allowance
    pub fn allowance(&self, owner: &Address, spender: &Address) -> U256 {
        self.cep18.allowance(owner, spender)
    }

    /// Get token name
    pub fn name(&self) -> String {
        self.cep18.name()
    }

    /// Get token symbol
    pub fn symbol(&self) -> String {
        self.cep18.symbol()
    }

    /// Get token decimals
    pub fn decimals(&self) -> u8 {
        self.cep18.decimals()
    }
}
