"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useLiquidity } from "@/hooks/use-liquidity";
import { useWallet } from "@/hooks/use-wallet";
import { usePool } from "@/hooks/use-pool";
import { tokenClient } from "@/lib/token-client";
import { csprToMotes, motesToCspr } from "@/lib/constants";
import { AlertTriangle, Info, Loader2, CheckCircle, ExternalLink } from "lucide-react";

interface AddLiquidityProps {
  onSuccess?: (deployHash: string) => void;
}

export function AddLiquidity({ onSuccess }: AddLiquidityProps) {
  const { isConnected } = useWallet();
  const { poolState } = usePool();
  const {
    calculateOptimalAmounts,
    calculateExpectedLp,
    calculatePoolShareAfterAdd,
    needsApproval,
    isApproving,
    approveError,
    approveTokens,
    isAddingLiquidity,
    addLiquidityError,
    addLiquidity,
  } = useLiquidity();

  const [csprInput, setCsprInput] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [lastEditedField, setLastEditedField] = useState<"cspr" | "token">("cspr");
  const [slippage, setSlippage] = useState<number>(0.5);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Convert input strings to bigint (in motes/smallest unit)
  const csprAmount = useMemo(() => {
    if (!csprInput || isNaN(parseFloat(csprInput))) return BigInt(0);
    return csprToMotes(csprInput);
  }, [csprInput]);

  const tokenAmount = useMemo(() => {
    if (!tokenInput || isNaN(parseFloat(tokenInput))) return BigInt(0);
    return tokenClient.parseAmount(tokenInput);
  }, [tokenInput]);

  // Auto-calculate matching amount when user edits one field
  useEffect(() => {
    if (!poolState || poolState.reserveCspr === BigInt(0)) return;

    if (lastEditedField === "cspr" && csprInput) {
      const { tokenAmount: optimalToken } = calculateOptimalAmounts(csprAmount, true);
      if (optimalToken > BigInt(0)) {
        setTokenInput(tokenClient.formatAmount(optimalToken));
      }
    } else if (lastEditedField === "token" && tokenInput) {
      const { csprAmount: optimalCspr } = calculateOptimalAmounts(tokenAmount, false);
      if (optimalCspr > BigInt(0)) {
        setCsprInput(motesToCspr(optimalCspr).toFixed(4));
      }
    }
  }, [csprInput, tokenInput, lastEditedField, poolState, calculateOptimalAmounts, csprAmount, tokenAmount]);

  // Calculate expected LP tokens and pool share
  const expectedLp = useMemo(() => {
    if (csprAmount === BigInt(0) || tokenAmount === BigInt(0)) return BigInt(0);
    return calculateExpectedLp(csprAmount, tokenAmount);
  }, [csprAmount, tokenAmount, calculateExpectedLp]);

  const expectedPoolShare = useMemo(() => {
    if (expectedLp === BigInt(0)) return 0;
    return calculatePoolShareAfterAdd(expectedLp);
  }, [expectedLp, calculatePoolShareAfterAdd]);

  // Check if approval is needed
  const requiresApproval = useMemo(() => {
    return needsApproval(tokenAmount);
  }, [needsApproval, tokenAmount]);

  // Handle CSPR input change
  const handleCsprChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setCsprInput(value);
      setLastEditedField("cspr");
    }
  };

  // Handle token input change
  const handleTokenChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setTokenInput(value);
      setLastEditedField("token");
    }
  };

  // Handle approval
  const handleApprove = async () => {
    // Approve a larger amount to avoid frequent approvals
    const approveAmount = tokenAmount * BigInt(10);
    await approveTokens(approveAmount);
  };

  // Handle add liquidity
  const handleAddLiquidity = async () => {
    const slippageBps = Math.floor(slippage * 100);
    const hash = await addLiquidity(csprAmount, tokenAmount, slippageBps);

    if (hash) {
      setTxHash(hash);
      setCsprInput("");
      setTokenInput("");
      onSuccess?.(hash);
    }
  };

  // Show pool ratio info
  const poolRatio = useMemo(() => {
    if (!poolState || poolState.reserveCspr === BigInt(0) || poolState.reserveToken === BigInt(0)) {
      return null;
    }
    const ratio = Number(poolState.reserveToken) / Number(poolState.reserveCspr);
    return ratio.toFixed(4);
  }, [poolState]);

  if (!isConnected) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Add Liquidity</h2>
        <p className="text-muted-foreground text-center py-8">
          Connect your wallet to add liquidity
        </p>
      </div>
    );
  }

  if (txHash) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h3 className="text-lg font-semibold">Liquidity Added</h3>
          <p className="text-sm text-muted-foreground text-center">
            Your transaction has been submitted successfully.
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
            Add More Liquidity
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">Add Liquidity</h2>

      {/* Info about AMM liquidity */}
      <div className="rounded-md bg-muted/50 p-3 mb-4">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            By adding liquidity, you&apos;ll earn 0.3% of all trades proportional to your share of the pool.
            Fees are reinvested automatically.
          </p>
        </div>
      </div>

      {/* CSPR Input */}
      <div className="space-y-2 mb-4">
        <label className="text-sm font-medium">CSPR Amount</label>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={csprInput}
            onChange={(e) => handleCsprChange(e.target.value)}
            placeholder="0.0"
            className="w-full h-12 px-4 pr-16 rounded-md border bg-background text-lg focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isAddingLiquidity || isApproving}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            CSPR
          </span>
        </div>
      </div>

      {/* Plus sign */}
      <div className="flex justify-center my-2">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          +
        </div>
      </div>

      {/* Token Input */}
      <div className="space-y-2 mb-4">
        <label className="text-sm font-medium">Token Amount</label>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={tokenInput}
            onChange={(e) => handleTokenChange(e.target.value)}
            placeholder="0.0"
            className="w-full h-12 px-4 pr-20 rounded-md border bg-background text-lg focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isAddingLiquidity || isApproving}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            GHOST
          </span>
        </div>
      </div>

      {/* Pool ratio info */}
      {poolRatio && (
        <p className="text-xs text-muted-foreground mb-4">
          Current pool ratio: 1 CSPR = {poolRatio} GHOST
        </p>
      )}

      {/* Expected output */}
      {expectedLp > BigInt(0) && (
        <div className="rounded-md bg-muted/50 p-3 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">LP Tokens to receive</span>
            <span className="font-medium">{tokenClient.formatAmount(expectedLp)} LP</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pool share</span>
            <span className="font-medium">{expectedPoolShare.toFixed(2)}%</span>
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

      {/* Impermanent loss warning */}
      <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 mb-4">
        <div className="flex gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Providing liquidity involves impermanent loss risk. If the price ratio changes
            significantly, you may receive less value than if you had held the assets separately.
          </p>
        </div>
      </div>

      {/* Error display */}
      {(addLiquidityError || approveError) && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 mb-4">
          <p className="text-sm text-destructive">{addLiquidityError || approveError}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        {requiresApproval ? (
          <Button
            onClick={handleApprove}
            disabled={isApproving || tokenAmount === BigInt(0)}
            className="w-full"
          >
            {isApproving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              "Approve GHOST"
            )}
          </Button>
        ) : (
          <Button
            onClick={handleAddLiquidity}
            disabled={
              isAddingLiquidity ||
              csprAmount === BigInt(0) ||
              tokenAmount === BigInt(0)
            }
            className="w-full"
          >
            {isAddingLiquidity ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Liquidity...
              </>
            ) : (
              "Add Liquidity"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
