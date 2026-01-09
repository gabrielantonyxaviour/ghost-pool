"use client";

/**
 * Hook for swap functionality with quote calculation, price impact, and transaction building
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { PublicKey } from "casper-js-sdk";
import { usePool } from "./use-pool";
import { useWallet } from "./use-wallet";
import { tokenClient } from "@/lib/token-client";
import { poolClient } from "@/lib/pool-client";
import { MOTES_PER_CSPR, DEFAULT_SWAP_FEE_BPS } from "@/lib/constants";

export type SwapDirection = "cspr_to_token" | "token_to_cspr";

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  minAmountOut: bigint;
  priceImpact: number; // Percentage (e.g., 0.5 = 0.5%)
  executionPrice: number; // Price per token
  fee: bigint;
}

export interface UseSwapReturn {
  // State
  direction: SwapDirection;
  inputAmount: string;
  quote: SwapQuote | null;
  slippageTolerance: number; // Percentage (e.g., 0.5 = 0.5%)
  isLoading: boolean;
  isSwapping: boolean;
  error: string | null;

  // Derived state
  canSwap: boolean;
  insufficientBalance: boolean;
  insufficientBuffer: boolean;

  // Actions
  setDirection: (direction: SwapDirection) => void;
  toggleDirection: () => void;
  setInputAmount: (amount: string) => void;
  setSlippageTolerance: (tolerance: number) => void;
  executeSwap: () => Promise<string | null>;
}

// Default slippage tolerance
const DEFAULT_SLIPPAGE = 0.5;

// Debounce delay for quote updates
const QUOTE_DEBOUNCE_MS = 300;

export function useSwap(): UseSwapReturn {
  const { poolState, quoteCsprForToken, quoteTokenForCspr, swapCsprForToken, swapTokenForCspr } = usePool();
  const { isConnected, publicKey, balance, sign } = useWallet();

  // Core state
  const [direction, setDirection] = useState<SwapDirection>("cspr_to_token");
  const [inputAmount, setInputAmount] = useState("");
  const [slippageTolerance, setSlippageTolerance] = useState(DEFAULT_SLIPPAGE);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0));

  // Fetch token balance when connected
  useEffect(() => {
    async function fetchTokenBalance() {
      if (publicKey) {
        const bal = await tokenClient.balanceOf(publicKey);
        setTokenBalance(bal);
      } else {
        setTokenBalance(BigInt(0));
      }
    }
    fetchTokenBalance();
  }, [publicKey]);

  // Parse input amount to bigint based on direction
  const parsedInputAmount = useMemo((): bigint => {
    if (!inputAmount || inputAmount === "" || inputAmount === ".") {
      return BigInt(0);
    }
    try {
      if (direction === "cspr_to_token") {
        // CSPR has 9 decimals (motes)
        return tokenClient.parseAmount(inputAmount, 9);
      } else {
        // Token has 9 decimals
        return tokenClient.parseAmount(inputAmount, 9);
      }
    } catch {
      return BigInt(0);
    }
  }, [inputAmount, direction]);

  // Calculate quote when input changes
  useEffect(() => {
    if (parsedInputAmount === BigInt(0) || !poolState) {
      setQuote(null);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsLoading(true);
      setError(null);

      try {
        let amountOut: bigint;
        let spotPrice: bigint;

        if (direction === "cspr_to_token") {
          amountOut = quoteCsprForToken(parsedInputAmount);
          // Spot price: token reserve / cspr reserve
          spotPrice = poolState.reserveToken > 0 && poolState.reserveCspr > 0
            ? (poolState.reserveToken * MOTES_PER_CSPR) / poolState.reserveCspr
            : BigInt(0);
        } else {
          amountOut = quoteTokenForCspr(parsedInputAmount);
          // Spot price: cspr reserve / token reserve
          spotPrice = poolState.reserveToken > 0 && poolState.reserveCspr > 0
            ? (poolState.reserveCspr * MOTES_PER_CSPR) / poolState.reserveToken
            : BigInt(0);
        }

        // Calculate price impact
        // Impact = (spotPrice - executionPrice) / spotPrice * 100
        const executionPrice = parsedInputAmount > 0
          ? (amountOut * MOTES_PER_CSPR) / parsedInputAmount
          : BigInt(0);

        const priceImpact = spotPrice > 0
          ? Number((spotPrice - executionPrice) * BigInt(10000) / spotPrice) / 100
          : 0;

        // Calculate minimum output with slippage
        const slippageMultiplier = BigInt(Math.floor((100 - slippageTolerance) * 100));
        const minAmountOut = (amountOut * slippageMultiplier) / BigInt(10000);

        // Calculate fee
        const fee = (parsedInputAmount * BigInt(DEFAULT_SWAP_FEE_BPS)) / BigInt(10000);

        setQuote({
          amountIn: parsedInputAmount,
          amountOut,
          minAmountOut,
          priceImpact: Math.max(0, priceImpact),
          executionPrice: Number(executionPrice) / Number(MOTES_PER_CSPR),
          fee,
        });
      } catch (err) {
        console.error("Quote calculation error:", err);
        setError("Failed to calculate quote");
        setQuote(null);
      } finally {
        setIsLoading(false);
      }
    }, QUOTE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [parsedInputAmount, direction, poolState, quoteCsprForToken, quoteTokenForCspr, slippageTolerance]);

  // Check if user has sufficient balance
  const insufficientBalance = useMemo((): boolean => {
    if (!isConnected || parsedInputAmount === BigInt(0)) return false;

    if (direction === "cspr_to_token") {
      // Compare CSPR balance (balance is in CSPR string format)
      const balanceMotes = balance ? tokenClient.parseAmount(balance, 9) : BigInt(0);
      // Leave some CSPR for gas
      const gasBuffer = BigInt(5_000_000_000); // 5 CSPR for gas
      return parsedInputAmount + gasBuffer > balanceMotes;
    } else {
      // Compare token balance
      return parsedInputAmount > tokenBalance;
    }
  }, [isConnected, parsedInputAmount, direction, balance, tokenBalance]);

  // Check if pool has insufficient buffer for swap
  const insufficientBuffer = useMemo((): boolean => {
    if (!poolState || !quote || direction !== "token_to_cspr") return false;

    // For token -> CSPR swaps, check if buffer can cover the output
    return quote.amountOut > poolState.bufferCspr;
  }, [poolState, quote, direction]);

  // Can execute swap
  const canSwap = useMemo((): boolean => {
    return (
      isConnected &&
      !isLoading &&
      !isSwapping &&
      quote !== null &&
      quote.amountOut > BigInt(0) &&
      !insufficientBalance &&
      !insufficientBuffer &&
      !error
    );
  }, [isConnected, isLoading, isSwapping, quote, insufficientBalance, insufficientBuffer, error]);

  // Toggle swap direction
  const toggleDirection = useCallback(() => {
    setDirection((prev) =>
      prev === "cspr_to_token" ? "token_to_cspr" : "cspr_to_token"
    );
    setInputAmount("");
    setQuote(null);
    setError(null);
  }, []);

  // Execute swap
  const executeSwap = useCallback(async (): Promise<string | null> => {
    if (!canSwap || !quote || !publicKey) {
      return null;
    }

    setIsSwapping(true);
    setError(null);

    try {
      const senderPubKey = PublicKey.fromHex(publicKey);
      let deploy: unknown;

      if (direction === "cspr_to_token") {
        deploy = swapCsprForToken(senderPubKey, quote.amountIn, quote.minAmountOut);
      } else {
        deploy = swapTokenForCspr(senderPubKey, quote.amountIn, quote.minAmountOut);
      }

      // Sign the deploy
      const deployJson = JSON.stringify(deploy);
      const signature = await sign(deployJson);

      // Submit the signed deploy
      const deployHash = await poolClient.sendDeploy({ deploy, signature });

      // Wait for deploy to be processed
      await poolClient.waitForDeploy(deployHash);

      // Reset state on success
      setInputAmount("");
      setQuote(null);

      return deployHash;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Swap failed";
      setError(errorMessage);
      return null;
    } finally {
      setIsSwapping(false);
    }
  }, [canSwap, quote, publicKey, direction, swapCsprForToken, swapTokenForCspr, sign]);

  return {
    // State
    direction,
    inputAmount,
    quote,
    slippageTolerance,
    isLoading,
    isSwapping,
    error,

    // Derived state
    canSwap,
    insufficientBalance,
    insufficientBuffer,

    // Actions
    setDirection,
    toggleDirection,
    setInputAmount,
    setSlippageTolerance,
    executeSwap,
  };
}
