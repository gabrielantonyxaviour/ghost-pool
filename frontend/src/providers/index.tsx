"use client";

import { ReactNode } from "react";
import { WalletProvider } from "./wallet-provider";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WalletProvider>
      {children}
      <Toaster />
    </WalletProvider>
  );
}
