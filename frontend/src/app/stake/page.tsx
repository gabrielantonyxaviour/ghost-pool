"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { usePoolStats, formatCspr } from "@/hooks/use-pool-stats";
import { useWallet } from "@/hooks/use-wallet";
import { usePool } from "@/hooks/use-pool";
import { DEFAULT_BUFFER_TARGET_BPS } from "@/lib/constants";
import { PublicKey } from "casper-js-sdk";
import {
  Lock,
  Unlock,
  TrendingUp,
  Zap,
  RefreshCw,
  Loader2,
  CheckCircle,
  ExternalLink,
  Info,
  ArrowRight,
  Wallet,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import Link from "next/link";

type StakeTab = "stake" | "unstake";

export default function StakePage() {
  const { stats, isLoading: statsLoading, refresh } = usePoolStats();
  const { isConnected, publicKey, sign } = useWallet();
  const { compound } = usePool();

  const [activeTab, setActiveTab] = useState<StakeTab>("stake");
  const [isCompounding, setIsCompounding] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate staking stats
  const totalStaked = stats ? stats.stakedCspr + stats.bufferCspr : BigInt(0);
  const stakedPercentage = stats
    ? (Number(stats.stakedCspr) / Number(totalStaked || BigInt(1))) * 100
    : 90;
  const bufferPercentage = 100 - stakedPercentage;
  const targetBufferPercentage = DEFAULT_BUFFER_TARGET_BPS / 100;

  // Buffer status
  const bufferStatus =
    bufferPercentage > targetBufferPercentage + 5
      ? "high"
      : bufferPercentage < targetBufferPercentage - 5
      ? "low"
      : "normal";

  // Handle compound rewards
  const handleCompound = async () => {
    if (!publicKey) return;

    try {
      setIsCompounding(true);
      setError(null);
      setTxHash(null);

      const pubKey = PublicKey.newPublicKey(publicKey);
      const deploy = compound(pubKey);
      const deployJson = JSON.stringify(deploy);
      const hash = await sign(deployJson);
      if (hash) {
        setTxHash(hash);
        await refresh();
      }
    } catch (err) {
      console.error("Compound failed:", err);
      setError(err instanceof Error ? err.message : "Failed to compound rewards");
    } finally {
      setIsCompounding(false);
    }
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="text-center space-y-4 pt-8 pb-6 px-4">
        <h1 className="text-3xl font-bold tracking-tight">Stake CSPR</h1>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          Earn staking rewards by providing liquidity. Your CSPR is automatically
          staked to validators, earning ~9% APY on top of swap fees.
        </p>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Staking stats */}
          <div className="space-y-4">
            {/* APY Card */}
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardContent className="py-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Current APY</span>
                  </div>
                  <Tooltip content="Combined yield from swap fees (0.3%) + native Casper staking rewards (~9%)">
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <div className="text-4xl font-bold text-green-500 mb-2">
                  {stats?.combinedApy.toFixed(2) || "9.00"}%
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Staking: ~{stats?.stakingApy.toFixed(1) || "8.1"}%</span>
                  <span>Fees: ~{stats?.swapFeeApy.toFixed(1) || "0"}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Staking breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Staking Overview</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refresh}
                    disabled={statsLoading}
                  >
                    <RefreshCw
                      className={cn("h-4 w-4", statsLoading && "animate-spin")}
                    />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Staked vs Buffer */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className="h-4 w-4 text-blue-500" />
                      <span className="text-xs text-muted-foreground">Staked</span>
                    </div>
                    <div className="text-lg font-semibold">
                      {stats ? formatCspr(stats.stakedCspr) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stakedPercentage.toFixed(1)}% of pool
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Unlock className="h-4 w-4 text-orange-500" />
                      <span className="text-xs text-muted-foreground">Buffer</span>
                    </div>
                    <div className="text-lg font-semibold">
                      {stats ? formatCspr(stats.bufferCspr) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {bufferPercentage.toFixed(1)}% of pool
                    </div>
                  </div>
                </div>

                {/* Buffer level bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Buffer Level</span>
                    <span
                      className={cn(
                        bufferStatus === "high"
                          ? "text-yellow-500"
                          : bufferStatus === "low"
                          ? "text-red-500"
                          : "text-green-500"
                      )}
                    >
                      {bufferPercentage.toFixed(1)}% / {targetBufferPercentage}% target
                    </span>
                  </div>
                  <Progress
                    value={Math.min(bufferPercentage * 10, 100)}
                    className={cn(
                      "h-2",
                      bufferStatus === "high"
                        ? "[&>div]:bg-yellow-500"
                        : bufferStatus === "low"
                        ? "[&>div]:bg-red-500"
                        : "[&>div]:bg-green-500"
                    )}
                  />
                </div>

                {/* Pending rewards */}
                <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm">Pending Rewards</span>
                    </div>
                    <span className="font-semibold">
                      {stats?.pendingRewards && stats.pendingRewards > BigInt(0)
                        ? formatCspr(stats.pendingRewards)
                        : "0 CSPR"}
                    </span>
                  </div>
                </div>

                {/* Compound button */}
                <Button
                  onClick={handleCompound}
                  disabled={!isConnected || isCompounding || statsLoading}
                  variant="outline"
                  className="w-full"
                >
                  {isCompounding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Compounding...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Compound Rewards
                    </>
                  )}
                </Button>

                {/* Success/Error messages */}
                {txHash && (
                  <div className="p-3 rounded-lg bg-green-500/10 text-green-500 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Transaction submitted!</span>
                    </div>
                    <a
                      href={`https://testnet.cspr.live/deploy/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs mt-1 hover:underline"
                    >
                      View on explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Stake/Unstake interface */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                  {(["stake", "unstake"] as StakeTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize",
                        activeTab === tab
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeTab === "stake" ? (
                  <>
                    <div className="text-center py-8 space-y-4">
                      <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto">
                        <Lock className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Stake via Liquidity</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                          To stake CSPR and earn rewards, add liquidity to the CSPR/GHOST
                          pool. 90% of your CSPR will be automatically staked.
                        </p>
                      </div>
                      <Link href="/?tab=liquidity">
                        <Button className="gap-2">
                          Add Liquidity
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-medium text-sm">Benefits</h4>
                      <div className="grid gap-2">
                        <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                          <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-medium">~9% Staking APY</span>
                            <p className="text-muted-foreground text-xs">
                              Earn native Casper staking rewards
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                          <Wallet className="h-4 w-4 text-blue-500 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-medium">0.3% Swap Fees</span>
                            <p className="text-muted-foreground text-xs">
                              Earn fees from every swap in the pool
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                          <Zap className="h-4 w-4 text-yellow-500 mt-0.5" />
                          <div className="text-sm">
                            <span className="font-medium">Auto-Compound</span>
                            <p className="text-muted-foreground text-xs">
                              Anyone can compound rewards for the pool
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center py-8 space-y-4">
                      <div className="p-4 rounded-full bg-orange-500/10 w-fit mx-auto">
                        <Unlock className="h-8 w-8 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Unstake via Withdrawals</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                          To unstake, remove liquidity from the pool. CSPR has a 14-hour
                          unbonding period from Casper staking.
                        </p>
                      </div>
                      <Link href="/?tab=liquidity">
                        <Button variant="outline" className="gap-2">
                          Remove Liquidity
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>

                    {/* Withdrawal process */}
                    <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-medium text-sm">Withdrawal Process</h4>
                      <div className="space-y-2">
                        <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground font-bold">
                            1
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Remove Liquidity</span>
                            <p className="text-muted-foreground text-xs">
                              Burn LP tokens and receive GHOST immediately
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                          <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-xs text-primary-foreground font-bold">
                            2
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Wait 14 Hours</span>
                            <p className="text-muted-foreground text-xs">
                              CSPR unbonds from Casper staking
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-xs text-primary-foreground font-bold">
                            3
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Claim CSPR</span>
                            <p className="text-muted-foreground text-xs">
                              Claim your CSPR from the Withdrawals tab
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Security note */}
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="py-4">
                <div className="flex gap-3">
                  <Shield className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <span className="font-medium text-blue-500">Secure Staking</span>
                    <p className="text-muted-foreground mt-1">
                      Your CSPR is staked through Casper's native staking system via
                      trusted validators. The smart contract handles all delegation
                      automatically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
