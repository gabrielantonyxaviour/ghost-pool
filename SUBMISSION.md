# Ghost Pool

## One Liner

An Automated Market Maker (AMM) that auto-stakes CSPR liquidity via Casper's System Auction, enabling LPs to earn swap fees AND staking rewards simultaneously.

## Key Innovation Domains

- **DeFi / AMM**
- **Liquid Staking**
- **Yield Optimization**
- **Native Staking Integration**

## Detailed Build Description

Ghost Pool is a Uniswap V2-style AMM built specifically for Casper Network 2.0 that introduces a groundbreaking innovation: **automatic staking of CSPR liquidity**.

### The Problem

Traditional AMMs leave CSPR liquidity idle in pools, missing out on Casper's native staking rewards (~9% APY). Liquidity providers must choose between earning swap fees OR staking rewards.

### Our Solution

Ghost Pool eliminates this trade-off by leveraging Casper 2.0's new "Contract Access to Auction" feature, which allows smart contracts to directly interact with the System Auction for staking.

### How It Works

1. **Liquidity Provision**: Users deposit CSPR + paired token (e.g., wUSDC) to provide liquidity
2. **Auto-Staking**: 90% of CSPR reserves are automatically delegated to validators via the System Auction
3. **Buffer Management**: 10% of CSPR is kept unstaked as a buffer for immediate swaps
4. **Dual Rewards**: LPs earn both:
   - Traditional swap fees (0.3% per swap)
   - Staking rewards from delegated CSPR
5. **Reward Compounding**: Anyone can trigger `compound()` to harvest staking rewards and add them to the pool, increasing LP token value
6. **Queued Withdrawals**: Due to Casper's 14-hour unbonding period, liquidity withdrawals are queued with a 14-hour wait time

### Technical Architecture

- **Smart Contracts**: Built with Odra framework (Rust) for Casper Network
- **LP Tokens**: CEP-18 standard tokens representing pool share + accumulated rewards
- **Constant Product Formula**: x * y = k pricing model (Uniswap V2 style)
- **Frontend**: Next.js application for user interaction

### Key Features

| Feature | Description |
|---------|-------------|
| Single Pool Model | CSPR paired with any CEP-18 token |
| Auto-Staking | 90% of CSPR automatically delegated |
| Dual Yield | Swap fees (~10% APY) + Staking (~3.6% APY) = ~13.6% combined |
| LP Tokens | CEP-18 tokens that appreciate as rewards compound |
| Queued Withdrawals | 14-hour unbonding for CSPR withdrawals |

### Why Ghost Pool?

The name "Ghost Pool" reflects how liquidity works invisibly in the background - your CSPR is simultaneously providing swap liquidity AND earning staking rewards, like a ghost doing double duty.

## Team

### Joel
Full-stack blockchain developer with expertise in smart contract development and DeFi protocols. Passionate about building innovative financial infrastructure on next-generation blockchain networks.

### Gabriel
Blockchain engineer specializing in Rust-based smart contracts and decentralized application architecture. Focused on creating seamless user experiences for complex DeFi interactions.

## Technology Stack Used

- [x] Odra Framework
- [ ] Native Casper Rust SDK
- [ ] CSPR.click
- [ ] CSPR.cloud
- [x] JavaScript/TypeScript SDK
- [ ] Python SDK
- [ ] Other
