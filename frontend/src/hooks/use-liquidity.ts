"use client";

/**
 * Hook for liquidity management in Ghost Pool AMM
 */

import { useState, useCallback, useEffect } from "react";
import { PublicKey } from "casper-js-sdk";
import { usePool } from "./use-pool";
import { useWallet } from "./use-wallet";
import { tokenClient } from "@/lib/token-client";
import { poolClient, LpValue } from "@/lib/pool-client";
import { POOL_CONTRACT_HASH } from "@/lib/constants";

export interface UserPosition {
  lpBalance: bigint;
  csprValue: bigint;
  tokenValue: bigint;
  poolSharePercent: number;
}

export interface UseLiquidityReturn {
  // User position
  userPosition: UserPosition | null;
  isLoadingPosition: boolean;

  // Token allowance
  tokenAllowance: bigint;
  needsApproval: (tokenAmount: bigint) => boolean;
  isApproving: boolean;
  approveError: string | null;
  approveTokens: (amount: bigint) => Promise<string | null>;

  // Add liquidity
  calculateOptimalAmounts: (
    inputAmount: bigint,
    isCsprInput: boolean
  ) => { csprAmount: bigint; tokenAmount: bigint };
  calculateExpectedLp: (csprAmount: bigint, tokenAmount: bigint) => bigint;
  calculatePoolShareAfterAdd: (lpToReceive: bigint) => number;
  isAddingLiquidity: boolean;
  addLiquidityError: string | null;
  addLiquidity: (
    csprAmount: bigint,
    tokenAmount: bigint,
    slippageBps?: number
  ) => Promise<string | null>;

  // Remove liquidity
  calculateRemoveAmounts: (
    lpAmount: bigint
  ) => { csprAmount: bigint; tokenAmount: bigint };
  isRemovingLiquidity: boolean;
  removeLiquidityError: string | null;
  removeLiquidity: (
    lpAmount: bigint,
    slippageBps?: number
  ) => Promise<string | null>;

  // LP token info
  totalLpSupply: bigint;

  // Refresh
  refreshPosition: () => Promise<void>;
  refreshAllowance: () => Promise<void>;
}

export function useLiquidity(): UseLiquidityReturn {
  const { poolState, addLiquidity: buildAddLiquidityDeploy, removeLiquidity: buildRemoveLiquidityDeploy, approveToken: buildApproveDeploy, refreshPoolState } = usePool();
  const { publicKey, sign, isConnected } = useWallet();

  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [tokenAllowance, setTokenAllowance] = useState<bigint>(BigInt(0));
  // Note: setTotalLpSupply will be used when LP supply fetching is implemented
  const [totalLpSupply, _setTotalLpSupply] = useState<bigint>(BigInt(0));

  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [addLiquidityError, setAddLiquidityError] = useState<string | null>(null);
  const [isRemovingLiquidity, setIsRemovingLiquidity] = useState(false);
  const [removeLiquidityError, setRemoveLiquidityError] = useState<string | null>(null);

  // Fetch user position
  const fetchUserPosition = useCallback(async () => {
    if (!publicKey || !isConnected) {
      setUserPosition(null);
      return;
    }

    setIsLoadingPosition(true);
    try {
      // In a real implementation, these would fetch from the contract
      // For now, return mock data
      const lpBalance = BigInt(0);
      const lpValue: LpValue = await poolClient.getLpValue(lpBalance);

      let poolSharePercent = 0;
      if (totalLpSupply > BigInt(0)) {
        poolSharePercent = Number((lpBalance * BigInt(10000)) / totalLpSupply) / 100;
      }

      setUserPosition({
        lpBalance,
        csprValue: lpValue.csprValue,
        tokenValue: lpValue.tokenValue,
        poolSharePercent,
      });
    } catch (error) {
      console.error("Failed to fetch user position:", error);
    } finally {
      setIsLoadingPosition(false);
    }
  }, [publicKey, isConnected, totalLpSupply]);

  // Fetch token allowance
  const fetchAllowance = useCallback(async () => {
    if (!publicKey || !isConnected) {
      setTokenAllowance(BigInt(0));
      return;
    }

    try {
      const allowance = await tokenClient.allowance(publicKey, POOL_CONTRACT_HASH);
      setTokenAllowance(allowance);
    } catch (error) {
      console.error("Failed to fetch token allowance:", error);
    }
  }, [publicKey, isConnected]);

  // Initial fetch
  useEffect(() => {
    fetchUserPosition();
    fetchAllowance();
  }, [fetchUserPosition, fetchAllowance]);

  // Check if approval is needed
  const needsApproval = useCallback(
    (tokenAmount: bigint): boolean => {
      return tokenAllowance < tokenAmount;
    },
    [tokenAllowance]
  );

  // Calculate optimal amounts based on current pool ratio
  const calculateOptimalAmounts = useCallback(
    (inputAmount: bigint, isCsprInput: boolean): { csprAmount: bigint; tokenAmount: bigint } => {
      if (!poolState || poolState.reserveCspr === BigInt(0) || poolState.reserveToken === BigInt(0)) {
        // First liquidity provider can set any ratio
        return { csprAmount: inputAmount, tokenAmount: inputAmount };
      }

      if (isCsprInput) {
        // User entered CSPR amount, calculate required token amount
        const tokenAmount = (inputAmount * poolState.reserveToken) / poolState.reserveCspr;
        return { csprAmount: inputAmount, tokenAmount };
      } else {
        // User entered token amount, calculate required CSPR amount
        const csprAmount = (inputAmount * poolState.reserveCspr) / poolState.reserveToken;
        return { csprAmount, tokenAmount: inputAmount };
      }
    },
    [poolState]
  );

  // Calculate expected LP tokens to receive
  const calculateExpectedLp = useCallback(
    (csprAmount: bigint, tokenAmount: bigint): bigint => {
      if (!poolState) return BigInt(0);

      // If pool is empty, LP = sqrt(csprAmount * tokenAmount)
      if (poolState.reserveCspr === BigInt(0) || poolState.reserveToken === BigInt(0)) {
        // Simple approximation: sqrt using BigInt
        const product = csprAmount * tokenAmount;
        return sqrt(product);
      }

      // LP = min(csprAmount * totalSupply / reserveCspr, tokenAmount * totalSupply / reserveToken)
      if (totalLpSupply === BigInt(0)) {
        return sqrt(csprAmount * tokenAmount);
      }

      const lpFromCspr = (csprAmount * totalLpSupply) / poolState.reserveCspr;
      const lpFromToken = (tokenAmount * totalLpSupply) / poolState.reserveToken;

      return lpFromCspr < lpFromToken ? lpFromCspr : lpFromToken;
    },
    [poolState, totalLpSupply]
  );

  // Calculate pool share after adding liquidity
  const calculatePoolShareAfterAdd = useCallback(
    (lpToReceive: bigint): number => {
      const newTotalSupply = totalLpSupply + lpToReceive;
      if (newTotalSupply === BigInt(0)) return 100;

      const currentLp = userPosition?.lpBalance ?? BigInt(0);
      const newLpBalance = currentLp + lpToReceive;

      return Number((newLpBalance * BigInt(10000)) / newTotalSupply) / 100;
    },
    [totalLpSupply, userPosition]
  );

  // Calculate amounts to receive when removing liquidity
  const calculateRemoveAmounts = useCallback(
    (lpAmount: bigint): { csprAmount: bigint; tokenAmount: bigint } => {
      if (!poolState || totalLpSupply === BigInt(0)) {
        return { csprAmount: BigInt(0), tokenAmount: BigInt(0) };
      }

      const csprAmount = (lpAmount * poolState.reserveCspr) / totalLpSupply;
      const tokenAmount = (lpAmount * poolState.reserveToken) / totalLpSupply;

      return { csprAmount, tokenAmount };
    },
    [poolState, totalLpSupply]
  );

  // Approve tokens
  const approveTokens = useCallback(
    async (amount: bigint): Promise<string | null> => {
      if (!publicKey || !isConnected) {
        setApproveError("Wallet not connected");
        return null;
      }

      setIsApproving(true);
      setApproveError(null);

      try {
        const senderPubKey = PublicKey.fromHex(publicKey);
        const deploy = buildApproveDeploy(senderPubKey, amount);

        const deployJson = JSON.stringify(deploy);
        const signature = await sign(deployJson);

        // In real implementation, attach signature and send deploy
        const deployHash = await poolClient.sendDeploy({ deploy, signature });
        await poolClient.waitForDeploy(deployHash);

        await fetchAllowance();
        return deployHash;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to approve tokens";
        setApproveError(message);
        return null;
      } finally {
        setIsApproving(false);
      }
    },
    [publicKey, isConnected, buildApproveDeploy, sign, fetchAllowance]
  );

  // Add liquidity
  const addLiquidity = useCallback(
    async (csprAmount: bigint, tokenAmount: bigint, slippageBps: number = 50): Promise<string | null> => {
      if (!publicKey || !isConnected) {
        setAddLiquidityError("Wallet not connected");
        return null;
      }

      setIsAddingLiquidity(true);
      setAddLiquidityError(null);

      try {
        const expectedLp = calculateExpectedLp(csprAmount, tokenAmount);
        const minLp = (expectedLp * BigInt(10000 - slippageBps)) / BigInt(10000);

        const senderPubKey = PublicKey.fromHex(publicKey);
        const deploy = buildAddLiquidityDeploy(senderPubKey, csprAmount, tokenAmount, minLp);

        const deployJson = JSON.stringify(deploy);
        const signature = await sign(deployJson);

        const deployHash = await poolClient.sendDeploy({ deploy, signature });
        await poolClient.waitForDeploy(deployHash);

        await Promise.all([refreshPoolState(), fetchUserPosition()]);
        return deployHash;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add liquidity";
        setAddLiquidityError(message);
        return null;
      } finally {
        setIsAddingLiquidity(false);
      }
    },
    [publicKey, isConnected, calculateExpectedLp, buildAddLiquidityDeploy, sign, refreshPoolState, fetchUserPosition]
  );

  // Remove liquidity
  const removeLiquidity = useCallback(
    async (lpAmount: bigint, slippageBps: number = 50): Promise<string | null> => {
      if (!publicKey || !isConnected) {
        setRemoveLiquidityError("Wallet not connected");
        return null;
      }

      setIsRemovingLiquidity(true);
      setRemoveLiquidityError(null);

      try {
        const { csprAmount, tokenAmount } = calculateRemoveAmounts(lpAmount);
        const minCspr = (csprAmount * BigInt(10000 - slippageBps)) / BigInt(10000);
        const minToken = (tokenAmount * BigInt(10000 - slippageBps)) / BigInt(10000);

        const senderPubKey = PublicKey.fromHex(publicKey);
        const deploy = buildRemoveLiquidityDeploy(senderPubKey, lpAmount, minCspr, minToken);

        const deployJson = JSON.stringify(deploy);
        const signature = await sign(deployJson);

        const deployHash = await poolClient.sendDeploy({ deploy, signature });
        await poolClient.waitForDeploy(deployHash);

        await Promise.all([refreshPoolState(), fetchUserPosition()]);
        return deployHash;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove liquidity";
        setRemoveLiquidityError(message);
        return null;
      } finally {
        setIsRemovingLiquidity(false);
      }
    },
    [publicKey, isConnected, calculateRemoveAmounts, buildRemoveLiquidityDeploy, sign, refreshPoolState, fetchUserPosition]
  );

  return {
    userPosition,
    isLoadingPosition,
    tokenAllowance,
    needsApproval,
    isApproving,
    approveError,
    approveTokens,
    calculateOptimalAmounts,
    calculateExpectedLp,
    calculatePoolShareAfterAdd,
    isAddingLiquidity,
    addLiquidityError,
    addLiquidity,
    calculateRemoveAmounts,
    isRemovingLiquidity,
    removeLiquidityError,
    removeLiquidity,
    totalLpSupply,
    refreshPosition: fetchUserPosition,
    refreshAllowance: fetchAllowance,
  };
}

/**
 * BigInt square root using Newton's method
 */
function sqrt(value: bigint): bigint {
  if (value < BigInt(0)) {
    throw new Error("Square root of negative numbers is not supported");
  }
  if (value < BigInt(2)) {
    return value;
  }

  let x = value;
  let y = (x + BigInt(1)) / BigInt(2);
  while (y < x) {
    x = y;
    y = (x + value / x) / BigInt(2);
  }
  return x;
}
