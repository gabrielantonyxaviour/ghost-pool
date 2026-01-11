"use client";

/**
 * APY Calculator Component
 * Shows breakdown of staking APY + swap fee APY
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePoolStats } from "@/hooks/use-pool-stats";
import { TrendingUp, Percent, Coins, ArrowRightLeft, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface ApyDisplayProps {
  className?: string;
  compact?: boolean;
}

export function ApyDisplay({ className, compact = false }: ApyDisplayProps) {
  const { stats } = usePoolStats();

  const stakingApy = stats?.stakingApy ?? 8.1; // 90% efficiency * 9% base
  const swapFeeApy = stats?.swapFeeApy ?? 0;
  const combinedApy = stakingApy + swapFeeApy;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-green-500/10 to-primary/10 border border-green-500/20",
          className
        )}
      >
        <TrendingUp className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium">
          APY: <span className="text-green-500">{combinedApy.toFixed(2)}%</span>
        </span>
        <Tooltip content={`Staking: ${stakingApy.toFixed(2)}% + Swap Fees: ${swapFeeApy.toFixed(2)}%`}>
          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
        </Tooltip>
      </div>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Percent className="h-5 w-5" />
          APY Calculator
        </CardTitle>
        <CardDescription>
          Estimated annual returns for liquidity providers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Combined APY highlight */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-primary/10 border border-green-500/20">
          <div className="text-center">
            <span className="text-sm text-muted-foreground">Combined APY</span>
            <div className="text-3xl font-bold text-green-500 mt-1">
              {combinedApy.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* APY breakdown */}
        <div className="space-y-3">
          {/* Staking APY */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-500/10">
                <Coins className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <span className="text-sm font-medium">Staking Yield</span>
                <p className="text-xs text-muted-foreground">
                  90% of reserves staked at ~9% APY
                </p>
              </div>
            </div>
            <span className="text-lg font-semibold text-blue-500">
              {stakingApy.toFixed(2)}%
            </span>
          </div>

          {/* Swap fee APY */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-purple-500/10">
                <ArrowRightLeft className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <span className="text-sm font-medium">Swap Fees</span>
                <p className="text-xs text-muted-foreground">
                  0.3% on all trades
                </p>
              </div>
            </div>
            <span className="text-lg font-semibold text-purple-500">
              {swapFeeApy.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Comparison */}
        <div className="p-3 rounded-lg border border-dashed">
          <h4 className="text-sm font-medium mb-2">vs Standard AMM</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ghost Pool (Staking + Fees)</span>
              <span className="font-medium text-green-500">{combinedApy.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Standard AMM (Fees only)</span>
              <span className="font-medium">{swapFeeApy.toFixed(2)}%</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Additional Yield</span>
              <span className="font-medium text-primary">+{stakingApy.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center">
          APY is variable and depends on staking rewards and trading volume.
          Past performance does not guarantee future results.
        </p>
      </CardContent>
    </Card>
  );
}
