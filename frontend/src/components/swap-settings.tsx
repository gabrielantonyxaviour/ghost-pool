"use client";

/**
 * Swap settings component for slippage tolerance configuration
 */

import { useState, useCallback, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SwapSettingsProps {
  /** Current slippage tolerance (percentage, e.g., 0.5 = 0.5%) */
  slippage: number;
  /** Called when slippage changes */
  onSlippageChange: (slippage: number) => void;
  /** Whether the settings panel is open */
  isOpen: boolean;
  /** Called to toggle settings panel */
  onToggle: () => void;
}

const PRESET_SLIPPAGES = [0.1, 0.5, 1.0];
const MIN_SLIPPAGE = 0.01;
const MAX_SLIPPAGE = 50;

export function SwapSettings({
  slippage,
  onSlippageChange,
  isOpen,
  onToggle,
}: SwapSettingsProps) {
  const [customValue, setCustomValue] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  // Handle preset slippage selection
  const handlePresetClick = useCallback(
    (value: number) => {
      setIsCustom(false);
      setCustomValue("");
      onSlippageChange(value);
    },
    [onSlippageChange]
  );

  // Handle custom input change
  const handleCustomChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Allow empty or valid numeric input
      if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
        setCustomValue(value);
        setIsCustom(true);

        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue >= MIN_SLIPPAGE && numValue <= MAX_SLIPPAGE) {
          onSlippageChange(numValue);
        }
      }
    },
    [onSlippageChange]
  );

  // Check if current slippage matches a preset
  const isPresetSelected = (preset: number) => !isCustom && slippage === preset;

  // Warning states
  const isHighSlippage = slippage > 5;
  const isLowSlippage = slippage < 0.1;

  return (
    <div className="relative">
      {/* Settings toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground"
        title="Swap settings"
      >
        <SettingsIcon className="w-5 h-5" />
      </Button>

      {/* Settings panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card p-4 shadow-lg z-50">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Swap Settings</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="w-6 h-6 text-muted-foreground"
              >
                <CloseIcon className="w-4 h-4" />
              </Button>
            </div>

            {/* Slippage tolerance */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm text-muted-foreground">
                  Slippage Tolerance
                </label>
                <span className="text-sm font-medium">{slippage}%</span>
              </div>

              {/* Preset buttons */}
              <div className="flex gap-2">
                {PRESET_SLIPPAGES.map((preset) => (
                  <Button
                    key={preset}
                    variant={isPresetSelected(preset) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                    className="flex-1"
                  >
                    {preset}%
                  </Button>
                ))}

                {/* Custom input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Custom"
                    value={customValue}
                    onChange={handleCustomChange}
                    className={cn(
                      "w-full h-9 px-3 rounded-md border text-sm text-center outline-none",
                      "bg-background border-input",
                      "focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      isCustom && "border-primary"
                    )}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </div>

              {/* Warnings */}
              {isHighSlippage && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
                  <WarningIcon className="w-4 h-4 shrink-0" />
                  <span>High slippage may result in unfavorable trades</span>
                </div>
              )}

              {isLowSlippage && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 text-yellow-500 text-sm">
                  <WarningIcon className="w-4 h-4 shrink-0" />
                  <span>Low slippage may cause transactions to fail</span>
                </div>
              )}
            </div>

            {/* Info text */}
            <p className="text-xs text-muted-foreground">
              Your transaction will revert if the price changes unfavorably by more
              than this percentage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon components
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
