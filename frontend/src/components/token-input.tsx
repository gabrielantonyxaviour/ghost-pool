"use client";

/**
 * Reusable token input component with token icon, amount input, max button, and balance display
 */

import { useCallback, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TokenInputProps {
  /** Token symbol (e.g., "CSPR", "GHOST") */
  symbol: string;
  /** Current input value */
  value: string;
  /** Called when input value changes */
  onChange: (value: string) => void;
  /** User's balance of this token (formatted string) */
  balance?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether this is a read-only output field */
  readOnly?: boolean;
  /** Label for the input (e.g., "From", "To") */
  label?: string;
  /** Optional USD value to display */
  usdValue?: string;
  /** Loading state for output fields */
  isLoading?: boolean;
  /** Additional className */
  className?: string;
}

export function TokenInput({
  symbol,
  value,
  onChange,
  balance,
  disabled = false,
  readOnly = false,
  label,
  usdValue,
  isLoading = false,
  className,
}: TokenInputProps) {
  // Handle input change - only allow valid numeric input
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty string
      if (inputValue === "") {
        onChange("");
        return;
      }

      // Validate numeric input (allow decimals)
      const regex = /^[0-9]*\.?[0-9]*$/;
      if (regex.test(inputValue)) {
        // Prevent leading zeros (except for "0." pattern)
        if (inputValue.length > 1 && inputValue[0] === "0" && inputValue[1] !== ".") {
          onChange(inputValue.slice(1));
        } else {
          onChange(inputValue);
        }
      }
    },
    [onChange]
  );

  // Handle max button click
  const handleMax = useCallback(() => {
    if (balance) {
      // For CSPR, leave some for gas
      if (symbol === "CSPR") {
        const balanceNum = parseFloat(balance);
        const maxAmount = Math.max(0, balanceNum - 5); // Leave 5 CSPR for gas
        onChange(maxAmount > 0 ? maxAmount.toString() : "0");
      } else {
        onChange(balance);
      }
    }
  }, [balance, symbol, onChange]);

  // Get token icon based on symbol
  const getTokenIcon = (tokenSymbol: string) => {
    switch (tokenSymbol.toUpperCase()) {
      case "CSPR":
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-red-500 font-bold text-sm">C</span>
          </div>
        );
      case "GHOST":
        return (
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
            <span className="text-purple-500 font-bold text-sm">G</span>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground font-bold text-sm">
              {tokenSymbol[0]?.toUpperCase()}
            </span>
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        disabled && "opacity-50",
        className
      )}
    >
      {/* Label row */}
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          {balance !== undefined && (
            <span className="text-sm text-muted-foreground">
              Balance: {balance}
            </span>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-3">
        {/* Token selector */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary">
          {getTokenIcon(symbol)}
          <span className="font-medium">{symbol}</span>
        </div>

        {/* Amount input */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="h-10 flex items-center">
              <div className="w-20 h-6 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              pattern="^[0-9]*[.,]?[0-9]*$"
              placeholder="0.0"
              value={value}
              onChange={handleChange}
              disabled={disabled || readOnly}
              readOnly={readOnly}
              className={cn(
                "w-full bg-transparent text-2xl font-medium outline-none",
                "placeholder:text-muted-foreground/50",
                readOnly && "cursor-default"
              )}
            />
          )}
        </div>

        {/* Max button (only show for input fields) */}
        {!readOnly && balance && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMax}
            disabled={disabled}
            className="text-primary hover:text-primary/80"
          >
            MAX
          </Button>
        )}
      </div>

      {/* USD value (if provided) */}
      {usdValue && (
        <div className="mt-2 text-sm text-muted-foreground">
          ~${usdValue}
        </div>
      )}
    </div>
  );
}
