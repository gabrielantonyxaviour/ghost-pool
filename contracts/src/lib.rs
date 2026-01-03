//! Ghost Pool AMM - Auto-staking liquidity pool for Casper Network 2.0
//!
//! An AMM (Uniswap V2 style) where CSPR liquidity is auto-staked via System Auction,
//! allowing LPs to earn swap fees + staking rewards (~2x traditional AMM yield).

#![no_std]

extern crate alloc;

pub mod events;
pub mod lp_token;
pub mod pool;
pub mod test_token;
pub mod types;

pub use events::*;
pub use lp_token::LpToken;
pub use pool::GhostPoolPool;
pub use test_token::TestToken;
pub use types::*;
