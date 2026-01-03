//! Data types for Ghost Pool AMM

use odra::casper_types::{U256, U512};
use odra::prelude::Address;

/// Pool state containing reserves and staking information
#[odra::odra_type]
pub struct PoolState {
    /// Total CSPR reserve (staked + buffer)
    pub reserve_cspr: U512,
    /// Total paired token reserve
    pub reserve_token: U512,
    /// CSPR delegated via auction
    pub staked_cspr: U512,
    /// Unstaked CSPR for immediate swaps
    pub buffer_cspr: U512,
    /// Target buffer percentage (1000 = 10%)
    pub buffer_target_bps: U256,
    /// Swap fee (30 = 0.3%)
    pub swap_fee_bps: U256,
    /// Protocol fee on staking rewards (1000 = 10%)
    pub protocol_fee_bps: U256,
}

/// Withdrawal request for queued CSPR withdrawals
#[odra::odra_type]
pub struct WithdrawalRequest {
    /// Unique withdrawal ID
    pub id: u64,
    /// User address
    pub user: Address,
    /// LP tokens burned
    pub lp_burned: U512,
    /// CSPR amount to withdraw
    pub cspr_amount: U512,
    /// Token amount (already transferred)
    pub token_amount: U512,
    /// Request timestamp
    pub request_time: u64,
    /// When CSPR becomes claimable (+14 hours)
    pub claimable_time: u64,
    /// Whether withdrawal has been claimed
    pub claimed: bool,
}

/// Minimum liquidity locked forever to prevent division by zero
pub const MINIMUM_LIQUIDITY: u64 = 1000;

/// Default buffer target (10%)
pub const DEFAULT_BUFFER_TARGET_BPS: u64 = 1000;

/// Default swap fee (0.3%)
pub const DEFAULT_SWAP_FEE_BPS: u64 = 30;

/// Default protocol fee on staking rewards (10%)
pub const DEFAULT_PROTOCOL_FEE_BPS: u64 = 1000;

/// Unbonding period in milliseconds (14 hours)
pub const UNBONDING_PERIOD_MS: u64 = 14 * 60 * 60 * 1000;

/// Pool configuration parameters
#[odra::odra_type]
#[derive(Default)]
pub struct PoolConfig {
    /// Target buffer percentage (1000 = 10%)
    pub buffer_target_bps: U256,
    /// Swap fee (30 = 0.3%)
    pub swap_fee_bps: U256,
    /// Protocol fee on staking rewards (1000 = 10%)
    pub protocol_fee_bps: U256,
}
