"use client";

/**
 * Pool Statistics Component
 * Displays TVL, reserves, exchange rate, and volume
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePoolStats, formatNumber, formatUsd, formatCspr } from "@/hooks/use-pool-stats";
import { tokenClient } from "@/lib/token-client";
import { RefreshCw, TrendingUp, Coins, ArrowRightLeft, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface PoolStatsProps {
  className?: string;
}

export function PoolStats({ className }: PoolStatsProps) {
  const { stats, isLoading, refresh } = usePoolStats();

  const statItems = [
    {
      label: "Total Value Locked",
      value: stats ? formatUsd(stats.tvlUsd) : "-",
      subValue: stats ? `${formatNumber(stats.tvlCspr)} CSPR` : undefined,
      icon: <Layers className="h-4 w-4" />,
      color: "text-primary",
    },
    {
      label: "CSPR Reserve",
      value: stats ? formatCspr(stats.reserveCspr) : "-",
      icon: <Coins className="h-4 w-4" />,
      color: "text-orange-500",
    },
    {
      label: "Token Reserve",
      value: stats
        ? formatNumber(
            Number(tokenClient.formatAmount(stats.reserveToken, 9)),
            2
          ) + " GHOST"
        : "-",
      icon: <Coins className="h-4 w-4" />,
      color: "text-purple-500",
    },
    {
      label: "Exchange Rate",
      value: stats ? `1 CSPR = ${stats.exchangeRate.toFixed(4)} GHOST` : "-",
      icon: <ArrowRightLeft className="h-4 w-4" />,
      color: "text-blue-500",
    },
    {
      label: "24h Volume",
      value: stats?.volume24h && stats.volume24h > BigInt(0)
        ? formatCspr(stats.volume24h)
        : "N/A",
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-green-500",
    },
    {
      label: "Total LP Tokens",
      value: stats?.totalLpSupply && stats.totalLpSupply > BigInt(0)
        ? formatNumber(
            Number(tokenClient.formatAmount(stats.totalLpSupply, 9)),
            2
          ) + " LP"
        : "N/A",
      icon: <Layers className="h-4 w-4" />,
      color: "text-cyan-500",
    },
  ];

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Pool Statistics</CardTitle>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-4 w-4 text-muted-foreground", isLoading && "animate-spin")}
            />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {statItems.map((item, index) => (
            <div
              key={index}
              className="flex flex-col p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("", item.color)}>{item.icon}</div>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <span className="text-lg font-semibold">{item.value}</span>
              {item.subValue && (
                <span className="text-xs text-muted-foreground">{item.subValue}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
