"use client";

/**
 * Hook for fetching and aggregating pool statistics
 * Provides TVL, reserves, staking info, and APY calculations
 */

import { useState, useEffect, useCallback } from "react";
import { poolClient } from "@/lib/pool-client";
import { motesToCspr, DEFAULT_BUFFER_TARGET_BPS } from "@/lib/constants";

export interface PoolStats {
  // Reserves
  reserveCspr: bigint;
  reserveToken: bigint;

  // Staking
  stakedCspr: bigint;
  bufferCspr: bigint;

  // LP
  totalLpSupply: bigint;

  // Calculated values
  exchangeRate: number; // Token per CSPR
  tvlCspr: number; // Total value in CSPR
  tvlUsd: number; // Total value in USD

  // APY
  stakingApy: number;
  swapFeeApy: number;
  combinedApy: number;

  // Volume (estimated from recent activity)
  volume24h: bigint;
  pendingRewards: bigint;
}

interface UsePoolStatsReturn {
  stats: PoolStats | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// Polling interval (30 seconds for stats)
const POLL_INTERVAL = 30000;

// Mock CSPR price for USD calculations (replace with oracle in production)
const MOCK_CSPR_PRICE_USD = 0.03;

// Base staking APY for Casper Network
const BASE_STAKING_APY = 9.0;

export function usePoolStats(): UsePoolStatsReturn {
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);

      // Fetch data from contract
      const [reserves, stakingInfo] = await Promise.all([
        poolClient.getReserves(),
        poolClient.getStakingInfo(),
      ]);

      // Calculate exchange rate
      const exchangeRate =
        reserves.reserveCspr > BigInt(0)
          ? Number(reserves.reserveToken) / Number(reserves.reserveCspr)
          : 0;

      // Calculate TVL (2x CSPR reserve since it's a balanced pool)
      const tvlCspr = motesToCspr(reserves.reserveCspr) * 2;
      const tvlUsd = tvlCspr * MOCK_CSPR_PRICE_USD;

      // Calculate APYs
      // Staking APY: 90% of reserves earn base staking APY
      const stakingEfficiency = (100 - DEFAULT_BUFFER_TARGET_BPS / 100) / 100;
      const stakingApy = BASE_STAKING_APY * stakingEfficiency;

      // Swap fee APY: Estimate based on volume (placeholder)
      // In production, track actual swap volume
      const swapFeeApy = 0; // Will be calculated from actual volume

      const combinedApy = stakingApy + swapFeeApy;

      // Placeholder values for volume and rewards
      // In production, track from events or indexer
      const volume24h = BigInt(0);
      const pendingRewards = BigInt(0);
      const totalLpSupply = BigInt(0);

      setStats({
        reserveCspr: reserves.reserveCspr,
        reserveToken: reserves.reserveToken,
        stakedCspr: stakingInfo.stakedCspr,
        bufferCspr: stakingInfo.bufferCspr,
        totalLpSupply,
        exchangeRate,
        tvlCspr,
        tvlUsd,
        stakingApy,
        swapFeeApy,
        combinedApy,
        volume24h,
        pendingRewards,
      });
    } catch (err) {
      console.error("Failed to fetch pool stats:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch pool stats"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchStats();

    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number, decimals: number = 2): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(decimals) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(decimals) + "K";
  }
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format currency with $ sign
 */
export function formatUsd(amount: number): string {
  if (amount >= 1_000_000) {
    return "$" + (amount / 1_000_000).toFixed(2) + "M";
  }
  if (amount >= 1_000) {
    return "$" + (amount / 1_000).toFixed(2) + "K";
  }
  return "$" + amount.toFixed(2);
}

/**
 * Format CSPR amount from bigint
 */
export function formatCspr(motes: bigint, decimals: number = 2): string {
  const cspr = motesToCspr(motes);
  return formatNumber(cspr, decimals) + " CSPR";
}
