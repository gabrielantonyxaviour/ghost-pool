//! Tests for Test Token contract

use odra::casper_types::U256;
use odra::host::{Deployer, HostRef};
use odra::prelude::*;

use ghost_pool::test_token::{TestToken, TestTokenInitArgs};

#[cfg(test)]
mod test_token_tests {
    use super::*;

    fn setup() -> (odra::host::HostEnv, ghost_pool::test_token::TestTokenHostRef) {
        let env = odra_test::env();
        let initial_supply = U256::from(1_000_000_000_000u128);

        let test_token = TestToken::deploy(
            &env,
            TestTokenInitArgs {
                name: "Test USDC".to_string(),
                symbol: "tUSDC".to_string(),
                decimals: 6,
                initial_supply,
            },
        );

        (env, test_token)
    }

    #[test]
    fn test_initial_state() {
        let (_env, token) = setup();

        assert_eq!(token.name(), "Test USDC");
        assert_eq!(token.symbol(), "tUSDC");
        assert_eq!(token.decimals(), 6);
    }

    #[test]
    fn test_mint() {
        let (env, mut token) = setup();

        let recipient = env.get_account(1);
        let amount = U256::from(5000u64);

        let balance_before = token.balance_of(&recipient);
        token.mint(&recipient, &amount);
        let balance_after = token.balance_of(&recipient);

        assert_eq!(balance_after - balance_before, amount);
    }

    #[test]
    fn test_transfer() {
        let (env, mut token) = setup();

        let sender = env.get_account(0);
        let recipient = env.get_account(1);
        let amount = U256::from(1000u64);

        // Deployer has initial supply, transfer some
        env.set_caller(sender);
        token.transfer(&recipient, &amount);

        assert_eq!(token.balance_of(&recipient), amount);
    }

    #[test]
    fn test_approve_and_transfer_from() {
        let (env, mut token) = setup();

        let owner = env.get_account(0);
        let spender = env.get_account(1);
        let recipient = env.get_account(2);
        let amount = U256::from(500u64);

        // Owner approves spender
        env.set_caller(owner);
        token.approve(&spender, &amount);

        assert_eq!(token.allowance(&owner, &spender), amount);

        // Spender transfers from owner to recipient
        env.set_caller(spender);
        token.transfer_from(&owner, &recipient, &amount);

        assert_eq!(token.balance_of(&recipient), amount);
    }
}
