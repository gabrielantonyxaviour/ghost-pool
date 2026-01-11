"use client";

import { useState } from "react";
import { ExternalLink, Clock, CheckCircle, Loader2, XCircle } from "lucide-react";
import { PublicKey } from "casper-js-sdk";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { WithdrawalWithStatus, formatTimeRemaining, formatTimestamp } from "@/hooks/use-withdrawals";
import { motesToCspr, GAS_COSTS, NETWORK_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface WithdrawalCardProps {
  withdrawal: WithdrawalWithStatus;
  publicKey: PublicKey | null;
  onClaim: (senderPubKey: PublicKey, withdrawalId: number) => unknown;
  onSign: (deploy: unknown) => Promise<string | null>;
  onRefresh: () => Promise<void>;
}

export function WithdrawalCard({
  withdrawal,
  publicKey,
  onClaim,
  onSign,
  onRefresh,
}: WithdrawalCardProps) {
  const [isClaiming, setIsClaiming] = useState(false);

  const csprAmount = motesToCspr(withdrawal.csprAmount);
  const tokenAmount = motesToCspr(withdrawal.tokenAmount);
  const gasEstimate = Number(GAS_COSTS.CLAIM_WITHDRAWAL) / 1e9;

  const explorerUrl = NETWORK_NAME === "casper-test"
    ? `https://testnet.cspr.live/deploy`
    : `https://cspr.live/deploy`;

  const handleClaim = async () => {
    if (!publicKey) return;

    setIsClaiming(true);
    const toastId = toast.loading("Claiming withdrawal...", {
      description: "Please confirm the transaction in your wallet",
      icon: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
    });

    try {
      const deploy = onClaim(publicKey, withdrawal.id);
      const deployHash = await onSign(deploy);

      toast.dismiss(toastId);

      if (deployHash) {
        toast.success("Withdrawal claimed!", {
          description: `Transaction submitted: ${deployHash.slice(0, 8)}...`,
          icon: <CheckCircle className="h-5 w-5 text-primary" />,
        });
        await onRefresh();
      } else {
        toast.error("Claim cancelled", {
          description: "Transaction was not signed",
          icon: <XCircle className="h-5 w-5 text-destructive" />,
        });
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Claim failed", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
        icon: <XCircle className="h-5 w-5 text-destructive" />,
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const statusBadge = {
    pending: (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    ),
    ready: (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
        <CheckCircle className="h-3 w-3" />
        Ready to Claim
      </span>
    ),
    claimed: (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        <CheckCircle className="h-3 w-3" />
        Claimed
      </span>
    ),
  };

  return (
    <Card className={cn(
      "transition-all duration-200",
      withdrawal.status === "ready" && "ring-2 ring-green-500/50",
      withdrawal.status === "claimed" && "opacity-60"
    )}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">ID #{withdrawal.id}</span>
            {statusBadge[withdrawal.status]}
          </div>
          <a
            href={`${explorerUrl}/${withdrawal.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">CSPR Amount</p>
            <p className="text-lg font-semibold">{csprAmount.toFixed(4)} CSPR</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Token Amount</p>
            <p className="text-lg font-semibold">{tokenAmount.toFixed(4)}</p>
          </div>
        </div>

        {/* Progress bar for pending withdrawals */}
        {withdrawal.status === "pending" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Unbonding progress</span>
              <span className="font-medium">{withdrawal.progress.toFixed(1)}%</span>
            </div>
            <Progress value={withdrawal.progress} />
            <p className="text-sm text-center text-muted-foreground">
              {formatTimeRemaining(withdrawal.timeRemainingMs)}
            </p>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Requested: {formatTimestamp(withdrawal.requestTime)}</p>
          <p>Claimable: {formatTimestamp(withdrawal.claimableTime)}</p>
        </div>

        {/* Claim button */}
        {withdrawal.status === "ready" && (
          <div className="space-y-2">
            <Button
              onClick={handleClaim}
              disabled={isClaiming || !publicKey}
              className="w-full"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                "Claim Withdrawal"
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Estimated gas: ~{gasEstimate} CSPR
            </p>
          </div>
        )}

        {withdrawal.status === "pending" && (
          <Tooltip content="Withdrawal is still in unbonding period">
            <Button disabled className="w-full">
              <Clock className="h-4 w-4" />
              Claim Withdrawal
            </Button>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  );
}
