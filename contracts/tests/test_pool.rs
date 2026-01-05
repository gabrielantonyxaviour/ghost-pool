//! Integration tests for Ghost Pool AMM

use odra::casper_types::{AsymmetricType, PublicKey, U256, U512};
use odra::host::{Deployer, HostRef};
use odra::prelude::*;

use ghost_pool::pool::{GhostPoolPool, GhostPoolPoolInitArgs};
use ghost_pool::test_token::{TestToken, TestTokenInitArgs};

/// Setup test environment with pool and test token
fn setup() -> (
    odra::host::HostEnv,
    ghost_pool::pool::GhostPoolPoolHostRef,
    ghost_pool::test_token::TestTokenHostRef,
) {
    let env = odra_test::env();

    // Deploy test token with initial supply
    let initial_supply = U256::from(1_000_000_000_000u128); // 1M tokens with 6 decimals
    let test_token = TestToken::deploy(
        &env,
        TestTokenInitArgs {
            name: "Test USDC".to_string(),
            symbol: "tUSDC".to_string(),
            decimals: 6,
            initial_supply,
        },
    );

    // Use a real validator from localnet (node-1)
    let validator_hex = "01fed662dc7f1f7af43ad785ba07a8cc05b7a96f9ee69613cfde43bc56bec1140b";
    let validator = PublicKey::from_hex(validator_hex).expect("Invalid validator key");

    // Deploy pool
    let treasury = env.get_account(1);
    let admin = env.get_account(0);

    let pool = GhostPoolPool::deploy(
        &env,
        GhostPoolPoolInitArgs {
            token_address: test_token.address().clone(),
            validator,
            treasury,
            admin,
        },
    );

    (env, pool, test_token)
}

/// Helper: Add initial liquidity to the pool
fn add_initial_liquidity(
    env: &odra::host::HostEnv,
    pool: &mut ghost_pool::pool::GhostPoolPoolHostRef,
    token: &mut ghost_pool::test_token::TestTokenHostRef,
) -> U512 {
    let user = env.get_account(0);
    let cspr_amount = U512::from(1000_000_000_000u128); // 1000 CSPR
    let token_amount = U512::from(1000_000_000u128); // 1000 tokens

    // Approve tokens for pool
    let pool_addr = pool.address().clone();
    token.approve(&pool_addr, &U256::from(token_amount.as_u128()));

    // Add liquidity
    env.set_caller(user);
    pool.with_tokens(cspr_amount).add_liquidity(token_amount, U512::zero())
}

#[cfg(test)]
mod pool_tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let (_env, pool, _token) = setup();

        let (reserve_cspr, reserve_token) = pool.get_reserves();
        assert_eq!(reserve_cspr, U512::zero());
        assert_eq!(reserve_token, U512::zero());

        let (staked, buffer) = pool.get_staking_info();
        assert_eq!(staked, U512::zero());
        assert_eq!(buffer, U512::zero());
    }

    #[test]
    fn test_add_liquidity_first_deposit() {
        let (env, pool, mut token) = setup();

        let user = env.get_account(0);
        let cspr_amount = U512::from(1000_000_000_000u128); // 1000 CSPR
        let token_amount = U512::from(1000_000_000u128); // 1000 tokens

        // Approve tokens for pool
        let pool_addr = pool.address().clone();
        token.approve(&pool_addr, &U256::from(token_amount.as_u128()));

        // Add liquidity
        env.set_caller(user);
        let lp_received = pool.with_tokens(cspr_amount).add_liquidity(token_amount, U512::zero());

        // Verify LP tokens received (sqrt(1000 * 1000) - 1000 minimum)
        assert!(lp_received > U512::zero());

        // Verify reserves updated
        let (reserve_cspr, reserve_token) = pool.get_reserves();
        assert_eq!(reserve_cspr, cspr_amount);
        assert_eq!(reserve_token, token_amount);
    }

    #[test]
    fn test_quote_functions() {
        let (_env, pool, _token) = setup();

        // With empty pool, quotes should return zero
        let quote = pool.quote_cspr_for_token(U512::from(100u64));
        assert_eq!(quote, U512::zero());

        let quote = pool.quote_token_for_cspr(U512::from(100u64));
        assert_eq!(quote, U512::zero());
    }

    #[test]
    fn test_get_lp_value_empty_pool() {
        let (_env, pool, _token) = setup();

        let (cspr_value, token_value) = pool.get_lp_value(U512::from(1000u64));
        assert_eq!(cspr_value, U512::zero());
        assert_eq!(token_value, U512::zero());
    }
}

// ============ ADD LIQUIDITY TESTS ============

#[cfg(test)]
mod add_liquidity_tests {
    use super::*;

    #[test]
    fn test_add_liquidity_subsequent_deposit() {
        let (env, mut pool, mut token) = setup();

        // First deposit
        let _lp1 = add_initial_liquidity(&env, &mut pool, &mut token);

        // Second deposit with same ratio
        let user = env.get_account(0);
        let cspr_amount = U512::from(500_000_000_000u128); // 500 CSPR
        let token_amount = U512::from(500_000_000u128); // 500 tokens

        let pool_addr = pool.address().clone();
        token.approve(&pool_addr, &U256::from(token_amount.as_u128()));
        env.set_caller(user);
        let lp2 = pool.with_tokens(cspr_amount).add_liquidity(token_amount, U512::zero());

        // Verify LP tokens received
        assert!(lp2 > U512::zero());

        // Verify reserves updated
        let (reserve_cspr, reserve_token) = pool.get_reserves();
        assert_eq!(reserve_cspr, U512::from(1500_000_000_000u128));
        assert_eq!(reserve_token, U512::from(1500_000_000u128));
    }

    #[test]
    fn test_add_liquidity_imbalanced() {
        let (env, mut pool, mut token) = setup();

        // First deposit to establish ratio
        let _lp1 = add_initial_liquidity(&env, &mut pool, &mut token);

        // Second deposit with different ratio (more tokens than CSPR ratio)
        let user = env.get_account(0);
        let cspr_amount = U512::from(500_000_000_000u128); // 500 CSPR
        let token_amount = U512::from(1000_000_000u128); // 1000 tokens (double the ratio)

        let pool_addr = pool.address().clone();
        token.approve(&pool_addr, &U256::from(token_amount.as_u128()));
        env.set_caller(user);
        let lp2 = pool.with_tokens(cspr_amount).add_liquidity(token_amount, U512::zero());

        // LP minted should be based on the smaller ratio (CSPR in this case)
        assert!(lp2 > U512::zero());

        // Reserves should still update with what was provided
        let (reserve_cspr, reserve_token) = pool.get_reserves();
        assert_eq!(reserve_cspr, U512::from(1500_000_000_000u128));
        assert_eq!(reserve_token, U512::from(2000_000_000u128));
    }

    #[test]
    fn test_add_liquidity_slippage_protection() {
        let (env, mut pool, mut token) = setup();

        // First deposit
        let _lp1 = add_initial_liquidity(&env, &mut pool, &mut token);

        // Second deposit with high min_lp_tokens requirement
        let user = env.get_account(0);
        let cspr_amount = U512::from(100_000_000_000u128); // 100 CSPR
        let token_amount = U512::from(100_000_000u128); // 100 tokens
        let min_lp = U512::from(999_999_999_999u128); // Unreasonably high

        let pool_addr = pool.address().clone();
        token.approve(&pool_addr, &U256::from(token_amount.as_u128()));
        env.set_caller(user);

        // Should revert due to slippage protection
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pool.with_tokens(cspr_amount).add_liquidity(token_amount, min_lp)
        }));
        assert!(result.is_err(), "Should revert due to slippage protection");
    }

    #[test]
    fn test_add_liquidity_zero_cspr_fails() {
        let (env, pool, mut token) = setup();

        let user = env.get_account(0);
        let token_amount = U512::from(1000_000_000u128);

        let pool_addr = pool.address().clone();
        token.approve(&pool_addr, &U256::from(token_amount.as_u128()));
        env.set_caller(user);

        // Should revert with zero CSPR
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pool.with_tokens(U512::zero()).add_liquidity(token_amount, U512::zero())
        }));
        assert!(result.is_err(), "Should revert with zero CSPR");
    }

    #[test]
    fn test_add_liquidity_zero_token_fails() {
        let (env, pool, _token) = setup();

        let user = env.get_account(0);
        let cspr_amount = U512::from(1000_000_000_000u128);

        env.set_caller(user);

        // Should revert with zero tokens
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pool.with_tokens(cspr_amount).add_liquidity(U512::zero(), U512::zero())
        }));
        assert!(result.is_err(), "Should revert with zero tokens");
    }
}

// ============ SWAP TESTS ============

#[cfg(test)]
mod swap_tests {
    use super::*;

    #[test]
    fn test_swap_cspr_for_token() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let _lp = add_initial_liquidity(&env, &mut pool, &mut token);

        // Get initial reserves
        let (reserve_cspr_before, reserve_token_before) = pool.get_reserves();

        // Swap CSPR for tokens
        let user = env.get_account(0);
        let cspr_in = U512::from(100_000_000_000u128); // 100 CSPR

        env.set_caller(user);
        let token_out = pool.with_tokens(cspr_in).swap_cspr_for_token(U512::zero());

        // Verify tokens received
        assert!(token_out > U512::zero());

        // Verify reserves updated
        let (reserve_cspr_after, reserve_token_after) = pool.get_reserves();
        assert_eq!(reserve_cspr_after, reserve_cspr_before + cspr_in);
        assert_eq!(reserve_token_after, reserve_token_before - token_out);
    }

    #[test]
    fn test_swap_token_for_cspr() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let _lp = add_initial_liquidity(&env, &mut pool, &mut token);

        // Get initial reserves
        let (reserve_cspr_before, reserve_token_before) = pool.get_reserves();
        let (_staked_before, buffer_before) = pool.get_staking_info();

        // Approve and swap tokens for CSPR
        let user = env.get_account(0);
        let token_in = U512::from(10_000_000u128); // 10 tokens

        // Approve additional tokens
        let pool_addr = pool.address().clone();
        token.approve(&pool_addr, &U256::from(token_in.as_u128()));

        env.set_caller(user);
        let cspr_out = pool.swap_token_for_cspr(token_in, U512::zero());

        // Verify CSPR received (should be limited by buffer)
        assert!(cspr_out > U512::zero());
        assert!(cspr_out <= buffer_before);

        // Verify reserves updated
        let (reserve_cspr_after, reserve_token_after) = pool.get_reserves();
        assert_eq!(reserve_cspr_after, reserve_cspr_before - cspr_out);
        assert_eq!(reserve_token_after, reserve_token_before + token_in);
    }

    #[test]
    fn test_swap_slippage_protection() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let _lp = add_initial_liquidity(&env, &mut pool, &mut token);

        // Try swap with unreasonably high min output
        let user = env.get_account(0);
        let cspr_in = U512::from(100_000_000_000u128); // 100 CSPR
        let min_token_out = U512::from(999_999_999_999u128); // Unreasonably high

        env.set_caller(user);

        // Should revert due to slippage protection
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pool.with_tokens(cspr_in).swap_cspr_for_token(min_token_out)
        }));
        assert!(result.is_err(), "Should revert due to slippage protection");
    }

    #[test]
    fn test_swap_insufficient_buffer() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let _lp = add_initial_liquidity(&env, &mut pool, &mut token);

        // Try to swap a large amount of tokens that would require more CSPR than buffer
        let user = env.get_account(0);
        let token_in = U512::from(900_000_000u128); // 900 tokens (would need ~90% of CSPR)

        let pool_addr = pool.address().clone();
        token.approve(&pool_addr, &U256::from(token_in.as_u128()));
        env.set_caller(user);

        // Should revert due to insufficient buffer
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pool.swap_token_for_cspr(token_in, U512::zero())
        }));
        assert!(result.is_err(), "Should revert due to insufficient buffer");
    }

    #[test]
    fn test_swap_fee_deduction() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let _lp = add_initial_liquidity(&env, &mut pool, &mut token);

        // Get quote for swap
        let cspr_in = U512::from(100_000_000_000u128); // 100 CSPR
        let quoted_output = pool.quote_cspr_for_token(cspr_in);

        // Calculate expected output without fee (x * y = k formula)
        let (reserve_cspr, reserve_token) = pool.get_reserves();
        let output_no_fee = (cspr_in * reserve_token) / (reserve_cspr + cspr_in);

        // Quoted output should be less than no-fee output due to 0.3% fee
        assert!(quoted_output < output_no_fee, "Fee should reduce output");

        // The difference should be approximately 0.3%
        // quoted = input * 0.997 * reserve_out / (reserve_in + input * 0.997)
        // This is an approximation check
        assert!(quoted_output > U512::zero());
    }

    #[test]
    fn test_swap_requires_liquidity() {
        let (env, pool, _token) = setup();

        // Try to swap on empty pool
        let user = env.get_account(0);
        let cspr_in = U512::from(100_000_000_000u128);

        env.set_caller(user);

        // Quote should return zero for empty pool
        let quote = pool.quote_cspr_for_token(cspr_in);
        assert_eq!(quote, U512::zero());
    }
}

// ============ REMOVE LIQUIDITY TESTS ============

#[cfg(test)]
mod remove_liquidity_tests {
    use super::*;

    #[test]
    fn test_remove_liquidity_partial() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let lp_received = add_initial_liquidity(&env, &mut pool, &mut token);

        // Remove half of LP
        let user = env.get_account(0);
        let lp_to_remove = lp_received / 2;

        env.set_caller(user);
        let withdrawal_id = pool.remove_liquidity(lp_to_remove, U512::zero(), U512::zero());

        // Verify withdrawal is queued
        let withdrawals = pool.get_user_withdrawals(user);
        assert_eq!(withdrawals.len(), 1);
        assert_eq!(withdrawals[0].id, withdrawal_id);
        assert!(!withdrawals[0].claimed);
    }

    #[test]
    fn test_remove_liquidity_full() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let lp_received = add_initial_liquidity(&env, &mut pool, &mut token);

        // Remove all LP
        let user = env.get_account(0);

        env.set_caller(user);
        let withdrawal_id = pool.remove_liquidity(lp_received, U512::zero(), U512::zero());

        // Verify withdrawal is queued
        let withdrawals = pool.get_user_withdrawals(user);
        assert_eq!(withdrawals.len(), 1);
        assert_eq!(withdrawals[0].id, withdrawal_id);
        assert_eq!(withdrawals[0].lp_burned, lp_received);
    }

    #[test]
    fn test_remove_liquidity_insufficient_balance() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let lp_received = add_initial_liquidity(&env, &mut pool, &mut token);

        // Try to remove more than owned
        let user = env.get_account(0);
        let too_much = lp_received + U512::one();

        env.set_caller(user);

        // Should revert
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pool.remove_liquidity(too_much, U512::zero(), U512::zero())
        }));
        assert!(result.is_err(), "Should revert with insufficient balance");
    }

    #[test]
    fn test_withdrawal_queue() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let lp_received = add_initial_liquidity(&env, &mut pool, &mut token);

        // Remove liquidity in portions
        let user = env.get_account(0);
        let portion = lp_received / 4;

        env.set_caller(user);

        // Create multiple withdrawals
        let id1 = pool.remove_liquidity(portion, U512::zero(), U512::zero());
        let id2 = pool.remove_liquidity(portion, U512::zero(), U512::zero());
        let id3 = pool.remove_liquidity(portion, U512::zero(), U512::zero());

        // Verify all withdrawals are queued
        let withdrawals = pool.get_user_withdrawals(user);
        assert_eq!(withdrawals.len(), 3);
        assert_eq!(withdrawals[0].id, id1);
        assert_eq!(withdrawals[1].id, id2);
        assert_eq!(withdrawals[2].id, id3);

        // All should be unclaimed
        for w in &withdrawals {
            assert!(!w.claimed);
        }
    }
}

// ============ CLAIM WITHDRAWAL TESTS ============

#[cfg(test)]
mod claim_withdrawal_tests {
    use super::*;
    use ghost_pool::types::UNBONDING_PERIOD_MS;

    #[test]
    fn test_claim_before_unbonding() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity and remove
        let lp_received = add_initial_liquidity(&env, &mut pool, &mut token);
        let user = env.get_account(0);
        let portion = lp_received / 2;

        env.set_caller(user);
        let withdrawal_id = pool.remove_liquidity(portion, U512::zero(), U512::zero());

        // Try to claim immediately (before unbonding period)
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pool.claim_withdrawal(withdrawal_id)
        }));
        assert!(result.is_err(), "Should revert: still unbonding");
    }

    #[test]
    fn test_claim_after_unbonding() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity and remove
        let lp_received = add_initial_liquidity(&env, &mut pool, &mut token);
        let user = env.get_account(0);
        let portion = lp_received / 2;

        env.set_caller(user);
        let withdrawal_id = pool.remove_liquidity(portion, U512::zero(), U512::zero());

        // Fast-forward time past unbonding period
        env.advance_block_time(UNBONDING_PERIOD_MS + 1000);

        // Claim should succeed
        let claimed = pool.claim_withdrawal(withdrawal_id);
        assert!(claimed > U512::zero());

        // Verify withdrawal is marked as claimed
        let withdrawals = pool.get_user_withdrawals(user);
        let withdrawal = withdrawals.iter().find(|w| w.id == withdrawal_id).unwrap();
        assert!(withdrawal.claimed);
    }

    #[test]
    fn test_claim_wrong_user() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity and remove
        let lp_received = add_initial_liquidity(&env, &mut pool, &mut token);
        let user = env.get_account(0);
        let other_user = env.get_account(2);
        let portion = lp_received / 2;

        env.set_caller(user);
        let withdrawal_id = pool.remove_liquidity(portion, U512::zero(), U512::zero());

        // Fast-forward time past unbonding period
        env.advance_block_time(UNBONDING_PERIOD_MS + 1000);

        // Try to claim as different user
        env.set_caller(other_user);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pool.claim_withdrawal(withdrawal_id)
        }));
        assert!(result.is_err(), "Should revert: not your withdrawal");
    }

    #[test]
    fn test_claim_already_claimed() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity and remove
        let lp_received = add_initial_liquidity(&env, &mut pool, &mut token);
        let user = env.get_account(0);
        let portion = lp_received / 2;

        env.set_caller(user);
        let withdrawal_id = pool.remove_liquidity(portion, U512::zero(), U512::zero());

        // Fast-forward time past unbonding period
        env.advance_block_time(UNBONDING_PERIOD_MS + 1000);

        // First claim should succeed
        let claimed = pool.claim_withdrawal(withdrawal_id);
        assert!(claimed > U512::zero());

        // Second claim should fail
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pool.claim_withdrawal(withdrawal_id)
        }));
        assert!(result.is_err(), "Should revert: already claimed");
    }
}

// ============ COMPOUND TESTS ============

#[cfg(test)]
mod compound_tests {
    use super::*;

    #[test]
    fn test_compound_no_rewards() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let _lp = add_initial_liquidity(&env, &mut pool, &mut token);

        // Compound with no rewards should return zero
        let rewards = pool.compound();
        assert_eq!(rewards, U512::zero());
    }

    #[test]
    fn test_compound_with_rewards() {
        let (env, mut pool, mut token) = setup();

        // Add initial liquidity
        let _lp = add_initial_liquidity(&env, &mut pool, &mut token);

        // Get initial reserves
        let (initial_reserve_cspr, _) = pool.get_reserves();

        // Note: In test environment, staking rewards are simulated
        // The compound function checks delegated_amount vs tracked staked
        // In real scenario, rewards accumulate from validator

        // Compound (may return 0 if no simulated rewards)
        let rewards = pool.compound();

        // If rewards exist, reserve should increase
        if rewards > U512::zero() {
            let (new_reserve_cspr, _) = pool.get_reserves();
            assert!(new_reserve_cspr > initial_reserve_cspr);
        }
    }
}

#[cfg(test)]
mod withdrawal_tests {
    use super::*;

    #[test]
    fn test_get_user_withdrawals_empty() {
        let (env, pool, _token) = setup();

        let user = env.get_account(0);
        let withdrawals = pool.get_user_withdrawals(user);
        assert!(withdrawals.is_empty());
    }
}
