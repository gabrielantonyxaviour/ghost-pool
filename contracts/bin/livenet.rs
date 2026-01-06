//! Livenet deployment script for Ghost Pool contracts
//!
//! Deploys TestToken and GhostPoolPool to Casper testnet.
//!
//! Usage:
//!   cargo run --bin ghost_pool_livenet --features livenet

use odra::casper_types::{AsymmetricType, PublicKey, U256};
use odra::host::Deployer;
use odra::prelude::Addressable;

use ghost_pool::pool::{GhostPoolPool, GhostPoolPoolInitArgs};
use ghost_pool::test_token::{TestToken, TestTokenInitArgs};

// Configuration
const TOKEN_NAME: &str = "Ghost Token";
const TOKEN_SYMBOL: &str = "GHOST";
const TOKEN_DECIMALS: u8 = 9;
const INITIAL_SUPPLY: u128 = 1_000_000_000_000_000_000; // 1 billion with 9 decimals

// Testnet validator public key
const VALIDATOR_PUBLIC_KEY: &str = "01297ad899f55d524ba3fa452a7427fd06c4ab2f34573c057a85312fc425ce4b55";

fn main() {
    println!("=== Ghost Pool Livenet Deployment ===\n");

    // Load the Casper livenet environment
    let env = odra_casper_livenet_env::env();

    // Get deployer account (from secret key in Odra.toml)
    let deployer = env.caller();
    println!("Deployer account: {:?}", deployer);

    // Step 1: Deploy TestToken
    println!("\n[1/2] Deploying TestToken...");
    let token_init_args = TestTokenInitArgs {
        name: TOKEN_NAME.to_string(),
        symbol: TOKEN_SYMBOL.to_string(),
        decimals: TOKEN_DECIMALS,
        initial_supply: U256::from(INITIAL_SUPPLY),
    };

    env.set_gas(500_000_000_000u64); // 500 CSPR gas
    let token = TestToken::deploy(&env, token_init_args);
    let token_address = token.address();
    println!("TestToken deployed at: {:?}", token_address);

    // Step 2: Deploy GhostPoolPool
    println!("\n[2/2] Deploying GhostPoolPool...");
    let validator = PublicKey::from_hex(VALIDATOR_PUBLIC_KEY)
        .expect("Invalid validator public key");

    let pool_init_args = GhostPoolPoolInitArgs {
        token_address: token_address.clone(),
        validator,
        treasury: deployer.clone(),
        admin: deployer.clone(),
    };

    env.set_gas(700_000_000_000u64); // 700 CSPR gas
    let pool = GhostPoolPool::deploy(&env, pool_init_args);
    let pool_address = pool.address();
    println!("GhostPoolPool deployed at: {:?}", pool_address);

    // Summary
    println!("\n=== Deployment Complete ===");
    println!("Token Contract: {:?}", token_address);
    println!("Pool Contract:  {:?}", pool_address);
    println!("\nUpdate frontend/src/lib/constants.ts with these addresses!");
}
