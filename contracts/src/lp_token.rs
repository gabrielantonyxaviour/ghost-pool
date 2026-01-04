//! LP Token - CEP-18 compatible token representing pool shares

use odra::prelude::*;
use odra::casper_types::{U256, U512};
use odra_modules::cep18_token::Cep18;

/// LP Token contract wrapping CEP-18 with pool-only minting/burning
#[odra::module]
pub struct LpToken {
    /// Underlying CEP-18 token
    cep18: SubModule<Cep18>,
    /// Pool contract address (only pool can mint/burn)
    pool: Var<Address>,
}

#[odra::module]
impl LpToken {
    /// Initialize the LP token
    pub fn init(&mut self, name: String, symbol: String, decimals: u8) {
        self.cep18.init(
            symbol.clone(),
            name,
            decimals,
            U256::zero(),
        );
        self.pool.set(self.env().caller());
    }

    /// Mint LP tokens (pool only)
    pub fn mint(&mut self, to: &Address, amount: U512) {
        self.require_pool();
        let amount_u256 = U256::from(amount.as_u128());
        self.cep18.raw_mint(to, &amount_u256);
    }

    /// Burn LP tokens (pool only)
    pub fn burn(&mut self, from: &Address, amount: U512) {
        self.require_pool();
        let amount_u256 = U256::from(amount.as_u128());
        self.cep18.raw_burn(from, &amount_u256);
    }

    /// Get total supply
    pub fn total_supply(&self) -> U512 {
        U512::from(self.cep18.total_supply().as_u128())
    }

    /// Get balance of address
    pub fn balance_of(&self, owner: &Address) -> U512 {
        U512::from(self.cep18.balance_of(owner).as_u128())
    }

    /// Transfer tokens (standard CEP-18)
    pub fn transfer(&mut self, to: &Address, amount: &U256) {
        self.cep18.transfer(to, amount);
    }

    /// Transfer from (standard CEP-18)
    pub fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256) {
        self.cep18.transfer_from(owner, recipient, amount);
    }

    /// Approve spender (standard CEP-18)
    pub fn approve(&mut self, spender: &Address, amount: &U256) {
        self.cep18.approve(spender, amount);
    }

    /// Get allowance (standard CEP-18)
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

    // ============ INTERNAL ============

    fn require_pool(&self) {
        let pool = self.pool.get().expect("Pool not set");
        if self.env().caller() != pool {
            self.env().revert(LpTokenError::NotPool);
        }
    }
}

/// LP Token errors
#[odra::odra_error]
pub enum LpTokenError {
    /// Caller is not the pool contract
    NotPool = 1,
}
