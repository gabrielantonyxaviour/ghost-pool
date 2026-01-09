"use client";

/**
 * Hook for interacting with the Ghost Pool AMM contract
 */

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "casper-js-sdk";
import { PoolClient, poolClient, WithdrawalRequest } from "@/lib/pool-client";
import { TokenClient, tokenClient } from "@/lib/token-client";
import { POOL_CONTRACT_HASH } from "@/lib/constants";

export interface PoolState {
  reserveCspr: bigint;
  reserveToken: bigint;
  stakedCspr: bigint;
  bufferCspr: bigint;
}

export interface UsePoolReturn {
  // State
  poolState: PoolState | null;
  isLoading: boolean;
  error: Error | null;
  withdrawals: WithdrawalRequest[];

  // Actions - return unsigned deploys for wallet signing
  addLiquidity: (
    senderPubKey: PublicKey,
    csprAmount: bigint,
    tokenAmount: bigint,
    minLp: bigint
  ) => unknown;
  removeLiquidity: (
    senderPubKey: PublicKey,
    lpAmount: bigint,
    minCspr: bigint,
    minToken: bigint
  ) => unknown;
  claimWithdrawal: (
    senderPubKey: PublicKey,
    withdrawalId: number
  ) => unknown;
  swapCsprForToken: (
    senderPubKey: PublicKey,
    csprAmount: bigint,
    minTokenOut: bigint
  ) => unknown;
  swapTokenForCspr: (
    senderPubKey: PublicKey,
    tokenAmount: bigint,
    minCsprOut: bigint
  ) => unknown;
  compound: (senderPubKey: PublicKey) => unknown;

  // Token approval (required before add liquidity or swap token->CSPR)
  approveToken: (
    senderPubKey: PublicKey,
    amount: bigint
  ) => unknown;

  // Quotes (use current reserves)
  quoteCsprForToken: (csprIn: bigint) => bigint;
  quoteTokenForCspr: (tokenIn: bigint) => bigint;

  // Refresh
  refreshPoolState: () => Promise<void>;
}

// Polling interval for reserve updates (10 seconds)
const POLL_INTERVAL = 10000;

export function usePool(): UsePoolReturn {
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch pool state from contract
  const fetchPoolState = useCallback(async () => {
    try {
      setError(null);

      const [reserves, stakingInfo] = await Promise.all([
        poolClient.getReserves(),
        poolClient.getStakingInfo(),
      ]);

      setPoolState({
        reserveCspr: reserves.reserveCspr,
        reserveToken: reserves.reserveToken,
        stakedCspr: stakingInfo.stakedCspr,
        bufferCspr: stakingInfo.bufferCspr,
      });
    } catch (err) {
      console.error("Failed to fetch pool state:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch pool state"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchPoolState();

    const interval = setInterval(fetchPoolState, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPoolState]);

  // Quote functions using current reserves
  const quoteCsprForToken = useCallback(
    (csprIn: bigint): bigint => {
      if (!poolState) return BigInt(0);
      return getAmountOut(csprIn, poolState.reserveCspr, poolState.reserveToken);
    },
    [poolState]
  );

  const quoteTokenForCspr = useCallback(
    (tokenIn: bigint): bigint => {
      if (!poolState) return BigInt(0);
      return getAmountOut(tokenIn, poolState.reserveToken, poolState.reserveCspr);
    },
    [poolState]
  );

  // Action functions - return unsigned deploys
  const addLiquidity = useCallback(
    (
      senderPubKey: PublicKey,
      csprAmount: bigint,
      tokenAmount: bigint,
      minLp: bigint
    ): unknown => {
      return poolClient.addLiquidity(senderPubKey, tokenAmount, minLp, csprAmount);
    },
    []
  );

  const removeLiquidity = useCallback(
    (
      senderPubKey: PublicKey,
      lpAmount: bigint,
      minCspr: bigint,
      minToken: bigint
    ): unknown => {
      return poolClient.removeLiquidity(senderPubKey, lpAmount, minCspr, minToken);
    },
    []
  );

  const claimWithdrawal = useCallback(
    (senderPubKey: PublicKey, withdrawalId: number): unknown => {
      return poolClient.claimWithdrawal(senderPubKey, withdrawalId);
    },
    []
  );

  const swapCsprForToken = useCallback(
    (
      senderPubKey: PublicKey,
      csprAmount: bigint,
      minTokenOut: bigint
    ): unknown => {
      return poolClient.swapCsprForToken(senderPubKey, minTokenOut, csprAmount);
    },
    []
  );

  const swapTokenForCspr = useCallback(
    (
      senderPubKey: PublicKey,
      tokenAmount: bigint,
      minCsprOut: bigint
    ): unknown => {
      return poolClient.swapTokenForCspr(senderPubKey, tokenAmount, minCsprOut);
    },
    []
  );

  const compound = useCallback(
    (senderPubKey: PublicKey): unknown => {
      return poolClient.compound(senderPubKey);
    },
    []
  );

  const approveToken = useCallback(
    (senderPubKey: PublicKey, amount: bigint): unknown => {
      return tokenClient.approve(senderPubKey, POOL_CONTRACT_HASH, amount);
    },
    []
  );

  const refreshPoolState = useCallback(async () => {
    setIsLoading(true);
    await fetchPoolState();
  }, [fetchPoolState]);

  return {
    poolState,
    isLoading,
    error,
    withdrawals,

    addLiquidity,
    removeLiquidity,
    claimWithdrawal,
    swapCsprForToken,
    swapTokenForCspr,
    compound,
    approveToken,

    quoteCsprForToken,
    quoteTokenForCspr,

    refreshPoolState,
  };
}

/**
 * Calculate output amount using constant product formula with fee
 * Mirrors the contract's get_amount_out function
 */
function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (amountIn === BigInt(0) || reserveIn === BigInt(0) || reserveOut === BigInt(0)) {
    return BigInt(0);
  }

  // Fee: 0.3% (30 bps)
  const feeMultiplier = BigInt(10000) - BigInt(30);
  const amountInWithFee = (amountIn * feeMultiplier) / BigInt(10000);

  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;

  return numerator / denominator;
}
