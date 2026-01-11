"use client";

/**
 * Staking Statistics Component
 * Displays staked CSPR, buffer, rewards, and compound button
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { usePoolStats, formatCspr } from "@/hooks/use-pool-stats";
import { usePool } from "@/hooks/use-pool";
import { useWallet } from "@/hooks/use-wallet";
import { DEFAULT_BUFFER_TARGET_BPS } from "@/lib/constants";
import { PublicKey } from "casper-js-sdk";
import {
  Lock,
  Unlock,
  Zap,
  TrendingUp,
  Loader2,
  CheckCircle,
  ExternalLink,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface StakingStatsProps {
  className?: string;
}

export function StakingStats({ className }: StakingStatsProps) {
  const { stats, isLoading } = usePoolStats();
  const { compound } = usePool();
  const { isConnected, publicKey, sign } = useWallet();
  const [isCompounding, setIsCompounding] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate buffer percentage
  const bufferPercentage = stats
    ? (Number(stats.bufferCspr) /
        Number(stats.stakedCspr + stats.bufferCspr || BigInt(1))) *
      100
    : 0;

  const targetBufferPercentage = DEFAULT_BUFFER_TARGET_BPS / 100;

  // Determine if buffer needs rebalancing
  const bufferStatus = bufferPercentage > targetBufferPercentage + 5
    ? "high"
    : bufferPercentage < targetBufferPercentage - 5
    ? "low"
    : "normal";

  // Handle compound action
  const handleCompound = async () => {
    if (!publicKey) return;

    try {
      setIsCompounding(true);
      setError(null);
      setTxHash(null);

      // Create the compound deploy
      const pubKey = PublicKey.newPublicKey(publicKey);
      const deploy = compound(pubKey);

      // Serialize deploy to JSON for wallet signing
      const deployJson = JSON.stringify(deploy);

      // Sign and send
      const hash = await sign(deployJson);
      if (hash) {
        setTxHash(hash);
      }
    } catch (err) {
      console.error("Compound failed:", err);
      setError(err instanceof Error ? err.message : "Failed to compound rewards");
    } finally {
      setIsCompounding(false);
    }
  };

  // Calculate staking efficiency
  const stakingEfficiency = stats
    ? (Number(stats.stakedCspr) /
        Number(stats.stakedCspr + stats.bufferCspr || BigInt(1))) *
      100
    : 0;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Staking</CardTitle>
            <CardDescription>
              90% of CSPR reserves are staked for yield
            </CardDescription>
          </div>
          <Tooltip content="The pool automatically stakes 90% of CSPR to earn native staking rewards. 10% is kept as buffer for instant swaps. Anyone can call compound to reinvest rewards.">
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Staking breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Staked</span>
            </div>
            <span className="text-lg font-semibold">
              {stats ? formatCspr(stats.stakedCspr) : "-"}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              ({stakingEfficiency.toFixed(1)}%)
            </span>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <Unlock className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Buffer</span>
            </div>
            <span className="text-lg font-semibold">
              {stats ? formatCspr(stats.bufferCspr) : "-"}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              ({bufferPercentage.toFixed(1)}%)
            </span>
          </div>
        </div>

        {/* Buffer status bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Buffer Level</span>
            <span
              className={cn(
                bufferStatus === "high"
                  ? "text-yellow-500"
                  : bufferStatus === "low"
                  ? "text-red-500"
                  : "text-green-500"
              )}
            >
              {bufferPercentage.toFixed(1)}% / {targetBufferPercentage}% target
            </span>
          </div>
          <Progress
            value={Math.min(bufferPercentage, 100)}
            className={cn(
              "h-2",
              bufferStatus === "high"
                ? "[&>div]:bg-yellow-500"
                : bufferStatus === "low"
                ? "[&>div]:bg-red-500"
                : "[&>div]:bg-green-500"
            )}
          />
        </div>

        {/* Pending rewards */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm">Pending Rewards</span>
            </div>
            <span className="font-semibold">
              {stats?.pendingRewards && stats.pendingRewards > BigInt(0)
                ? formatCspr(stats.pendingRewards)
                : "0 CSPR"}
            </span>
          </div>
        </div>

        {/* Estimated APY */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">Staking APY</span>
          <span className="font-semibold text-green-500">
            ~{stats?.stakingApy.toFixed(2) || "9.00"}%
          </span>
        </div>

        {/* Success message */}
        {txHash && (
          <div className="p-3 rounded-lg bg-green-500/10 text-green-500 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Rewards compounded!</span>
            </div>
            <a
              href={`https://testnet.cspr.live/deploy/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs mt-1 hover:underline"
            >
              View transaction <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Compound button */}
        <Button
          onClick={handleCompound}
          disabled={!isConnected || isCompounding || isLoading}
          variant="outline"
          className="w-full"
        >
          {isCompounding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Compounding...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Compound Rewards
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Anyone can call compound to reinvest staking rewards
        </p>
      </CardContent>
    </Card>
  );
}
