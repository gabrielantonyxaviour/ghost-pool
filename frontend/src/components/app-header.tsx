"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/connect-button";
import { NetworkSelector } from "@/components/network-selector";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Swap" },
    { href: "/pools", label: "Pools" },
    { href: "/stake", label: "Stake" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto">
        <Link href="/" className="flex items-center">
          <Image
            src="/ghost-pool-text.png"
            alt="Ghost Pool"
            width={100}
            height={24}
            priority
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === link.href
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <NetworkSelector />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
