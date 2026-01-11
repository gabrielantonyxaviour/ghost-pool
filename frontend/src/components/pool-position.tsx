"use client";

import { useMemo } from "react";
import { useLiquidity } from "@/hooks/use-liquidity";
import { useWallet } from "@/hooks/use-wallet";
import { usePool } from "@/hooks/use-pool";
import { tokenClient } from "@/lib/token-client";
import { motesToCspr } from "@/lib/constants";
import { Loader2, TrendingUp, Droplets, PieChart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PoolPositionProps {
  compact?: boolean;
}

export function PoolPosition({ compact = false }: PoolPositionProps) {
  const { isConnected } = useWallet();
  const { poolState, isLoading: isLoadingPool } = usePool();
  const { userPosition, isLoadingPosition, refreshPosition } = useLiquidity();

  // Calculate total pool value
  const totalPoolValue = useMemo(() => {
    if (!poolState) return { cspr: BigInt(0), token: BigInt(0) };
    return {
      cspr: poolState.reserveCspr + poolState.stakedCspr + poolState.bufferCspr,
      token: poolState.reserveToken,
    };
  }, [poolState]);

  // Calculate staking yield info
  const stakingInfo = useMemo(() => {
    if (!poolState) return null;
    const totalCspr = poolState.reserveCspr + poolState.stakedCspr + poolState.bufferCspr;
    if (totalCspr === BigInt(0)) return null;

    const stakedPercent = Number((poolState.stakedCspr * BigInt(100)) / totalCspr);
    return {
      stakedCspr: poolState.stakedCspr,
      bufferCspr: poolState.bufferCspr,
      stakedPercent,
    };
  }, [poolState]);

  const isLoading = isLoadingPool || isLoadingPosition;

  if (!isConnected) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Droplets className="h-5 w-5" />
          Your Position
        </h2>
        <p className="text-muted-foreground text-center py-6">
          Connect your wallet to view your position
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Droplets className="h-5 w-5" />
          Your Position
        </h2>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Your Position</span>
          </div>
          {userPosition && userPosition.lpBalance > BigInt(0) ? (
            <div className="text-right">
              <p className="text-sm font-semibold">
                {tokenClient.formatAmount(userPosition.lpBalance)} LP
              </p>
              <p className="text-xs text-muted-foreground">
                {userPosition.poolSharePercent.toFixed(2)}% of pool
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No position</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Droplets className="h-5 w-5" />
          Your Position
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={refreshPosition}
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {userPosition && userPosition.lpBalance > BigInt(0) ? (
        <div className="space-y-4">
          {/* LP Token Balance */}
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">LP Token Balance</span>
              <span className="text-lg font-semibold">
                {tokenClient.formatAmount(userPosition.lpBalance)} LP
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, userPosition.poolSharePercent)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {userPosition.poolSharePercent.toFixed(4)}% of pool
            </p>
          </div>

          {/* Position Value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">CSPR Value</p>
              <p className="text-sm font-semibold">
                {motesToCspr(userPosition.csprValue).toFixed(4)}
              </p>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">GHOST Value</p>
              <p className="text-sm font-semibold">
                {tokenClient.formatAmount(userPosition.tokenValue)}
              </p>
            </div>
          </div>

          {/* Pool Share Stats */}
          <div className="flex items-center gap-2 text-sm">
            <PieChart className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Your share:</span>
            <span className="font-medium">{userPosition.poolSharePercent.toFixed(4)}%</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Droplets className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-1">No liquidity position</p>
          <p className="text-xs text-muted-foreground">
            Add liquidity to earn swap fees and staking rewards
          </p>
        </div>
      )}

      {/* Pool Overview */}
      {poolState && (
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pool Overview
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Total CSPR</p>
              <p className="font-medium">
                {motesToCspr(totalPoolValue.cspr).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Total GHOST</p>
              <p className="font-medium">
                {tokenClient.formatAmount(totalPoolValue.token)}
              </p>
            </div>
          </div>

          {/* Staking info */}
          {stakingInfo && (
            <div className="mt-3 pt-3 border-t border-dashed">
              <p className="text-xs text-muted-foreground mb-2">CSPR Staking</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${stakingInfo.stakedPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium">
                  {stakingInfo.stakedPercent.toFixed(0)}% staked
                </span>
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>
                  Staked: {motesToCspr(stakingInfo.stakedCspr).toFixed(2)} CSPR
                </span>
                <span>
                  Buffer: {motesToCspr(stakingInfo.bufferCspr).toFixed(2)} CSPR
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
