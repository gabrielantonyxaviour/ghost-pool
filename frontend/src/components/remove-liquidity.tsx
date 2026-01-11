"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useLiquidity } from "@/hooks/use-liquidity";
import { useWallet } from "@/hooks/use-wallet";
import { tokenClient } from "@/lib/token-client";
import { motesToCspr, UNBONDING_PERIOD_MS } from "@/lib/constants";
import { Clock, Loader2, CheckCircle, ExternalLink } from "lucide-react";

interface RemoveLiquidityProps {
  onSuccess?: (deployHash: string) => void;
}

export function RemoveLiquidity({ onSuccess }: RemoveLiquidityProps) {
  const { isConnected } = useWallet();
  const {
    userPosition,
    isLoadingPosition,
    calculateRemoveAmounts,
    isRemovingLiquidity,
    removeLiquidityError,
    removeLiquidity,
  } = useLiquidity();

  const [lpInput, setLpInput] = useState<string>("");
  const [percentage, setPercentage] = useState<number>(0);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Convert LP input to bigint
  const lpAmount = useMemo(() => {
    if (!lpInput || isNaN(parseFloat(lpInput))) return BigInt(0);
    return tokenClient.parseAmount(lpInput);
  }, [lpInput]);

  // Calculate amounts to receive
  const { csprAmount, tokenAmount } = useMemo(() => {
    if (lpAmount === BigInt(0)) {
      return { csprAmount: BigInt(0), tokenAmount: BigInt(0) };
    }
    return calculateRemoveAmounts(lpAmount);
  }, [lpAmount, calculateRemoveAmounts]);

  // Handle LP input change
  const handleLpChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setLpInput(value);
      // Update percentage slider
      if (userPosition && userPosition.lpBalance > BigInt(0)) {
        const inputAmount = value ? tokenClient.parseAmount(value) : BigInt(0);
        const pct = Number((inputAmount * BigInt(100)) / userPosition.lpBalance);
        setPercentage(Math.min(100, Math.max(0, pct)));
      }
    }
  };

  // Handle percentage slider change
  const handlePercentageChange = (pct: number) => {
    setPercentage(pct);
    if (userPosition && userPosition.lpBalance > BigInt(0)) {
      const amount = (userPosition.lpBalance * BigInt(pct)) / BigInt(100);
      setLpInput(tokenClient.formatAmount(amount));
    }
  };

  // Handle remove liquidity
  const handleRemoveLiquidity = async () => {
    const slippageBps = Math.floor(slippage * 100);
    const hash = await removeLiquidity(lpAmount, slippageBps);

    if (hash) {
      setTxHash(hash);
      setLpInput("");
      setPercentage(0);
      onSuccess?.(hash);
    }
  };

  // Format unbonding period
  const unbondingHours = Math.round(UNBONDING_PERIOD_MS / (1000 * 60 * 60));

  if (!isConnected) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Remove Liquidity</h2>
        <p className="text-muted-foreground text-center py-8">
          Connect your wallet to remove liquidity
        </p>
      </div>
    );
  }

  if (isLoadingPosition) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Remove Liquidity</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!userPosition || userPosition.lpBalance === BigInt(0)) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Remove Liquidity</h2>
        <p className="text-muted-foreground text-center py-8">
          You don&apos;t have any liquidity position to remove
        </p>
      </div>
    );
  }

  if (txHash) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h3 className="text-lg font-semibold">Withdrawal Initiated</h3>
          <p className="text-sm text-muted-foreground text-center">
            Your GHOST tokens are available immediately. CSPR will be available
            after the {unbondingHours}-hour unbonding period.
          </p>
          <a
            href={`https://testnet.cspr.live/deploy/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View transaction <ExternalLink className="h-3 w-3" />
          </a>
          <Button onClick={() => setTxHash(null)} variant="outline">
            Remove More Liquidity
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">Remove Liquidity</h2>

      {/* Current position summary */}
      <div className="rounded-md bg-muted/50 p-3 mb-4">
        <p className="text-sm text-muted-foreground mb-1">Your LP Balance</p>
        <p className="text-lg font-semibold">
          {tokenClient.formatAmount(userPosition.lpBalance)} LP
        </p>
        <p className="text-xs text-muted-foreground">
          ≈ {motesToCspr(userPosition.csprValue).toFixed(4)} CSPR +{" "}
          {tokenClient.formatAmount(userPosition.tokenValue)} GHOST
        </p>
      </div>

      {/* LP Amount Input */}
      <div className="space-y-2 mb-4">
        <label className="text-sm font-medium">Amount to Remove</label>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={lpInput}
            onChange={(e) => handleLpChange(e.target.value)}
            placeholder="0.0"
            className="w-full h-12 px-4 pr-16 rounded-md border bg-background text-lg focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isRemovingLiquidity}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            LP
          </span>
        </div>
      </div>

      {/* Percentage slider */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Percentage</span>
          <span className="font-medium">{percentage}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={percentage}
          onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          disabled={isRemovingLiquidity}
        />
        <div className="flex justify-between mt-2">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => handlePercentageChange(pct)}
              className="px-3 py-1 text-xs rounded-md bg-muted hover:bg-muted/80 transition-colors"
              disabled={isRemovingLiquidity}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Expected output */}
      {lpAmount > BigInt(0) && (
        <div className="rounded-md bg-muted/50 p-3 mb-4 space-y-2">
          <p className="text-sm font-medium mb-2">You will receive</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">CSPR</span>
            <span className="font-medium">{motesToCspr(csprAmount).toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GHOST</span>
            <span className="font-medium">{tokenClient.formatAmount(tokenAmount)}</span>
          </div>
        </div>
      )}

      {/* Slippage setting */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">Slippage tolerance</span>
        <div className="flex gap-2">
          {[0.1, 0.5, 1.0].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                slippage === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Unbonding period warning */}
      <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 mb-4">
        <div className="flex gap-2">
          <Clock className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              {unbondingHours}-Hour CSPR Unbonding Period
            </p>
            <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80 mt-1">
              GHOST tokens are available immediately. CSPR requires an unbonding period
              because it&apos;s staked. You can claim your CSPR after {unbondingHours} hours.
            </p>
          </div>
        </div>
      </div>

      {/* Error display */}
      {removeLiquidityError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 mb-4">
          <p className="text-sm text-destructive">{removeLiquidityError}</p>
        </div>
      )}

      {/* Action button */}
      <Button
        onClick={handleRemoveLiquidity}
        disabled={isRemovingLiquidity || lpAmount === BigInt(0)}
        variant="destructive"
        className="w-full"
      >
        {isRemovingLiquidity ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Removing Liquidity...
          </>
        ) : (
          "Remove Liquidity"
        )}
      </Button>
    </div>
  );
}
