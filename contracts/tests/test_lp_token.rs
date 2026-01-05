//! Tests for LP Token contract

use odra::casper_types::U256;
use odra::host::{Deployer, HostRef};
use odra::prelude::*;

use ghost_pool::lp_token::{LpToken, LpTokenInitArgs};

#[cfg(test)]
mod lp_token_tests {
    use super::*;

    fn setup() -> (odra::host::HostEnv, ghost_pool::lp_token::LpTokenHostRef) {
        let env = odra_test::env();

        let lp_token = LpToken::deploy(
            &env,
            LpTokenInitArgs {
                name: "Ghost Pool LP".to_string(),
                symbol: "GP-LP".to_string(),
                decimals: 9,
            },
        );

        (env, lp_token)
    }

    #[test]
    fn test_initial_state() {
        let (_env, lp_token) = setup();

        assert_eq!(lp_token.name(), "Ghost Pool LP");
        assert_eq!(lp_token.symbol(), "GP-LP");
        assert_eq!(lp_token.decimals(), 9);
        assert_eq!(lp_token.total_supply(), odra::casper_types::U512::zero());
    }

    #[test]
    fn test_pool_can_mint() {
        let (env, mut lp_token) = setup();

        let recipient = env.get_account(1);
        let amount = odra::casper_types::U512::from(1000u64);

        // Pool (deployer) can mint
        lp_token.mint(&recipient, amount);

        assert_eq!(lp_token.balance_of(&recipient), amount);
        assert_eq!(lp_token.total_supply(), amount);
    }

    #[test]
    fn test_pool_can_burn() {
        let (env, mut lp_token) = setup();

        let recipient = env.get_account(1);
        let amount = odra::casper_types::U512::from(1000u64);

        // Mint first
        lp_token.mint(&recipient, amount);
        assert_eq!(lp_token.balance_of(&recipient), amount);

        // Then burn
        let burn_amount = odra::casper_types::U512::from(400u64);
        lp_token.burn(&recipient, burn_amount);

        let expected = amount - burn_amount;
        assert_eq!(lp_token.balance_of(&recipient), expected);
    }

    #[test]
    fn test_transfer() {
        let (env, mut lp_token) = setup();

        let user1 = env.get_account(1);
        let user2 = env.get_account(2);
        let amount = odra::casper_types::U512::from(1000u64);

        // Mint to user1
        lp_token.mint(&user1, amount);

        // User1 transfers to user2
        env.set_caller(user1);
        lp_token.transfer(&user2, &U256::from(500u64));

        assert_eq!(
            lp_token.balance_of(&user1),
            odra::casper_types::U512::from(500u64)
        );
        assert_eq!(
            lp_token.balance_of(&user2),
            odra::casper_types::U512::from(500u64)
        );
    }
}
