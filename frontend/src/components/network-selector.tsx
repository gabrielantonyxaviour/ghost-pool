"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { ChevronDown, Globe, Server, Wifi } from "lucide-react";
import type { CasperNetwork } from "@/providers/wallet-provider";

const networkConfig: Record<CasperNetwork, { label: string; icon: typeof Globe; color: string; disabled?: boolean }> = {
  localnet: { label: "Localnet", icon: Server, color: "text-yellow-500" },
  testnet: { label: "Testnet", icon: Wifi, color: "text-blue-500", disabled: true },
  mainnet: { label: "Mainnet", icon: Globe, color: "text-green-500", disabled: true },
};

export function NetworkSelector() {
  const { network, setNetwork } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentNetwork = networkConfig[network];
  const Icon = currentNetwork.icon;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNetworkChange = (newNetwork: CasperNetwork) => {
    setNetwork(newNetwork);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <Icon className={`h-4 w-4 ${currentNetwork.color}`} />
        <span className="hidden sm:inline">{currentNetwork.label}</span>
        <ChevronDown className="h-3 w-3" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md border bg-popover shadow-md z-50">
          <div className="p-1">
            {(Object.keys(networkConfig) as CasperNetwork[]).map((net) => {
              const config = networkConfig[net];
              const NetworkIcon = config.icon;
              const isSelected = net === network;
              const isDisabled = config.disabled;

              return (
                <button
                  key={net}
                  onClick={() => !isDisabled && handleNetworkChange(net)}
                  disabled={isDisabled}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                    isSelected ? "bg-accent" : isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"
                  }`}
                >
                  <NetworkIcon className={`h-4 w-4 ${isDisabled ? "text-muted-foreground" : config.color}`} />
                  {config.label}
                  {isSelected && (
                    <span className="ml-auto text-xs text-muted-foreground">Active</span>
                  )}
                  {isDisabled && !isSelected && (
                    <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
