"use client";

/**
 * Price Chart Component
 * Displays historical token price and volume
 * Note: This is a placeholder - integrate with lightweight-charts for full functionality
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePoolStats } from "@/hooks/use-pool-stats";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceChartProps {
  className?: string;
}

// Mock price history data (replace with actual data from indexer)
const MOCK_PRICE_HISTORY = [
  { time: "12:00", price: 1.0, volume: 1000 },
  { time: "14:00", price: 1.02, volume: 1500 },
  { time: "16:00", price: 0.98, volume: 800 },
  { time: "18:00", price: 1.05, volume: 2000 },
  { time: "20:00", price: 1.03, volume: 1200 },
  { time: "22:00", price: 1.08, volume: 1800 },
  { time: "00:00", price: 1.06, volume: 900 },
  { time: "02:00", price: 1.04, volume: 700 },
];

export function PriceChart({ className }: PriceChartProps) {
  const { stats } = usePoolStats();

  const currentPrice = stats?.exchangeRate ?? 1.0;

  // Calculate price change
  const priceChange = useMemo(() => {
    if (MOCK_PRICE_HISTORY.length < 2) return 0;
    const firstPrice = MOCK_PRICE_HISTORY[0].price;
    return ((currentPrice - firstPrice) / firstPrice) * 100;
  }, [currentPrice]);

  const isPositive = priceChange >= 0;

  // Find min/max for chart scaling
  const { minPrice, maxPrice } = useMemo(() => {
    const prices = MOCK_PRICE_HISTORY.map((d) => d.price);
    return {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    };
  }, []);

  const priceRange = maxPrice - minPrice || 1;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            GHOST / CSPR
          </CardTitle>
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                isPositive ? "text-green-500" : "text-red-500"
              )}
            >
              {isPositive ? "+" : ""}
              {priceChange.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{currentPrice.toFixed(4)}</span>
          <span className="text-sm text-muted-foreground">GHOST per CSPR</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Simple bar chart visualization */}
        <div className="h-32 flex items-end gap-1 mt-4">
          {MOCK_PRICE_HISTORY.map((data, index) => {
            const height =
              ((data.price - minPrice) / priceRange) * 100 + 10; // Min 10% height

            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-1"
              >
                {/* Price bar */}
                <div
                  className={cn(
                    "w-full rounded-t transition-all duration-300",
                    index === MOCK_PRICE_HISTORY.length - 1
                      ? "bg-primary"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                  style={{ height: `${height}%` }}
                  title={`${data.time}: ${data.price.toFixed(4)} GHOST/CSPR`}
                />
              </div>
            );
          })}
        </div>

        {/* Time labels */}
        <div className="flex justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            {MOCK_PRICE_HISTORY[0].time}
          </span>
          <span className="text-xs text-muted-foreground">
            {MOCK_PRICE_HISTORY[MOCK_PRICE_HISTORY.length - 1].time}
          </span>
        </div>

        {/* Volume indicator */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">24h Volume</span>
            <span className="font-medium">
              {stats?.volume24h && stats.volume24h > BigInt(0)
                ? `${(Number(stats.volume24h) / 1e9).toFixed(2)} CSPR`
                : "N/A"}
            </span>
          </div>
        </div>

        {/* Note about placeholder */}
        <p className="text-xs text-muted-foreground text-center mt-4 opacity-50">
          Chart data is simulated. Connect to an indexer for real data.
        </p>
      </CardContent>
    </Card>
  );
}
