"use client";

/**
 * Main swap interface component
 */

import { useState, useCallback, useEffect } from "react";
import { TokenInput } from "./token-input";
import { SwapSettings } from "./swap-settings";
import { Button } from "@/components/ui/button";
import { useSwap } from "@/hooks/use-swap";
import { useWallet } from "@/hooks/use-wallet";
import { tokenClient } from "@/lib/token-client";
import { cn } from "@/lib/utils";

export function Swap() {
  const {
    direction,
    inputAmount,
    quote,
    slippageTolerance,
    isLoading,
    isSwapping,
    error,
    canSwap,
    insufficientBalance,
    insufficientBuffer,
    toggleDirection,
    setInputAmount,
    setSlippageTolerance,
    executeSwap,
  } = useSwap();

  const { isConnected, balance, connect, publicKey } = useWallet();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tokenBalance, setTokenBalance] = useState("0");
  const [txHash, setTxHash] = useState<string | null>(null);

  // Fetch token balance
  useEffect(() => {
    async function fetchBalance() {
      if (publicKey) {
        const bal = await tokenClient.balanceOf(publicKey);
        setTokenBalance(tokenClient.formatAmount(bal, 9));
      } else {
        setTokenBalance("0");
      }
    }
    fetchBalance();
  }, [publicKey]);

  // Handle swap execution
  const handleSwap = useCallback(async () => {
    const hash = await executeSwap();
    if (hash) {
      setTxHash(hash);
      // Clear success message after 10 seconds
      setTimeout(() => setTxHash(null), 10000);
    }
  }, [executeSwap]);

  // Toggle settings panel
  const toggleSettings = useCallback(() => {
    setSettingsOpen((prev) => !prev);
  }, []);

  // Get button text and state
  const getButtonState = (): { text: string; disabled: boolean } => {
    if (!isConnected) {
      return { text: "Connect Wallet", disabled: false };
    }
    if (isSwapping) {
      return { text: "Swapping...", disabled: true };
    }
    if (!inputAmount || inputAmount === "0") {
      return { text: "Enter Amount", disabled: true };
    }
    if (insufficientBalance) {
      return { text: "Insufficient Balance", disabled: true };
    }
    if (insufficientBuffer) {
      return { text: "Insufficient Pool Buffer", disabled: true };
    }
    if (isLoading) {
      return { text: "Calculating...", disabled: true };
    }
    if (error) {
      return { text: error, disabled: true };
    }
    return { text: "Swap", disabled: !canSwap };
  };

  const buttonState = getButtonState();

  // Format output amount
  const outputAmount = quote
    ? tokenClient.formatAmount(quote.amountOut, 9)
    : "";

  // Get token symbols based on direction
  const fromToken = direction === "cspr_to_token" ? "CSPR" : "GHOST";
  const toToken = direction === "cspr_to_token" ? "GHOST" : "CSPR";
  const fromBalance = direction === "cspr_to_token" ? balance || "0" : tokenBalance;
  const toBalance = direction === "cspr_to_token" ? tokenBalance : balance || "0";

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-border bg-card p-4 shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Swap</h2>
          <SwapSettings
            slippage={slippageTolerance}
            onSlippageChange={setSlippageTolerance}
            isOpen={settingsOpen}
            onToggle={toggleSettings}
          />
        </div>

        {/* From input */}
        <TokenInput
          symbol={fromToken}
          value={inputAmount}
          onChange={setInputAmount}
          balance={fromBalance}
          label="From"
          disabled={isSwapping}
        />

        {/* Swap direction toggle */}
        <div className="relative h-0 z-10">
          <button
            onClick={toggleDirection}
            disabled={isSwapping}
            className={cn(
              "absolute left-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-10 h-10 rounded-full border-4 border-background bg-secondary",
              "flex items-center justify-center",
              "hover:bg-accent transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ArrowIcon className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* To input */}
        <TokenInput
          symbol={toToken}
          value={outputAmount}
          onChange={() => {}}
          balance={toBalance}
          label="To"
          readOnly
          isLoading={isLoading && inputAmount !== ""}
          className="mt-1"
        />

        {/* Swap details */}
        {quote && quote.amountOut > BigInt(0) && (
          <div className="mt-4 space-y-2 text-sm">
            {/* Price */}
            <div className="flex justify-between text-muted-foreground">
              <span>Rate</span>
              <span>
                1 {fromToken} = {quote.executionPrice.toFixed(6)} {toToken}
              </span>
            </div>

            {/* Price impact */}
            <div className="flex justify-between text-muted-foreground">
              <span>Price Impact</span>
              <span
                className={cn(
                  quote.priceImpact > 5
                    ? "text-destructive"
                    : quote.priceImpact > 1
                    ? "text-yellow-500"
                    : "text-green-500"
                )}
              >
                {quote.priceImpact.toFixed(2)}%
              </span>
            </div>

            {/* Minimum received */}
            <div className="flex justify-between text-muted-foreground">
              <span>Min. Received</span>
              <span>
                {tokenClient.formatAmount(quote.minAmountOut, 9)} {toToken}
              </span>
            </div>

            {/* Slippage */}
            <div className="flex justify-between text-muted-foreground">
              <span>Slippage Tolerance</span>
              <span>{slippageTolerance}%</span>
            </div>

            {/* Fee */}
            <div className="flex justify-between text-muted-foreground">
              <span>Swap Fee (0.3%)</span>
              <span>
                {tokenClient.formatAmount(quote.fee, 9)} {fromToken}
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && !buttonState.disabled && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Success message */}
        {txHash && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 text-green-500 text-sm">
            <div className="flex items-center gap-2">
              <CheckIcon className="w-4 h-4" />
              <span>Swap successful!</span>
            </div>
            <a
              href={`https://testnet.cspr.live/deploy/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline mt-1 block"
            >
              View transaction
            </a>
          </div>
        )}

        {/* Action button */}
        <Button
          className="w-full mt-4"
          size="lg"
          disabled={buttonState.disabled}
          onClick={isConnected ? handleSwap : () => connect()}
        >
          {isSwapping && <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />}
          {buttonState.text}
        </Button>

        {/* High price impact warning */}
        {quote && quote.priceImpact > 5 && (
          <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <div className="flex items-start gap-2">
              <WarningIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">High Price Impact</p>
                <p className="text-xs opacity-80 mt-1">
                  This swap has a price impact of {quote.priceImpact.toFixed(2)}%.
                  Consider swapping a smaller amount.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Icon components
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 10l5 5 5-5" />
      <path d="M7 14l5-5 5 5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
