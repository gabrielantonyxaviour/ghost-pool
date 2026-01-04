//! Ghost Pool - Main AMM pool contract with auto-staking CSPR

use alloc::vec::Vec;
use odra::prelude::*;
use odra::ContractRef;
use odra::casper_types::{PublicKey, U256, U512};

use crate::events::*;
use crate::lp_token::LpToken;
use crate::types::*;

/// External contract interface for CEP-18 tokens (matches odra-modules CEP-18 signature)
#[odra::external_contract]
pub trait Cep18Token {
    /// Transfer tokens to a recipient
    fn transfer(&mut self, recipient: &Address, amount: &U256);
    /// Transfer tokens from owner to recipient (requires prior approval)
    fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256);
}

/// Ghost Pool AMM with auto-staking CSPR liquidity
#[odra::module]
pub struct GhostPoolPool {
    // ============ TOKEN ADDRESSES ============
    /// Paired CEP-18 token address
    token_address: Var<Address>,
    /// LP token (internal submodule)
    lp_token: SubModule<LpToken>,

    // ============ RESERVES ============
    /// Total CSPR reserve (staked + buffer)
    reserve_cspr: Var<U512>,
    /// Total paired token reserve
    reserve_token: Var<U512>,

    // ============ STAKING ============
    /// CSPR delegated via auction
    staked_cspr: Var<U512>,
    /// Unstaked CSPR for immediate swaps
    buffer_cspr: Var<U512>,
    /// Validator public key for delegation
    validator: Var<PublicKey>,

    // ============ CONFIG ============
    /// Pool configuration (fees and buffer target)
    config: Var<PoolConfig>,
    /// Treasury address for protocol fees
    treasury: Var<Address>,

    // ============ WITHDRAWALS ============
    /// Counter for withdrawal IDs
    withdrawal_counter: Var<u64>,
    /// Withdrawal requests by ID
    withdrawals: Mapping<u64, WithdrawalRequest>,
    /// User's withdrawal IDs
    user_withdrawals: Mapping<Address, Vec<u64>>,

    // ============ ADMIN ============
    /// Admin address
    admin: Var<Address>,
    /// Minimum liquidity (locked on first deposit)
    minimum_liquidity: Var<U512>,
}

#[odra::module]
impl GhostPoolPool {
    /// Initialize the pool
    #[odra(init)]
    pub fn init(
        &mut self,
        token_address: Address,
        validator: PublicKey,
        treasury: Address,
        admin: Address,
    ) {
        self.token_address.set(token_address);
        self.validator.set(validator);
        self.treasury.set(treasury);
        self.admin.set(admin);

        self.reserve_cspr.set(U512::zero());
        self.reserve_token.set(U512::zero());
        self.staked_cspr.set(U512::zero());
        self.buffer_cspr.set(U512::zero());

        self.config.set(PoolConfig {
            buffer_target_bps: U256::from(DEFAULT_BUFFER_TARGET_BPS),
            swap_fee_bps: U256::from(DEFAULT_SWAP_FEE_BPS),
            protocol_fee_bps: U256::from(DEFAULT_PROTOCOL_FEE_BPS),
        });

        self.minimum_liquidity.set(U512::from(MINIMUM_LIQUIDITY));
        self.withdrawal_counter.set(0);

        // Initialize LP token
        self.lp_token.init(
            String::from("Ghost Pool LP"),
            String::from("GP-LP"),
            9,
        );
    }

    // ============ ADD LIQUIDITY ============

    /// Add liquidity to pool
    /// User sends CSPR as attached value + must have approved token transfer
    #[odra(payable)]
    pub fn add_liquidity(
        &mut self,
        token_amount: U512,
        min_lp_tokens: U512,
    ) -> U512 {
        let caller = self.env().caller();
        let cspr_amount = self.env().attached_value();

        if cspr_amount == U512::zero() {
            self.env().revert(PoolError::ZeroCsprAmount);
        }
        if token_amount == U512::zero() {
            self.env().revert(PoolError::ZeroTokenAmount);
        }

        let reserve_cspr = self.reserve_cspr.get_or_default();
        let reserve_token = self.reserve_token.get_or_default();
        let total_lp = self.lp_token.total_supply();

        let lp_to_mint: U512;

        if total_lp == U512::zero() {
            // First deposit - use geometric mean
            let product = cspr_amount * token_amount;
            let sqrt_product = self.sqrt(product);
            let min_liq = self.minimum_liquidity.get_or_default();

            if sqrt_product <= min_liq {
                self.env().revert(PoolError::InitialLiquidityTooLow);
            }

            lp_to_mint = sqrt_product - min_liq;

            // Lock minimum liquidity forever (mint to contract itself as burn address)
            let burn_address = self.env().self_address();
            self.lp_token.mint(&burn_address, min_liq);
        } else {
            // Subsequent deposits - mint proportional to smaller ratio
            let lp_from_cspr = (cspr_amount * total_lp) / reserve_cspr;
            let lp_from_token = (token_amount * total_lp) / reserve_token;

            lp_to_mint = if lp_from_cspr < lp_from_token {
                lp_from_cspr
            } else {
                lp_from_token
            };
        }

        if lp_to_mint < min_lp_tokens {
            self.env().revert(PoolError::SlippageExceeded);
        }

        // Transfer tokens from user
        self.transfer_token_from(&caller, &self.env().self_address(), token_amount);

        // Update reserves
        self.reserve_cspr.set(reserve_cspr + cspr_amount);
        self.reserve_token.set(reserve_token + token_amount);

        // Update buffer and stake new CSPR
        let new_buffer = self.buffer_cspr.get_or_default() + cspr_amount;
        self.buffer_cspr.set(new_buffer);
        self.rebalance_stake();

        // Mint LP tokens
        self.lp_token.mint(&caller, lp_to_mint);

        // Emit event
        self.env().emit_event(LiquidityAdded {
            provider: caller,
            cspr_amount,
            token_amount,
            lp_minted: lp_to_mint,
        });

        lp_to_mint
    }

    // ============ REMOVE LIQUIDITY ============

    /// Remove liquidity - queues withdrawal due to 14h unbonding
    pub fn remove_liquidity(
        &mut self,
        lp_amount: U512,
        min_cspr: U512,
        min_token: U512,
    ) -> u64 {
        let caller = self.env().caller();

        let lp_balance = self.lp_token.balance_of(&caller);
        if lp_amount > lp_balance {
            self.env().revert(PoolError::InsufficientLpBalance);
        }
        if lp_amount == U512::zero() {
            self.env().revert(PoolError::ZeroAmount);
        }

        let total_lp = self.lp_token.total_supply();
        let reserve_cspr = self.reserve_cspr.get_or_default();
        let reserve_token = self.reserve_token.get_or_default();

        // Calculate share of reserves
        let cspr_amount = (lp_amount * reserve_cspr) / total_lp;
        let token_amount = (lp_amount * reserve_token) / total_lp;

        if cspr_amount < min_cspr {
            self.env().revert(PoolError::CsprSlippage);
        }
        if token_amount < min_token {
            self.env().revert(PoolError::TokenSlippage);
        }

        // Burn LP tokens
        self.lp_token.burn(&caller, lp_amount);

        // Update reserves
        self.reserve_cspr.set(reserve_cspr - cspr_amount);
        self.reserve_token.set(reserve_token - token_amount);

        // Transfer tokens immediately
        self.transfer_token(&caller, token_amount);

        // Queue CSPR withdrawal (need to undelegate)
        self.undelegate_for_withdrawal(cspr_amount);

        let withdrawal_id = self.withdrawal_counter.get_or_default();
        self.withdrawal_counter.set(withdrawal_id + 1);

        let now = self.env().get_block_time();
        let claimable = now + UNBONDING_PERIOD_MS;

        let request = WithdrawalRequest {
            id: withdrawal_id,
            user: caller,
            lp_burned: lp_amount,
            cspr_amount,
            token_amount,
            request_time: now,
            claimable_time: claimable,
            claimed: false,
        };

        self.withdrawals.set(&withdrawal_id, request);

        let mut user_ids = self.user_withdrawals.get(&caller).unwrap_or_default();
        user_ids.push(withdrawal_id);
        self.user_withdrawals.set(&caller, user_ids);

        self.env().emit_event(LiquidityRemoved {
            provider: caller,
            lp_burned: lp_amount,
            cspr_amount,
            token_amount,
            withdrawal_id,
        });

        withdrawal_id
    }

    /// Claim CSPR after unbonding period
    pub fn claim_withdrawal(&mut self, withdrawal_id: u64) -> U512 {
        let caller = self.env().caller();

        let mut request = self.withdrawals.get(&withdrawal_id)
            .unwrap_or_else(|| self.env().revert(PoolError::WithdrawalNotFound));

        if request.user != caller {
            self.env().revert(PoolError::NotYourWithdrawal);
        }
        if request.claimed {
            self.env().revert(PoolError::AlreadyClaimed);
        }
        if self.env().get_block_time() < request.claimable_time {
            self.env().revert(PoolError::StillUnbonding);
        }

        request.claimed = true;
        self.withdrawals.set(&withdrawal_id, request.clone());

        // Transfer CSPR
        self.env().transfer_tokens(&caller, &request.cspr_amount);

        self.env().emit_event(WithdrawalClaimed {
            user: caller,
            withdrawal_id,
            cspr_amount: request.cspr_amount,
        });

        request.cspr_amount
    }

    // ============ SWAP FUNCTIONS ============

    /// Swap CSPR for tokens
    #[odra(payable)]
    pub fn swap_cspr_for_token(&mut self, min_token_out: U512) -> U512 {
        let caller = self.env().caller();
        let cspr_in = self.env().attached_value();

        if cspr_in == U512::zero() {
            self.env().revert(PoolError::ZeroCsprAmount);
        }

        let reserve_cspr = self.reserve_cspr.get_or_default();
        let reserve_token = self.reserve_token.get_or_default();

        // Calculate output with fee
        let token_out = self.get_amount_out(cspr_in, reserve_cspr, reserve_token);

        if token_out < min_token_out {
            self.env().revert(PoolError::SlippageExceeded);
        }
        if token_out >= reserve_token {
            self.env().revert(PoolError::InsufficientLiquidity);
        }

        // Update reserves
        self.reserve_cspr.set(reserve_cspr + cspr_in);
        self.reserve_token.set(reserve_token - token_out);

        // Add CSPR to buffer, then rebalance
        let new_buffer = self.buffer_cspr.get_or_default() + cspr_in;
        self.buffer_cspr.set(new_buffer);
        self.rebalance_stake();

        // Transfer tokens to user
        self.transfer_token(&caller, token_out);

        self.env().emit_event(Swap {
            sender: caller,
            cspr_in,
            cspr_out: U512::zero(),
            token_in: U512::zero(),
            token_out,
        });

        token_out
    }

    /// Swap tokens for CSPR
    pub fn swap_token_for_cspr(
        &mut self,
        token_in: U512,
        min_cspr_out: U512,
    ) -> U512 {
        let caller = self.env().caller();

        if token_in == U512::zero() {
            self.env().revert(PoolError::ZeroTokenAmount);
        }

        let reserve_cspr = self.reserve_cspr.get_or_default();
        let reserve_token = self.reserve_token.get_or_default();

        // Calculate output with fee
        let cspr_out = self.get_amount_out(token_in, reserve_token, reserve_cspr);

        if cspr_out < min_cspr_out {
            self.env().revert(PoolError::SlippageExceeded);
        }

        // Check buffer has enough CSPR
        let buffer = self.buffer_cspr.get_or_default();
        if cspr_out > buffer {
            self.env().revert(PoolError::InsufficientBuffer);
        }

        // Transfer tokens from user
        self.transfer_token_from(&caller, &self.env().self_address(), token_in);

        // Update reserves
        self.reserve_cspr.set(reserve_cspr - cspr_out);
        self.reserve_token.set(reserve_token + token_in);

        // Update buffer
        self.buffer_cspr.set(buffer - cspr_out);

        // Transfer CSPR to user
        self.env().transfer_tokens(&caller, &cspr_out);

        self.env().emit_event(Swap {
            sender: caller,
            cspr_in: U512::zero(),
            cspr_out,
            token_in,
            token_out: U512::zero(),
        });

        cspr_out
    }

    // ============ COMPOUND ============

    /// Harvest and compound staking rewards
    pub fn compound(&mut self) -> U512 {
        let rewards = self.get_pending_rewards();

        if rewards == U512::zero() {
            return U512::zero();
        }

        // Withdraw rewards from auction
        self.withdraw_staking_rewards();

        // Calculate protocol fee
        let config = self.config.get_or_default();
        let protocol_fee = (rewards * U512::from(config.protocol_fee_bps.as_u64())) / U512::from(10000u64);
        let rewards_to_pool = rewards - protocol_fee;

        // Send fee to treasury
        if protocol_fee > U512::zero() {
            let treasury = self.treasury.get().expect("Treasury not set");
            self.env().transfer_tokens(&treasury, &protocol_fee);
        }

        // Add rewards to CSPR reserve (increases LP value)
        let new_reserve = self.reserve_cspr.get_or_default() + rewards_to_pool;
        self.reserve_cspr.set(new_reserve);

        // Add to buffer, then rebalance
        let new_buffer = self.buffer_cspr.get_or_default() + rewards_to_pool;
        self.buffer_cspr.set(new_buffer);
        self.rebalance_stake();

        self.env().emit_event(Compounded {
            rewards_harvested: rewards,
            protocol_fee,
            rewards_to_pool,
        });

        rewards_to_pool
    }

    // ============ VIEW FUNCTIONS ============

    /// Get current reserves
    pub fn get_reserves(&self) -> (U512, U512) {
        (
            self.reserve_cspr.get_or_default(),
            self.reserve_token.get_or_default(),
        )
    }

    /// Get staking info (staked, buffer)
    pub fn get_staking_info(&self) -> (U512, U512) {
        (
            self.staked_cspr.get_or_default(),
            self.buffer_cspr.get_or_default(),
        )
    }

    /// Quote CSPR to token swap
    pub fn quote_cspr_for_token(&self, cspr_in: U512) -> U512 {
        let (reserve_cspr, reserve_token) = self.get_reserves();
        self.get_amount_out(cspr_in, reserve_cspr, reserve_token)
    }

    /// Quote token to CSPR swap
    pub fn quote_token_for_cspr(&self, token_in: U512) -> U512 {
        let (reserve_cspr, reserve_token) = self.get_reserves();
        self.get_amount_out(token_in, reserve_token, reserve_cspr)
    }

    /// Get LP token value in underlying assets
    pub fn get_lp_value(&self, lp_amount: U512) -> (U512, U512) {
        let total_lp = self.lp_token.total_supply();
        if total_lp == U512::zero() {
            return (U512::zero(), U512::zero());
        }

        let reserve_cspr = self.reserve_cspr.get_or_default();
        let reserve_token = self.reserve_token.get_or_default();

        let cspr_value = (lp_amount * reserve_cspr) / total_lp;
        let token_value = (lp_amount * reserve_token) / total_lp;

        (cspr_value, token_value)
    }

    /// Get user's withdrawal requests
    pub fn get_user_withdrawals(&self, user: Address) -> Vec<WithdrawalRequest> {
        let ids = self.user_withdrawals.get(&user).unwrap_or_default();
        ids.iter()
            .filter_map(|id| self.withdrawals.get(id))
            .collect()
    }

    /// Get LP token address (returns pool address as LP token is a submodule)
    pub fn lp_token_address(&self) -> Address {
        self.env().self_address()
    }

    /// Get paired token address
    pub fn token_address(&self) -> Address {
        self.token_address.get().expect("Token not set")
    }

    /// Get LP token balance for an address
    pub fn lp_balance_of(&self, owner: &Address) -> U512 {
        self.lp_token.balance_of(owner)
    }

    /// Get LP token total supply
    pub fn lp_total_supply(&self) -> U512 {
        self.lp_token.total_supply()
    }

    /// Get a specific withdrawal request by ID
    pub fn get_withdrawal(&self, withdrawal_id: u64) -> WithdrawalRequest {
        self.withdrawals.get(&withdrawal_id)
            .unwrap_or_else(|| self.env().revert(PoolError::WithdrawalNotFound))
    }

    // ============ INTERNAL FUNCTIONS ============

    /// Constant product formula with fee
    fn get_amount_out(&self, amount_in: U512, reserve_in: U512, reserve_out: U512) -> U512 {
        if amount_in == U512::zero() || reserve_in == U512::zero() || reserve_out == U512::zero() {
            return U512::zero();
        }

        let config = self.config.get_or_default();

        // amount_in_with_fee = amount_in * (10000 - fee) / 10000
        let fee_multiplier = U512::from(10000u64) - U512::from(config.swap_fee_bps.as_u64());
        let amount_in_with_fee = (amount_in * fee_multiplier) / U512::from(10000u64);

        // output = (amount_in_with_fee * reserve_out) / (reserve_in + amount_in_with_fee)
        let numerator = amount_in_with_fee * reserve_out;
        let denominator = reserve_in + amount_in_with_fee;

        numerator / denominator
    }

    /// Rebalance between staked and buffer
    fn rebalance_stake(&mut self) {
        let reserve_cspr = self.reserve_cspr.get_or_default();
        let config = self.config.get_or_default();

        // Target buffer = reserve * buffer_target_bps / 10000
        let target_buffer = (reserve_cspr * U512::from(config.buffer_target_bps.as_u64()))
            / U512::from(10000u64);

        let current_buffer = self.buffer_cspr.get_or_default();
        let current_staked = self.staked_cspr.get_or_default();

        if current_buffer > target_buffer {
            // Buffer too high, stake excess
            let excess = current_buffer - target_buffer;
            self.delegate_to_validator(excess);
            self.buffer_cspr.set(target_buffer);
            self.staked_cspr.set(current_staked + excess);
        }
        // Note: We don't auto-unstake if buffer too low
        // That requires 14h unbonding - handled separately
    }

    fn undelegate_for_withdrawal(&mut self, amount: U512) {
        let staked = self.staked_cspr.get_or_default();
        let buffer = self.buffer_cspr.get_or_default();

        if amount <= buffer {
            // Can fulfill from buffer
            self.buffer_cspr.set(buffer - amount);
        } else {
            // Need to undelegate
            let from_staked = amount - buffer;

            self.buffer_cspr.set(U512::zero());
            self.staked_cspr.set(staked - from_staked);

            // Undelegate from auction
            self.undelegate_from_validator(from_staked);
        }
    }

    // ============ SYSTEM AUCTION CALLS ============
    // Casper 2.0 System Auction integration using Odra ContractEnv

    /// Delegate CSPR to the configured validator via System Auction
    fn delegate_to_validator(&self, amount: U512) {
        if amount == U512::zero() {
            return;
        }

        let validator = self.validator.get().expect("Validator not set");

        // Use Odra's built-in delegate method which calls the System Auction
        // Note: Only call delegate in WASM (deployment). Native builds (tests) skip this
        // because OdraVM doesn't support delegation.
        #[cfg(target_arch = "wasm32")]
        self.env().delegate(validator, amount);
        #[cfg(not(target_arch = "wasm32"))]
        let _ = validator; // silence unused warning in native/test mode

        self.env().emit_event(Delegated { amount });
    }

    /// Undelegate CSPR from the validator (initiates 14h unbonding period)
    fn undelegate_from_validator(&self, amount: U512) {
        if amount == U512::zero() {
            return;
        }

        let validator = self.validator.get().expect("Validator not set");

        // Use Odra's built-in undelegate method which calls the System Auction
        // Note: Only call undelegate in WASM (deployment). Native builds (tests) skip this.
        #[cfg(target_arch = "wasm32")]
        self.env().undelegate(validator, amount);
        #[cfg(not(target_arch = "wasm32"))]
        let _ = validator; // silence unused warning in native/test mode

        self.env().emit_event(Undelegated { amount });
    }

    /// Get pending staking rewards (difference between current delegated amount and tracked staked amount)
    /// In Casper 2.0, rewards are auto-compounded into the delegated amount
    fn get_pending_rewards(&self) -> U512 {
        let validator = self.validator.get().expect("Validator not set");

        // Query current total delegated amount from the System Auction
        // Note: Only query in WASM (deployment). Native builds (tests) return tracked amount.
        #[cfg(target_arch = "wasm32")]
        let current_delegated = self.env().delegated_amount(validator);
        #[cfg(not(target_arch = "wasm32"))]
        let current_delegated = {
            let _ = validator; // silence unused warning in native/test mode
            self.staked_cspr.get_or_default() // In tests, return tracked amount (no rewards)
        };
        let tracked_staked = self.staked_cspr.get_or_default();

        // Rewards = current delegated amount - what we originally staked
        if current_delegated > tracked_staked {
            current_delegated - tracked_staked
        } else {
            U512::zero()
        }
    }

    /// Withdraw staking rewards by undelegating the reward portion
    /// Note: This initiates unbonding - rewards become available after 14h
    fn withdraw_staking_rewards(&self) {
        let rewards = self.get_pending_rewards();

        if rewards == U512::zero() {
            return;
        }

        // Undelegate the rewards portion from the validator
        // Note: Only call undelegate in WASM (deployment). Native builds (tests) skip this.
        #[cfg(target_arch = "wasm32")]
        {
            let validator = self.validator.get().expect("Validator not set");
            self.env().undelegate(validator, rewards);
        }
    }

    // ============ TOKEN HELPERS ============

    fn transfer_token(&self, to: &Address, amount: U512) {
        let token_address = self.token_address.get().expect("Token not set");
        let amount_u256 = U256::from(amount.as_u128());
        // Call CEP-18 transfer via external contract reference
        Cep18TokenContractRef::new(self.env(), token_address).transfer(to, &amount_u256);
    }

    fn transfer_token_from(&self, from: &Address, to: &Address, amount: U512) {
        let token_address = self.token_address.get().expect("Token not set");
        let amount_u256 = U256::from(amount.as_u128());
        // Call CEP-18 transfer_from via external contract reference
        Cep18TokenContractRef::new(self.env(), token_address).transfer_from(from, to, &amount_u256);
    }

    /// Integer square root (Babylonian method)
    fn sqrt(&self, n: U512) -> U512 {
        if n == U512::zero() {
            return U512::zero();
        }

        let mut x = n;
        let mut y = (x + U512::one()) / 2;

        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }

        x
    }
}

/// Pool errors
#[odra::odra_error]
pub enum PoolError {
    /// Zero CSPR amount provided
    ZeroCsprAmount = 1,
    /// Zero token amount provided
    ZeroTokenAmount = 2,
    /// Initial liquidity too low
    InitialLiquidityTooLow = 3,
    /// Slippage exceeded
    SlippageExceeded = 4,
    /// Insufficient LP balance
    InsufficientLpBalance = 5,
    /// Zero amount
    ZeroAmount = 6,
    /// CSPR slippage exceeded
    CsprSlippage = 7,
    /// Token slippage exceeded
    TokenSlippage = 8,
    /// Withdrawal not found
    WithdrawalNotFound = 9,
    /// Not your withdrawal
    NotYourWithdrawal = 10,
    /// Already claimed
    AlreadyClaimed = 11,
    /// Still unbonding
    StillUnbonding = 12,
    /// Insufficient liquidity
    InsufficientLiquidity = 13,
    /// Insufficient buffer for swap
    InsufficientBuffer = 14,
}
