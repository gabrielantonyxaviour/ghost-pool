"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PoolCard, PoolData } from "@/components/pool-card";
import { usePoolStats, formatUsd, formatNumber } from "@/hooks/use-pool-stats";
import { useWallet } from "@/hooks/use-wallet";
import {
  Droplets,
  TrendingUp,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type SortOption = "tvl" | "apr" | "volume";
type FilterOption = "all" | "staking" | "my-positions";

export default function PoolsPage() {
  const { stats, isLoading, refresh } = usePoolStats();
  const { isConnected, publicKey } = useWallet();
  const [sortBy, setSortBy] = useState<SortOption>("tvl");
  const [filter, setFilter] = useState<FilterOption>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create pool data from the main Ghost Pool
  // In production, this would come from multiple pools
  const pools: PoolData[] = stats
    ? [
        {
          id: "cspr-ghost",
          token0: { symbol: "CSPR", name: "Casper" },
          token1: { symbol: "GHOST", name: "Ghost Token" },
          tvlUsd: stats.tvlUsd,
          apr: stats.combinedApy,
          volume24h: stats.volume24h,
          reserve0: stats.reserveCspr,
          reserve1: stats.reserveToken,
          stakingEnabled: true,
          userLpBalance: BigInt(0), // Would come from user-specific query
        },
      ]
    : [];

  // Filter and sort pools
  const filteredPools = pools
    .filter((pool) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          pool.token0.symbol.toLowerCase().includes(query) ||
          pool.token1.symbol.toLowerCase().includes(query) ||
          pool.token0.name.toLowerCase().includes(query) ||
          pool.token1.name.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .filter((pool) => {
      // Type filter
      if (filter === "staking") return pool.stakingEnabled;
      if (filter === "my-positions")
        return pool.userLpBalance && pool.userLpBalance > BigInt(0);
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "apr":
          return b.apr - a.apr;
        case "volume":
          return Number(b.volume24h - a.volume24h);
        default:
          return b.tvlUsd - a.tvlUsd;
      }
    });

  // Aggregate stats
  const totalTvl = pools.reduce((sum, p) => sum + p.tvlUsd, 0);
  const avgApr = pools.length > 0 ? pools.reduce((sum, p) => sum + p.apr, 0) / pools.length : 0;
  const totalVolume = pools.reduce((sum, p) => sum + p.volume24h, BigInt(0));

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="text-center space-y-4 pt-8 pb-6 px-4">
        <h1 className="text-3xl font-bold tracking-tight">Liquidity Pools</h1>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          Provide liquidity to earn swap fees and staking rewards. Auto-staking pools
          earn additional yield from Casper Network staking.
        </p>
      </div>

      {/* Aggregate stats */}
      <div className="max-w-6xl mx-auto px-4 mb-6">
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total TVL</div>
                  <div className="font-semibold">{formatUsd(totalTvl)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg APR</div>
                  <div className="font-semibold text-green-500">{avgApr.toFixed(2)}%</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Droplets className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Active Pools</div>
                  <div className="font-semibold">{pools.length}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-orange-500/10">
                  <Wallet className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">24h Volume</div>
                  <div className="font-semibold">
                    {totalVolume > BigInt(0) ? formatNumber(Number(totalVolume) / 1e9, 2) + " CSPR" : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and search */}
      <div className="max-w-6xl mx-auto px-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search pools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
            {/* Filter buttons */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {(["all", "staking", "my-positions"] as FilterOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    filter === option
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option === "all" && "All Pools"}
                  {option === "staking" && "Auto-Staking"}
                  {option === "my-positions" && "My Positions"}
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="tvl">TVL</option>
                <option value="apr">APR</option>
                <option value="volume">Volume</option>
              </select>
            </div>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Pool list */}
      <div className="max-w-6xl mx-auto px-4">
        {isLoading && pools.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground animate-spin mb-4" />
              <p className="text-muted-foreground">Loading pools...</p>
            </CardContent>
          </Card>
        ) : filteredPools.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Droplets className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No pools found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {searchQuery
                  ? "Try a different search term"
                  : filter === "my-positions"
                  ? "You don't have any liquidity positions yet"
                  : "No pools available at the moment"}
              </p>
              {!isConnected && filter === "my-positions" && (
                <p className="text-xs text-muted-foreground">
                  Connect your wallet to see your positions
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredPools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        )}

        {/* Info card */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How Ghost Pool Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <div className="p-2 rounded-full bg-green-500/10 h-fit">
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <div className="font-medium text-foreground">Auto-Staking</div>
                <p>90% of CSPR reserves are automatically staked to earn native Casper staking rewards (~9% APY).</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="p-2 rounded-full bg-blue-500/10 h-fit">
                <Droplets className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <div className="font-medium text-foreground">Liquidity Buffer</div>
                <p>10% of CSPR is kept unstaked as a buffer for instant swaps. The pool auto-rebalances as needed.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="p-2 rounded-full bg-orange-500/10 h-fit">
                <Wallet className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <div className="font-medium text-foreground">Withdrawal Process</div>
                <p>When removing liquidity, tokens are instant but CSPR has a 14-hour unbonding period from staking.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
