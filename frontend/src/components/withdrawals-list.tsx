"use client";

import { useState, useMemo } from "react";
import { Clock, CheckCircle, Inbox, RefreshCw } from "lucide-react";
import { PublicKey } from "casper-js-sdk";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WithdrawalCard } from "@/components/withdrawal-card";
import { useWithdrawals } from "@/hooks/use-withdrawals";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "pending" | "ready" | "claimed";

interface WithdrawalsListProps {
  userPublicKey?: string;
  publicKey: PublicKey | null;
  onSign: (deploy: unknown) => Promise<string | null>;
  className?: string;
}

export function WithdrawalsList({
  userPublicKey,
  publicKey,
  onSign,
  className,
}: WithdrawalsListProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const {
    withdrawals,
    pendingWithdrawals,
    readyWithdrawals,
    claimedWithdrawals,
    isLoading,
    error,
    claimWithdrawal,
    refreshWithdrawals,
  } = useWithdrawals(userPublicKey);

  const filteredWithdrawals = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return pendingWithdrawals;
      case "ready":
        return readyWithdrawals;
      case "claimed":
        return claimedWithdrawals;
      default:
        return withdrawals;
    }
  }, [activeTab, withdrawals, pendingWithdrawals, readyWithdrawals, claimedWithdrawals]);

  const tabs: { id: FilterTab; label: string; count: number; icon: React.ReactNode }[] = [
    { id: "all", label: "All", count: withdrawals.length, icon: null },
    { id: "pending", label: "Pending", count: pendingWithdrawals.length, icon: <Clock className="h-3 w-3" /> },
    { id: "ready", label: "Ready", count: readyWithdrawals.length, icon: <CheckCircle className="h-3 w-3" /> },
    { id: "claimed", label: "Claimed", count: claimedWithdrawals.length, icon: null },
  ];

  if (!userPublicKey) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Connect your wallet to view withdrawals</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Withdrawals</CardTitle>
            <CardDescription>
              Track and claim your pending withdrawals
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshWithdrawals}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-4 p-1 bg-muted rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-xs",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted-foreground/20"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            Failed to load withdrawals: {error.message}
          </div>
        )}

        {isLoading && withdrawals.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <EmptyState activeTab={activeTab} />
        ) : (
          <div className="grid gap-4">
            {filteredWithdrawals.map((withdrawal) => (
              <WithdrawalCard
                key={withdrawal.id}
                withdrawal={withdrawal}
                publicKey={publicKey}
                onClaim={claimWithdrawal}
                onSign={onSign}
                onRefresh={refreshWithdrawals}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ activeTab }: { activeTab: FilterTab }) {
  const messages: Record<FilterTab, { title: string; description: string }> = {
    all: {
      title: "No withdrawals",
      description: "You haven't made any withdrawal requests yet",
    },
    pending: {
      title: "No pending withdrawals",
      description: "All your withdrawals have completed unbonding",
    },
    ready: {
      title: "No withdrawals ready",
      description: "Check back when the unbonding period ends",
    },
    claimed: {
      title: "No claimed withdrawals",
      description: "Claimed withdrawals will appear here",
    },
  };

  return (
    <div className="py-12 text-center">
      <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <p className="font-medium">{messages[activeTab].title}</p>
      <p className="text-sm text-muted-foreground">{messages[activeTab].description}</p>
    </div>
  );
}
