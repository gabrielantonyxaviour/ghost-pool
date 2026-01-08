/**
 * Contract constants for Ghost Pool
 */

// Network configuration
export const NETWORK_NAME = "casper-test"; // Use "casper" for mainnet
export const RPC_URL = "https://node.testnet.casper.network/rpc";

// Contract addresses (deployed to testnet)
export const POOL_CONTRACT_HASH = "hash-b9e4385566b6e6cfc25ac29edcc14bd6d2968ec047144264d05eea864f25c87f";
export const TOKEN_CONTRACT_HASH = "hash-033e62f413c6fd5edf91f5977e8ddd576b0b8f7a4d230955dce3d04feed195a3";

// Gas costs in motes (1 CSPR = 1e9 motes)
export const GAS_COSTS = {
  ADD_LIQUIDITY: "5000000000", // 5 CSPR
  REMOVE_LIQUIDITY: "5000000000", // 5 CSPR
  CLAIM_WITHDRAWAL: "2000000000", // 2 CSPR
  SWAP: "3000000000", // 3 CSPR
  COMPOUND: "3000000000", // 3 CSPR
  APPROVE: "1000000000", // 1 CSPR
  TRANSFER: "1000000000", // 1 CSPR
} as const;

// Conversion helpers
export const MOTES_PER_CSPR = BigInt(1_000_000_000);

export function csprToMotes(cspr: number | string): bigint {
  const csprNum = typeof cspr === "string" ? parseFloat(cspr) : cspr;
  return BigInt(Math.floor(csprNum * 1_000_000_000));
}

export function motesToCspr(motes: bigint): number {
  return Number(motes) / 1_000_000_000;
}

// Pool configuration defaults (matching contract)
export const DEFAULT_BUFFER_TARGET_BPS = 1000; // 10%
export const DEFAULT_SWAP_FEE_BPS = 30; // 0.3%
export const DEFAULT_PROTOCOL_FEE_BPS = 1000; // 10%

// Unbonding period (14 hours in milliseconds)
export const UNBONDING_PERIOD_MS = 14 * 60 * 60 * 1000;
