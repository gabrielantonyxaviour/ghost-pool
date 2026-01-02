# Ghost Pool AMM - Technical Specification
## Claude Code Implementation Guide

**Target:** Casper Network 2.0 Testnet  
**Framework:** Odra (Rust)  
**Track:** Main Track ($10K/$7K/$3K)  

---

## 1. What We're Building

An AMM (Uniswap V2 style) where:
1. CSPR portion of liquidity is auto-staked via System Auction
2. LPs earn swap fees + staking rewards (~2x traditional AMM yield)
3. Constant product formula: x * y = k
4. LP tokens represent share of pool + accumulated rewards

**Core Innovation:** Only AMM that uses Casper 2.0's Contract Access to Auction for native staking within the pool.

---

## 2. MVP Scope (Build This Only)

| Feature | Include | Exclude |
|---------|---------|---------|
| Single pool (CSPR/Token) | ✅ | Multi-pool factory |
| Add liquidity | ✅ | |
| Remove liquidity (queued) | ✅ | Instant withdrawal |
| Swap both directions | ✅ | |
| LP token (CEP-18) | ✅ | |
| Auto-stake CSPR | ✅ | |
| Compound rewards | ✅ | |
| 10% buffer (unstaked) | ✅ | Dynamic buffer |
| Single validator | ✅ | Multi-validator |

**CRITICAL SIMPLIFICATION:**
For MVP, skip instant swaps requiring unstaked CSPR. If buffer depleted, Token→CSPR swaps fail. This avoids complex unbonding logic.

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    STAKESWAP POOL                              │
│                                                                │
│  ┌─────────────────────┐      ┌─────────────────────┐          │
│  │    CSPR RESERVE     │      │   TOKEN RESERVE     │          │
│  │                     │      │   (e.g., wUSDC)     │          │
│  │  Total: 1000 CSPR   │      │                     │          │
│  │  ├─ Staked: 900     │      │   1000 wUSDC        │          │
│  │  └─ Buffer: 100     │      │                     │          │
│  │                     │      │                     │          │
│  │  (90% staked via    │      │   (standard         │          │
│  │   System Auction)   │      │    reserve)         │          │
│  │                     │      │                     │          │
│  └─────────────────────┘      └─────────────────────┘          │
│             │                           │                      │
│             └───────────┬───────────────┘                      │
│                         │                                      │
│                         ▼                                      │
│              ┌────────────────────┐                            │
│              │  x * y = k         │                            │
│              │  (constant product)│                            │
│              └────────────────────┘                            │
│                         │                                      │
│                         ▼                                      │
│              ┌────────────────────┐                            │
│              │    LP TOKEN        │                            │
│              │    (CEP-18)        │                            │
│              │                    │                            │
│              │  Represents:       │                            │
│              │  - Pool share      │                            │
│              │  - Staking rewards │                            │
│              └────────────────────┘                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Structures

```rust
// types.rs
use odra::prelude::*;
use odra::casper_types::{U512, U256, PublicKey};

#[odra::odra_type]
pub struct PoolState {
    // Reserves
    pub reserve_cspr: U512,        // Total CSPR (staked + buffer)
    pub reserve_token: U512,       // Total paired token
    
    // Staking breakdown
    pub staked_cspr: U512,         // CSPR delegated via auction
    pub buffer_cspr: U512,         // Unstaked CSPR for immediate swaps
    
    // Constants
    pub buffer_target_bps: U256,   // Target buffer % (1000 = 10%)
    pub swap_fee_bps: U256,        // Swap fee (30 = 0.3%)
    pub protocol_fee_bps: U256,    // Protocol fee on staking rewards
}

#[odra::odra_type]
pub struct WithdrawalRequest {
    pub id: u64,
    pub user: Address,
    pub lp_burned: U512,
    pub cspr_amount: U512,
    pub token_amount: U512,
    pub request_time: u64,
    pub claimable_time: u64,       // +14 hours
    pub claimed: bool,
}
```

---

## 5. Pool Contract

```rust
// ghostpool_pool.rs
use odra::{prelude::*, Var, Mapping, Address, SubModule};
use odra::casper_types::{U512, U256, PublicKey, ContractHash, runtime_args};

#[odra::module]
pub struct Ghost PoolPool {
    // Token addresses
    token_address: Var<Address>,        // Paired CEP-18 token
    lp_token: SubModule<LpToken>,       // LP token (internal)
    
    // Reserves
    reserve_cspr: Var<U512>,
    reserve_token: Var<U512>,
    
    // Staking
    staked_cspr: Var<U512>,
    buffer_cspr: Var<U512>,
    validator: Var<PublicKey>,
    
    // Config
    buffer_target_bps: Var<U256>,       // 1000 = 10%
    swap_fee_bps: Var<U256>,            // 30 = 0.3%
    protocol_fee_bps: Var<U256>,        // 1000 = 10% of staking rewards
    treasury: Var<Address>,
    
    // Withdrawals
    withdrawal_counter: Var<u64>,
    withdrawals: Mapping<u64, WithdrawalRequest>,
    user_withdrawals: Mapping<Address, Vec<u64>>,
    
    // Admin
    admin: Var<Address>,
    
    // Constants
    minimum_liquidity: Var<U512>,       // Locked on first deposit
}

// Minimum liquidity locked forever to prevent division by zero
const MINIMUM_LIQUIDITY: u64 = 1000;

#[odra::module]
impl Ghost PoolPool {
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
        
        self.buffer_target_bps.set(U256::from(1000));   // 10%
        self.swap_fee_bps.set(U256::from(30));         // 0.3%
        self.protocol_fee_bps.set(U256::from(1000));   // 10%
        
        self.minimum_liquidity.set(U512::from(MINIMUM_LIQUIDITY));
        self.withdrawal_counter.set(0);
        
        // Initialize LP token
        self.lp_token.init(
            "Ghost Pool LP".to_string(),
            "SS-LP".to_string(),
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
        
        require!(cspr_amount > U512::zero(), "Must send CSPR");
        require!(token_amount > U512::zero(), "Must send tokens");
        
        let reserve_cspr = self.reserve_cspr.get_or_default();
        let reserve_token = self.reserve_token.get_or_default();
        let total_lp = self.lp_token.total_supply();
        
        let lp_to_mint: U512;
        
        if total_lp == U512::zero() {
            // First deposit - use geometric mean
            // lp = sqrt(cspr * token) - MINIMUM_LIQUIDITY
            let product = cspr_amount * token_amount;
            let sqrt_product = self.sqrt(product);
            let min_liq = self.minimum_liquidity.get_or_default();
            
            require!(sqrt_product > min_liq, "Initial liquidity too low");
            
            lp_to_mint = sqrt_product - min_liq;
            
            // Lock minimum liquidity forever (mint to zero address)
            self.lp_token.mint(Address::zero(), min_liq);
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
        
        require!(lp_to_mint >= min_lp_tokens, "Slippage too high");
        
        // Transfer tokens from user
        self.transfer_token_from(caller, self.env().self_address(), token_amount);
        
        // Update reserves
        let new_reserve_cspr = reserve_cspr + cspr_amount;
        let new_reserve_token = reserve_token + token_amount;
        self.reserve_cspr.set(new_reserve_cspr);
        self.reserve_token.set(new_reserve_token);
        
        // Update buffer and stake new CSPR
        let new_buffer = self.buffer_cspr.get_or_default() + cspr_amount;
        self.buffer_cspr.set(new_buffer);
        self.rebalance_stake();
        
        // Mint LP tokens
        self.lp_token.mint(caller, lp_to_mint);
        
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
        
        let lp_balance = self.lp_token.balance_of(caller);
        require!(lp_amount <= lp_balance, "Insufficient LP balance");
        require!(lp_amount > U512::zero(), "Amount must be > 0");
        
        let total_lp = self.lp_token.total_supply();
        let reserve_cspr = self.reserve_cspr.get_or_default();
        let reserve_token = self.reserve_token.get_or_default();
        
        // Calculate share of reserves
        let cspr_amount = (lp_amount * reserve_cspr) / total_lp;
        let token_amount = (lp_amount * reserve_token) / total_lp;
        
        require!(cspr_amount >= min_cspr, "CSPR slippage");
        require!(token_amount >= min_token, "Token slippage");
        
        // Burn LP tokens
        self.lp_token.burn(caller, lp_amount);
        
        // Update reserves
        self.reserve_cspr.set(reserve_cspr - cspr_amount);
        self.reserve_token.set(reserve_token - token_amount);
        
        // Transfer tokens immediately
        self.transfer_token(caller, token_amount);
        
        // Queue CSPR withdrawal (need to undelegate)
        self.undelegate_for_withdrawal(cspr_amount);
        
        let withdrawal_id = self.withdrawal_counter.get_or_default();
        self.withdrawal_counter.set(withdrawal_id + 1);
        
        let now = self.env().get_block_time();
        let claimable = now + (14 * 60 * 60 * 1000); // 14 hours in ms
        
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

    /// Claim CSPR after unbonding
    pub fn claim_withdrawal(&mut self, withdrawal_id: u64) -> U512 {
        let caller = self.env().caller();
        
        let mut request = self.withdrawals.get(&withdrawal_id)
            .expect("Withdrawal not found");
        
        require!(request.user == caller, "Not your withdrawal");
        require!(!request.claimed, "Already claimed");
        require!(
            self.env().get_block_time() >= request.claimable_time,
            "Still unbonding"
        );
        
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
        
        require!(cspr_in > U512::zero(), "Must send CSPR");
        
        let reserve_cspr = self.reserve_cspr.get_or_default();
        let reserve_token = self.reserve_token.get_or_default();
        
        // Calculate output with fee
        let token_out = self.get_amount_out(cspr_in, reserve_cspr, reserve_token);
        
        require!(token_out >= min_token_out, "Slippage exceeded");
        require!(token_out < reserve_token, "Insufficient liquidity");
        
        // Update reserves
        self.reserve_cspr.set(reserve_cspr + cspr_in);
        self.reserve_token.set(reserve_token - token_out);
        
        // Add CSPR to buffer, then rebalance
        let new_buffer = self.buffer_cspr.get_or_default() + cspr_in;
        self.buffer_cspr.set(new_buffer);
        self.rebalance_stake();
        
        // Transfer tokens to user
        self.transfer_token(caller, token_out);
        
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
        
        require!(token_in > U512::zero(), "Must send tokens");
        
        let reserve_cspr = self.reserve_cspr.get_or_default();
        let reserve_token = self.reserve_token.get_or_default();
        
        // Calculate output with fee
        let cspr_out = self.get_amount_out(token_in, reserve_token, reserve_cspr);
        
        require!(cspr_out >= min_cspr_out, "Slippage exceeded");
        
        // ⚠️ CRITICAL: Check buffer has enough CSPR
        let buffer = self.buffer_cspr.get_or_default();
        require!(cspr_out <= buffer, "Insufficient buffer - try smaller amount");
        
        // Transfer tokens from user
        self.transfer_token_from(caller, self.env().self_address(), token_in);
        
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
        let fee_bps = self.protocol_fee_bps.get_or_default();
        let protocol_fee = (rewards * U512::from(fee_bps.as_u64())) / U512::from(10000u64);
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

    pub fn get_reserves(&self) -> (U512, U512) {
        (
            self.reserve_cspr.get_or_default(),
            self.reserve_token.get_or_default(),
        )
    }

    pub fn get_staking_info(&self) -> (U512, U512) {
        (
            self.staked_cspr.get_or_default(),
            self.buffer_cspr.get_or_default(),
        )
    }

    /// Quote swap output
    pub fn quote_cspr_for_token(&self, cspr_in: U512) -> U512 {
        let (reserve_cspr, reserve_token) = self.get_reserves();
        self.get_amount_out(cspr_in, reserve_cspr, reserve_token)
    }

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

    pub fn get_user_withdrawals(&self, user: Address) -> Vec<WithdrawalRequest> {
        let ids = self.user_withdrawals.get(&user).unwrap_or_default();
        ids.iter()
            .filter_map(|id| self.withdrawals.get(id))
            .collect()
    }

    // ============ INTERNAL FUNCTIONS ============

    /// Constant product formula with fee
    fn get_amount_out(&self, amount_in: U512, reserve_in: U512, reserve_out: U512) -> U512 {
        require!(amount_in > U512::zero(), "Invalid input");
        require!(reserve_in > U512::zero() && reserve_out > U512::zero(), "No liquidity");
        
        let fee_bps = self.swap_fee_bps.get_or_default();
        
        // amount_in_with_fee = amount_in * (10000 - fee) / 10000
        let fee_multiplier = U512::from(10000u64) - U512::from(fee_bps.as_u64());
        let amount_in_with_fee = (amount_in * fee_multiplier) / U512::from(10000u64);
        
        // output = (amount_in_with_fee * reserve_out) / (reserve_in + amount_in_with_fee)
        let numerator = amount_in_with_fee * reserve_out;
        let denominator = reserve_in + amount_in_with_fee;
        
        numerator / denominator
    }

    /// Rebalance between staked and buffer
    fn rebalance_stake(&mut self) {
        let reserve_cspr = self.reserve_cspr.get_or_default();
        let buffer_target_bps = self.buffer_target_bps.get_or_default();
        
        // Target buffer = reserve * buffer_target_bps / 10000
        let target_buffer = (reserve_cspr * U512::from(buffer_target_bps.as_u64())) 
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
            let from_buffer = buffer;
            let from_staked = amount - buffer;
            
            self.buffer_cspr.set(U512::zero());
            self.staked_cspr.set(staked - from_staked);
            
            // Undelegate from auction
            self.undelegate_from_validator(from_staked);
        }
    }

    // ============ SYSTEM AUCTION CALLS ============

    fn delegate_to_validator(&self, amount: U512) {
        if amount == U512::zero() {
            return;
        }
        
        let validator = self.validator.get().expect("Validator not set");
        let auction_hash = self.get_auction_hash();
        
        runtime::call_contract::<()>(
            auction_hash,
            "delegate",
            runtime_args! {
                "delegator" => self.env().self_address(),
                "validator" => validator,
                "amount" => amount,
            },
        );
    }

    fn undelegate_from_validator(&self, amount: U512) {
        if amount == U512::zero() {
            return;
        }
        
        let validator = self.validator.get().expect("Validator not set");
        let auction_hash = self.get_auction_hash();
        
        runtime::call_contract::<()>(
            auction_hash,
            "undelegate",
            runtime_args! {
                "delegator" => self.env().self_address(),
                "validator" => validator,
                "amount" => amount,
            },
        );
    }

    fn get_pending_rewards(&self) -> U512 {
        let validator = self.validator.get().expect("Validator not set");
        let auction_hash = self.get_auction_hash();
        
        runtime::call_contract::<U512>(
            auction_hash,
            "get_delegator_reward",
            runtime_args! {
                "delegator" => self.env().self_address(),
                "validator" => validator,
            },
        )
    }

    fn withdraw_staking_rewards(&self) {
        let validator = self.validator.get().expect("Validator not set");
        let auction_hash = self.get_auction_hash();
        
        runtime::call_contract::<()>(
            auction_hash,
            "withdraw_delegator_reward",
            runtime_args! {
                "delegator" => self.env().self_address(),
                "validator" => validator,
            },
        );
    }

    fn get_auction_hash(&self) -> ContractHash {
        // TESTNET hash - verify before deployment
        ContractHash::from_formatted_str(
            "hash-93d923e336b20a4c4ca14d592b60e5bd3fe330775618290104f9beb326db7ae2"
        ).expect("Invalid auction hash")
    }

    // ============ HELPERS ============

    fn transfer_token(&self, to: Address, amount: U512) {
        let token = self.token_address.get().expect("Token not set");
        // Call CEP-18 transfer
        runtime::call_contract::<()>(
            token.into(),
            "transfer",
            runtime_args! {
                "recipient" => to,
                "amount" => U256::from(amount.as_u128()),
            },
        );
    }

    fn transfer_token_from(&self, from: Address, to: Address, amount: U512) {
        let token = self.token_address.get().expect("Token not set");
        // Call CEP-18 transfer_from
        runtime::call_contract::<()>(
            token.into(),
            "transfer_from",
            runtime_args! {
                "owner" => from,
                "recipient" => to,
                "amount" => U256::from(amount.as_u128()),
            },
        );
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
```

---

## 6. Events

```rust
#[odra::event]
pub struct LiquidityAdded {
    pub provider: Address,
    pub cspr_amount: U512,
    pub token_amount: U512,
    pub lp_minted: U512,
}

#[odra::event]
pub struct LiquidityRemoved {
    pub provider: Address,
    pub lp_burned: U512,
    pub cspr_amount: U512,
    pub token_amount: U512,
    pub withdrawal_id: u64,
}

#[odra::event]
pub struct WithdrawalClaimed {
    pub user: Address,
    pub withdrawal_id: u64,
    pub cspr_amount: U512,
}

#[odra::event]
pub struct Swap {
    pub sender: Address,
    pub cspr_in: U512,
    pub cspr_out: U512,
    pub token_in: U512,
    pub token_out: U512,
}

#[odra::event]
pub struct Compounded {
    pub rewards_harvested: U512,
    pub protocol_fee: U512,
    pub rewards_to_pool: U512,
}
```

---

## 7. LP Token

```rust
// lp_token.rs
use odra::prelude::*;
use odra_modules::cep18::Cep18;

#[odra::module]
pub struct LpToken {
    cep18: SubModule<Cep18>,
    pool: Var<Address>,
}

#[odra::module]
impl LpToken {
    pub fn init(&mut self, name: String, symbol: String, decimals: u8) {
        self.cep18.init(name, symbol, decimals, U256::zero());
        self.pool.set(self.env().caller());  // Pool contract
    }

    pub fn mint(&mut self, to: Address, amount: U512) {
        self.require_pool();
        self.cep18.mint(&to, &U256::from(amount.as_u128()));
    }

    pub fn burn(&mut self, from: Address, amount: U512) {
        self.require_pool();
        self.cep18.burn(&from, &U256::from(amount.as_u128()));
    }

    pub fn total_supply(&self) -> U512 {
        U512::from(self.cep18.total_supply().as_u128())
    }

    pub fn balance_of(&self, owner: Address) -> U512 {
        U512::from(self.cep18.balance_of(&owner).as_u128())
    }

    // Standard CEP-18 passthrough
    pub fn transfer(&mut self, to: Address, amount: U256) {
        self.cep18.transfer(&to, &amount);
    }

    fn require_pool(&self) {
        require!(
            self.env().caller() == self.pool.get().expect("Pool not set"),
            "Not pool"
        );
    }
}
```

---

## 8. Critical Implementation Notes

### 8.1 Buffer Management

**⚠️ MVP SIMPLIFICATION:**

Token→CSPR swaps are LIMITED by buffer. If buffer is 100 CSPR and user wants 150 CSPR, swap FAILS.

This avoids complexity of:
- Queueing swap requests
- Partial fills
- Dynamic unbonding

**For production:** Implement instant liquidity pool or swap queuing.

### 8.2 First Deposit Edge Case

First deposit uses geometric mean to set initial price:
```
lp_minted = sqrt(cspr_amount * token_amount) - MINIMUM_LIQUIDITY
```

The `MINIMUM_LIQUIDITY` (1000) is permanently locked to prevent manipulation.

### 8.3 Withdrawal Flow

1. User calls `remove_liquidity(lp_amount, ...)`
2. LP tokens burned immediately
3. Paired tokens transferred immediately
4. CSPR queued for 14h unbonding
5. User calls `claim_withdrawal(id)` after 14h
6. CSPR transferred

### 8.4 Compound Economics

```
Staking APY: ~9%
Pool staked: 90% of CSPR
Protocol fee: 10% of rewards

Effective staking APY to LPs:
= 9% × 90% × 90% × 50%  (50% because only CSPR earns)
= 3.6% additional APY on total TVL

Total APY = Swap fees (~10%) + Staking (~3.6%) = ~13.6%
```

---

## 9. Test Scenarios

### Add Liquidity:

| Test | Input | Expected |
|------|-------|----------|
| First deposit | 1000 CSPR + 1000 Token | ~1000 LP (minus min) |
| Balanced deposit | Proportional amounts | LP proportional to share |
| Imbalanced deposit | Different ratio | LP based on smaller ratio |
| Zero amount | 0 CSPR | Revert |

### Swap:

| Test | Input | Expected |
|------|-------|----------|
| CSPR→Token | 100 CSPR | ~99.7 Token (after fee) |
| Token→CSPR (buffer OK) | 100 Token | ~99.7 CSPR |
| Token→CSPR (buffer low) | 1000 Token (buffer=100) | Revert |
| Slippage exceeded | High min_out | Revert |

### Remove Liquidity:

| Test | Input | Expected |
|------|-------|----------|
| Remove 50% | Half LP | Half reserves + withdrawal queue |
| Remove all | All LP | All reserves + withdrawal queue |
| Claim before 14h | Early | Revert |
| Claim after 14h | After wait | Success |

---

## 10. Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `MINIMUM_LIQUIDITY` | 1000 | Locked on first deposit |
| `buffer_target_bps` | 1000 (10%) | Target unstaked buffer |
| `swap_fee_bps` | 30 (0.3%) | Swap fee |
| `protocol_fee_bps` | 1000 (10%) | Fee on staking rewards |

---

## 11. Frontend Integration

```typescript
// Add liquidity
await pool.add_liquidity(
  tokenAmount,
  minLpTokens,
  { paymentAmount: csprAmount }
);

// Swap CSPR for Token
const tokenOut = await pool.swap_cspr_for_token(
  minTokenOut,
  { paymentAmount: csprIn }
);

// Swap Token for CSPR (must approve first)
await token.approve(poolAddress, tokenIn);
const csprOut = await pool.swap_token_for_cspr(tokenIn, minCsprOut);

// Get quotes
const quote = await pool.quote_cspr_for_token(csprAmount);

// Get LP value
const [csprValue, tokenValue] = await pool.get_lp_value(lpAmount);

// Compound (anyone can call)
await pool.compound();
```

---

## 12. Paired Token for Testing

You'll need a CEP-18 token to pair with CSPR. Options:

1. **Deploy test token:**
```rust
// Use odra_modules::cep18::Cep18
// Deploy with initial supply to test accounts
```

2. **Use existing testnet token:**
- Check Casper testnet for available CEP-18 tokens
- wUSDC or similar wrapped stablecoin if available

---

## 13. Known Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| Buffer limits swaps | Large Token→CSPR may fail | Split into smaller swaps |
| 14h withdrawal | Users wait for CSPR | Clear UI about timing |
| Single validator | Concentration risk | Add multi-validator later |
| No flash loans | Limited composability | MVP simplification |
| No price oracle | Manipulation possible | Add TWAP later |

---

**BUILD ORDER:**
1. LP Token (simple CEP-18)
2. Pool reserves + add_liquidity
3. Swap functions (no staking)
4. Add staking integration
5. Add compound
6. Add remove_liquidity + withdrawals
7. Connect to test token

**Test each step before moving to next.**
