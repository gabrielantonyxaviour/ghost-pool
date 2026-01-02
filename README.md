# Ghost Pool AMM

An AMM (Uniswap V2 style) for Casper Network 2.0 where CSPR liquidity is auto-staked via System Auction, allowing LPs to earn swap fees + staking rewards.

## Project Structure

```
ghost-pool/
├── contracts/          # Odra smart contracts (Rust)
│   ├── src/
│   │   ├── lib.rs
│   │   ├── pool.rs
│   │   ├── lp_token.rs
│   │   ├── types.rs
│   │   └── events.rs
│   └── tests/
├── frontend/           # Next.js frontend
│   └── ...
└── README.md
```

## Getting Started

### Prerequisites

- Rust (latest stable)
- Cargo odra (`cargo install cargo-odra`)
- Node.js 18+
- pnpm

### Contracts

```bash
cd contracts
cargo odra build
cargo odra test
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

## Architecture

- **Single pool (CSPR/Token)** with constant product formula (x * y = k)
- **90% CSPR staked** via Casper 2.0 Contract Access to Auction
- **10% buffer** for immediate swaps
- **14h unbonding** for withdrawals requiring unstaked CSPR

## License

MIT
