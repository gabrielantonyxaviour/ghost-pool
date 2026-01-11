"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNumber, formatUsd, formatCspr } from "@/hooks/use-pool-stats";
import { TrendingUp, Droplets, ArrowRightLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface PoolData {
  id: string;
  token0: {
    symbol: string;
    name: string;
    icon?: string;
  };
  token1: {
    symbol: string;
    name: string;
    icon?: string;
  };
  tvlUsd: number;
  apr: number;
  volume24h: bigint;
  reserve0: bigint;
  reserve1: bigint;
  stakingEnabled: boolean;
  userLpBalance?: bigint;
}

interface PoolCardProps {
  pool: PoolData;
  className?: string;
}

export function PoolCard({ pool, className }: PoolCardProps) {
  const hasUserPosition = pool.userLpBalance && pool.userLpBalance > BigInt(0);

  return (
    <Card className={cn("hover:border-primary/50 transition-colors", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Pool tokens */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center border-2 border-background">
                <span className="text-xs font-bold text-orange-500">
                  {pool.token0.symbol.slice(0, 2)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border-2 border-background">
                <span className="text-xs font-bold text-purple-500">
                  {pool.token1.symbol.slice(0, 2)}
                </span>
              </div>
            </div>
            <div>
              <h3 className="font-semibold">
                {pool.token0.symbol}/{pool.token1.symbol}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {pool.stakingEnabled && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">
                    <TrendingUp className="h-3 w-3" />
                    Auto-staking
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="hidden sm:flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">TVL</div>
              <div className="font-medium">{formatUsd(pool.tvlUsd)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">APR</div>
              <div className="font-medium text-green-500">{pool.apr.toFixed(2)}%</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">24h Volume</div>
              <div className="font-medium">
                {pool.volume24h > BigInt(0) ? formatCspr(pool.volume24h) : "N/A"}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {hasUserPosition && (
              <span className="text-xs text-primary font-medium px-2 py-1 bg-primary/10 rounded">
                Position
              </span>
            )}
            <Link href={`/?pool=${pool.id}`}>
              <Button variant="ghost" size="sm" className="gap-1">
                Trade
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 sm:hidden">
          <div>
            <div className="text-xs text-muted-foreground">TVL</div>
            <div className="font-medium text-sm">{formatUsd(pool.tvlUsd)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">APR</div>
            <div className="font-medium text-sm text-green-500">{pool.apr.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Volume</div>
            <div className="font-medium text-sm">
              {pool.volume24h > BigInt(0) ? formatCspr(pool.volume24h) : "N/A"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
