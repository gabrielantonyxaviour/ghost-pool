"use client";

import { useWalletContext } from "@/providers/wallet-provider";

export function useWallet() {
  const {
    isConnected,
    isConnecting,
    publicKey,
    accountHash,
    balance,
    walletType,
    error,
    connect,
    disconnect,
    sign,
    refreshBalance,
    availableWallets,
    hasMetaMask,
    network,
    setNetwork,
  } = useWalletContext();

  const truncatedAddress = publicKey && typeof publicKey === 'string'
    ? `${publicKey.slice(0, 8)}...${publicKey.slice(-6)}`
    : null;

  const hasWalletExtension = availableWallets.length > 0;

  return {
    isConnected,
    isConnecting,
    publicKey,
    accountHash,
    balance,
    walletType,
    error,
    truncatedAddress,
    hasWalletExtension,
    hasMetaMask,
    availableWallets,
    network,
    setNetwork,

    connect,
    disconnect,
    sign,
    refreshBalance,
  };
}
