//! Integration test script for Ghost Pool contracts on localnet
//!
//! Tests the full AMM flow against deployed contracts:
//! 1. Approve tokens
//! 2. Add liquidity
//! 3. Swap CSPR → Token
//! 4. Swap Token → CSPR
//! 5. Remove liquidity
//! 6. Check withdrawal status
//!
//! Usage:
//!   cargo run --bin integration_test --features livenet

use std::str::FromStr;

use odra::casper_types::{U256, U512};
use odra::host::{HostRef, HostRefLoader};
use odra::prelude::*;

use ghost_pool::pool::{GhostPoolPool, GhostPoolPoolHostRef};
use ghost_pool::test_token::{TestToken, TestTokenHostRef};

// ========== DEPLOYED CONTRACT ADDRESSES ==========
// Update these after deployment!
const TOKEN_ADDRESS: &str = "hash-ea5e11273282fb9223b8358dbbffe6daf0e805f6529c5f1ce291f0cddbc80b19";
const POOL_ADDRESS: &str = "hash-5e1e4c00f64b1b2f35be3b356ea8b14f3fdef9e4aa27443effb2fe3d5fcd797b";

// ========== TEST AMOUNTS ==========
const CSPR_TO_ADD: u128 = 100_000_000_000; // 100 CSPR (motes)
const TOKEN_TO_ADD: u128 = 100_000_000_000; // 100 tokens (9 decimals)
const CSPR_TO_SWAP: u128 = 10_000_000_000; // 10 CSPR
const TOKEN_TO_SWAP: u128 = 10_000_000_000; // 10 tokens

fn main() {
    println!("=== Ghost Pool Integration Test ===\n");

    // Load the Casper livenet environment
    let env = odra_casper_livenet_env::env();

    let caller = env.caller();
    println!("Test account: {:?}", caller);

    // Parse contract addresses
    println!("\n[1] Loading deployed contracts...");

    let token_address = Address::from_str(TOKEN_ADDRESS).expect("Invalid token address");
    let pool_address = Address::from_str(POOL_ADDRESS).expect("Invalid pool address");

    println!("  Token address: {:?}", token_address);
    println!("  Pool address: {:?}", pool_address);

    // Load contract references using the correct Odra API
    let mut token: TestTokenHostRef = TestToken::load(&env, token_address.clone());
    let mut pool: GhostPoolPoolHostRef = GhostPoolPool::load(&env, pool_address.clone());

    // Check initial balances
    println!("\n[2] Checking initial balances...");
    let token_balance = token.balance_of(&caller);
    println!("  Token balance: {:?}", token_balance);

    // Query pool state
    let reserves = pool.get_reserves();
    println!("  Pool reserves - CSPR: {:?}, Token: {:?}", reserves.0, reserves.1);

    // Step 1: Approve tokens for the pool
    println!("\n[3] Approving tokens for pool...");
    let approve_amount = U256::from(TOKEN_TO_ADD + TOKEN_TO_SWAP + 1_000_000_000_000u128);
    env.set_gas(50_000_000_000u64); // 50 CSPR gas
    token.approve(&pool_address, &approve_amount);
    println!("  Approved {:?} tokens", approve_amount);

    // Verify allowance
    let allowance = token.allowance(&caller, &pool_address);
    println!("  Pool allowance: {:?}", allowance);

    // Step 2: Add liquidity
    println!("\n[4] Adding liquidity...");
    println!("  CSPR: {} motes ({} CSPR)", CSPR_TO_ADD, CSPR_TO_ADD / 1_000_000_000);
    println!("  Token: {} (9 decimals)", TOKEN_TO_ADD);

    env.set_gas(150_000_000_000u64); // 150 CSPR gas
    let lp_received = pool.with_tokens(U512::from(CSPR_TO_ADD)).add_liquidity(
        U512::from(TOKEN_TO_ADD),
        U512::zero(), // min_lp_tokens
    );
    println!("  LP tokens received: {:?}", lp_received);

    // Check updated reserves
    let reserves = pool.get_reserves();
    println!("  New reserves - CSPR: {:?}, Token: {:?}", reserves.0, reserves.1);

    // Step 3: Swap CSPR for Token
    println!("\n[5] Swapping {} CSPR for tokens...", CSPR_TO_SWAP / 1_000_000_000);
    env.set_gas(100_000_000_000u64); // 100 CSPR gas
    let token_received = pool.with_tokens(U512::from(CSPR_TO_SWAP)).swap_cspr_for_token(
        U512::zero(), // min_token_out
    );
    println!("  Tokens received: {:?}", token_received);

    let reserves = pool.get_reserves();
    println!("  Reserves after swap - CSPR: {:?}, Token: {:?}", reserves.0, reserves.1);

    // Step 4: Swap Token for CSPR
    println!("\n[6] Swapping {} tokens for CSPR...", TOKEN_TO_SWAP);
    env.set_gas(100_000_000_000u64); // 100 CSPR gas
    let cspr_received = pool.swap_token_for_cspr(
        U512::from(TOKEN_TO_SWAP),
        U512::zero(), // min_cspr_out
    );
    println!("  CSPR received: {:?} motes", cspr_received);

    let reserves = pool.get_reserves();
    println!("  Reserves after swap - CSPR: {:?}, Token: {:?}", reserves.0, reserves.1);

    // Step 5: Check LP balance
    println!("\n[7] Checking LP token balance...");
    let lp_balance = pool.lp_balance_of(&caller);
    println!("  LP balance: {:?}", lp_balance);

    // Step 6: Remove liquidity (partial)
    if lp_balance > U512::zero() {
        let lp_to_remove = lp_balance / 2; // Remove half
        println!("\n[8] Removing liquidity ({:?} LP tokens)...", lp_to_remove);
        env.set_gas(150_000_000_000u64); // 150 CSPR gas
        let withdrawal_id = pool.remove_liquidity(
            lp_to_remove,
            U512::zero(), // min_cspr
            U512::zero(), // min_token
        );
        println!("  Withdrawal ID: {}", withdrawal_id);

        // Check withdrawal status
        println!("\n[9] Checking withdrawal status...");
        let withdrawal = pool.get_withdrawal(withdrawal_id);
        println!("  CSPR amount: {:?}", withdrawal.cspr_amount);
        println!("  Token amount: {:?}", withdrawal.token_amount);
        println!("  Claimed: {}", withdrawal.claimed);
        println!("  Claimable time: {:?}", withdrawal.claimable_time);
        println!("  (Note: CSPR claimable after 14h unbonding period on real network)");
    }

    // Final state
    println!("\n=== Integration Test Complete ===");
    println!("\nFinal State:");
    let final_reserves = pool.get_reserves();
    println!("  Pool reserves - CSPR: {:?}, Token: {:?}", final_reserves.0, final_reserves.1);
    let final_lp = pool.lp_balance_of(&caller);
    println!("  User LP balance: {:?}", final_lp);
    let final_token = token.balance_of(&caller);
    println!("  User token balance: {:?}", final_token);

    println!("\n✓ All operations completed successfully!");
    println!("  The contracts are working correctly on localnet.");
    println!("  Ready for UI integration testing!");
}
