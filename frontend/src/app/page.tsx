"use client";

import { useState } from "react";
import { Swap } from "@/components/swap";
import { AddLiquidity } from "@/components/add-liquidity";
import { RemoveLiquidity } from "@/components/remove-liquidity";
import { WithdrawalsList } from "@/components/withdrawals-list";
import { PoolStats } from "@/components/pool-stats";
import { StakingStats } from "@/components/staking-stats";
import { ApyDisplay } from "@/components/apy-display";
import { useWallet } from "@/hooks/use-wallet";
import { PublicKey } from "casper-js-sdk";
import { cn } from "@/lib/utils";
import { ArrowRightLeft, Droplets, Clock } from "lucide-react";

type Tab = "swap" | "liquidity" | "withdrawals";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("swap");
  const { publicKey, sign } = useWallet();

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "swap", label: "Swap", icon: <ArrowRightLeft className="h-4 w-4" /> },
    { id: "liquidity", label: "Liquidity", icon: <Droplets className="h-4 w-4" /> },
    { id: "withdrawals", label: "Withdrawals", icon: <Clock className="h-4 w-4" /> },
  ];

  // Get public key object for components that need it
  const pubKeyObj = publicKey ? PublicKey.newPublicKey(publicKey) : null;

  // Handler for signing deploys
  const handleSign = async (deploy: unknown): Promise<string | null> => {
    try {
      // Serialize deploy to JSON for wallet signing
      const deployJson = typeof deploy === "string" ? deploy : JSON.stringify(deploy);
      const hash = await sign(deployJson);
      return hash;
    } catch (err) {
      console.error("Failed to sign deploy:", err);
      return null;
    }
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Hero section */}
      <div className="text-center space-y-4 pt-8 pb-6 px-4">
        <h1 className="text-3xl font-bold tracking-tight">Ghost Pool AMM</h1>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          Auto-staking liquidity pool for Casper Network 2.0. Earn swap fees +
          staking rewards.
        </p>
        <ApyDisplay compact className="mx-auto w-fit" />
      </div>

      {/* Pool stats */}
      <div className="max-w-6xl mx-auto px-4 mb-6">
        <PoolStats />
      </div>

      {/* Main content area */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main panel with tabs */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tab navigation */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div>
              {activeTab === "swap" && <Swap />}
              {activeTab === "liquidity" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <AddLiquidity />
                  <RemoveLiquidity />
                </div>
              )}
              {activeTab === "withdrawals" && (
                <WithdrawalsList
                  userPublicKey={publicKey || undefined}
                  publicKey={pubKeyObj}
                  onSign={handleSign}
                />
              )}
            </div>
          </div>

          {/* Sidebar with staking stats */}
          <div className="space-y-4">
            <StakingStats />
            <ApyDisplay />
          </div>
        </div>
      </div>
    </div>
  );
}
