//! Events emitted by Ghost Pool AMM

use odra::prelude::*;
use odra::casper_types::U512;

/// Emitted when liquidity is added to the pool
#[odra::event]
pub struct LiquidityAdded {
    /// Liquidity provider address
    pub provider: Address,
    /// CSPR amount added
    pub cspr_amount: U512,
    /// Token amount added
    pub token_amount: U512,
    /// LP tokens minted
    pub lp_minted: U512,
}

/// Emitted when liquidity removal is initiated
#[odra::event]
pub struct LiquidityRemoved {
    /// Liquidity provider address
    pub provider: Address,
    /// LP tokens burned
    pub lp_burned: U512,
    /// CSPR amount to be withdrawn
    pub cspr_amount: U512,
    /// Token amount withdrawn immediately
    pub token_amount: U512,
    /// Withdrawal request ID for CSPR claim
    pub withdrawal_id: u64,
}

/// Emitted when CSPR withdrawal is claimed after unbonding
#[odra::event]
pub struct WithdrawalClaimed {
    /// User address
    pub user: Address,
    /// Withdrawal request ID
    pub withdrawal_id: u64,
    /// CSPR amount claimed
    pub cspr_amount: U512,
}

/// Emitted on each swap
#[odra::event]
pub struct Swap {
    /// Sender address
    pub sender: Address,
    /// CSPR input (0 if swapping token for CSPR)
    pub cspr_in: U512,
    /// CSPR output (0 if swapping CSPR for token)
    pub cspr_out: U512,
    /// Token input (0 if swapping CSPR for token)
    pub token_in: U512,
    /// Token output (0 if swapping token for CSPR)
    pub token_out: U512,
}

/// Emitted when staking rewards are compounded
#[odra::event]
pub struct Compounded {
    /// Total rewards harvested from staking
    pub rewards_harvested: U512,
    /// Protocol fee taken
    pub protocol_fee: U512,
    /// Rewards added to pool
    pub rewards_to_pool: U512,
}

/// Emitted when CSPR is delegated to validator
#[odra::event]
pub struct Delegated {
    /// Amount delegated
    pub amount: U512,
}

/// Emitted when CSPR is undelegated from validator
#[odra::event]
pub struct Undelegated {
    /// Amount undelegated
    pub amount: U512,
}
