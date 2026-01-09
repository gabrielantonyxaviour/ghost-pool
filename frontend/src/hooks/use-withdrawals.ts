"use client";

/**
 * Hook for managing user withdrawal requests
 * Handles fetching, status calculation, and claiming
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { PublicKey } from "casper-js-sdk";
import { poolClient, WithdrawalRequest } from "@/lib/pool-client";
import { UNBONDING_PERIOD_MS } from "@/lib/constants";

export type WithdrawalStatus = "pending" | "ready" | "claimed";

export interface WithdrawalWithStatus extends WithdrawalRequest {
  status: WithdrawalStatus;
  timeRemainingMs: number;
  progress: number; // 0-100
}

export interface UseWithdrawalsReturn {
  withdrawals: WithdrawalWithStatus[];
  pendingWithdrawals: WithdrawalWithStatus[];
  readyWithdrawals: WithdrawalWithStatus[];
  claimedWithdrawals: WithdrawalWithStatus[];
  isLoading: boolean;
  error: Error | null;
  claimWithdrawal: (senderPubKey: PublicKey, withdrawalId: number) => unknown;
  refreshWithdrawals: () => Promise<void>;
}

// Polling interval for withdrawal updates (30 seconds)
const POLL_INTERVAL = 30000;

// Update countdown every second
const COUNTDOWN_INTERVAL = 1000;

export function useWithdrawals(userPublicKey?: string): UseWithdrawalsReturn {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Fetch withdrawals from contract
  const fetchWithdrawals = useCallback(async () => {
    if (!userPublicKey) {
      setWithdrawals([]);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      const userWithdrawals = await poolClient.getUserWithdrawals(userPublicKey);
      setWithdrawals(userWithdrawals);
    } catch (err) {
      console.error("Failed to fetch withdrawals:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch withdrawals"));
    } finally {
      setIsLoading(false);
    }
  }, [userPublicKey]);

  // Initial fetch and polling for withdrawals
  useEffect(() => {
    if (userPublicKey) {
      fetchWithdrawals();
      const interval = setInterval(fetchWithdrawals, POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [userPublicKey, fetchWithdrawals]);

  // Update current time for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, COUNTDOWN_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Calculate status and time remaining for each withdrawal
  const withdrawalsWithStatus = useMemo((): WithdrawalWithStatus[] => {
    return withdrawals.map((withdrawal) => {
      const claimableTimeMs = withdrawal.claimableTime * 1000;
      const requestTimeMs = withdrawal.requestTime * 1000;
      const timeRemainingMs = Math.max(0, claimableTimeMs - currentTime);
      const elapsed = currentTime - requestTimeMs;
      const progress = Math.min(100, Math.max(0, (elapsed / UNBONDING_PERIOD_MS) * 100));

      let status: WithdrawalStatus;
      if (withdrawal.claimed) {
        status = "claimed";
      } else if (timeRemainingMs <= 0) {
        status = "ready";
      } else {
        status = "pending";
      }

      return {
        ...withdrawal,
        status,
        timeRemainingMs,
        progress,
      };
    });
  }, [withdrawals, currentTime]);

  // Filter by status
  const pendingWithdrawals = useMemo(
    () => withdrawalsWithStatus.filter((w) => w.status === "pending"),
    [withdrawalsWithStatus]
  );

  const readyWithdrawals = useMemo(
    () => withdrawalsWithStatus.filter((w) => w.status === "ready"),
    [withdrawalsWithStatus]
  );

  const claimedWithdrawals = useMemo(
    () => withdrawalsWithStatus.filter((w) => w.status === "claimed"),
    [withdrawalsWithStatus]
  );

  // Claim withdrawal action
  const claimWithdrawal = useCallback(
    (senderPubKey: PublicKey, withdrawalId: number): unknown => {
      return poolClient.claimWithdrawal(senderPubKey, withdrawalId);
    },
    []
  );

  const refreshWithdrawals = useCallback(async () => {
    await fetchWithdrawals();
  }, [fetchWithdrawals]);

  return {
    withdrawals: withdrawalsWithStatus,
    pendingWithdrawals,
    readyWithdrawals,
    claimedWithdrawals,
    isLoading,
    error,
    claimWithdrawal,
    refreshWithdrawals,
  };
}

/**
 * Format remaining time as human-readable string
 * @param ms Time remaining in milliseconds
 * @returns Formatted string like "12h 30m" or "Ready to claim"
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Ready to claim";

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s remaining`;
  } else {
    return `${seconds}s remaining`;
  }
}

/**
 * Format timestamp as readable date
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}
