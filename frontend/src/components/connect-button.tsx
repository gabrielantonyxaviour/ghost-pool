"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Wallet, ChevronDown, LogOut, Copy, ExternalLink, Droplets, Loader2, CheckCircle, XCircle } from "lucide-react";

const walletDisplayNames: Record<string, string> = {
  "casper-wallet": "Casper Wallet",
  "casper-signer": "Casper Signer",
  "metamask-snap": "MetaMask (Casper Snap)",
};

const LOCALNET_EXPLORER_URL = "http://localhost:8080";

export function ConnectButton() {
  const {
    isConnected,
    isConnecting,
    truncatedAddress,
    balance,
    walletType,
    error,
    hasWalletExtension,
    hasMetaMask,
    availableWallets,
    connect,
    disconnect,
    publicKey,
    network,
    refreshBalance,
  } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDripping, setIsDripping] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowWalletSelect(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = async (type?: "casper-signer" | "casper-wallet" | "metamask-snap" | null) => {
    setShowWalletSelect(false);
    await connect(type);
  };

  const handleFaucetDrip = async () => {
    if (!publicKey || isDripping) return;

    setIsDripping(true);
    try {
      const response = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, amount: 1000 }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Faucet drip successful!", {
          description: `Received ${data.amount} CSPR`,
          icon: <CheckCircle className="h-5 w-5 text-primary" />,
          duration: 10000,
          action: {
            label: "View TX",
            onClick: () => window.open(`${LOCALNET_EXPLORER_URL}/deploy/${data.deployHash}`, "_blank"),
          },
        });
        // Refresh balance after a short delay
        setTimeout(() => refreshBalance(), 2000);
      } else {
        toast.error("Faucet drip failed", {
          description: data.error || "Unknown error",
          icon: <XCircle className="h-5 w-5 text-destructive" />,
        });
      }
    } catch (err) {
      toast.error("Faucet drip failed", {
        description: "Could not connect to faucet",
        icon: <XCircle className="h-5 w-5 text-destructive" />,
      });
    } finally {
      setIsDripping(false);
    }
  };

  if (!hasWalletExtension) {
    return (
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          <Wallet className="h-4 w-4" />
          Install Wallet
          <ChevronDown className="h-3 w-3" />
        </Button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 rounded-md border bg-popover p-2 shadow-md z-50">
            <p className="text-sm text-muted-foreground mb-3 px-2">
              No Casper wallet detected. Install one:
            </p>
            <a
              href="https://www.casperwallet.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Casper Wallet
            </a>
            <a
              href="https://chrome.google.com/webstore/detail/casper-signer/djhndpllfiibmcdbnmaaahkhchcoijce"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Casper Signer
            </a>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              MetaMask (with Casper Snap)
            </a>
          </div>
        )}
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          {balance && (
            <span className="text-muted-foreground">{balance} CSPR</span>
          )}
          <span className="font-mono">{truncatedAddress}</span>
        </Button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-md border bg-popover shadow-md z-50">
            <div className="p-1">
              <button
                onClick={handleCopyAddress}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied!" : "Copy Address"}
              </button>

              {network === "localnet" && (
                <button
                  onClick={handleFaucetDrip}
                  disabled={isDripping}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {isDripping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Droplets className="h-4 w-4" />
                  )}
                  {isDripping ? "Dripping..." : "Faucet"}
                </button>
              )}

              <button
                onClick={() => {
                  disconnect();
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (availableWallets.length > 1 && showWalletSelect) {
    return (
      <div className="relative" ref={dropdownRef}>
        <Button variant="outline" disabled className="gap-2">
          <Wallet className="h-4 w-4" />
          Select Wallet
        </Button>

        <div className="absolute right-0 mt-2 w-64 rounded-md border bg-popover p-1 shadow-md z-50">
          {availableWallets.map((wallet) => (
            <button
              key={wallet}
              onClick={() => handleConnect(wallet)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Wallet className="h-4 w-4" />
              {wallet ? walletDisplayNames[wallet] : "Unknown"}
            </button>
          ))}
          <button
            onClick={() => setShowWalletSelect(false)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => {
          if (availableWallets.length > 1) {
            setShowWalletSelect(true);
          } else {
            handleConnect();
          }
        }}
        disabled={isConnecting}
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>

      {error && (
        <div className="absolute right-0 mt-2 w-64 rounded-md border border-destructive bg-popover p-3 shadow-md z-50">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
