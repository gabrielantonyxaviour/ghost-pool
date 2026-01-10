"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex items-start gap-3 w-full rounded-lg border border-border bg-card p-4 shadow-lg",
          title: "text-sm font-medium text-foreground",
          description: "text-sm text-muted-foreground mt-1",
          actionButton:
            "ml-auto shrink-0 inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
          cancelButton:
            "inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-muted text-muted-foreground hover:bg-muted/80 transition-colors",
        },
      }}
      {...props}
    />
  );
}
