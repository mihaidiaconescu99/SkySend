"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import {
  dismissToast,
  getToastsSnapshot,
  subscribeToasts,
} from "@/lib/toast-store";
import { cn } from "@/lib/utils";

const toneClassNames = {
  info: "border-primary/35",
  success: "border-success/35",
  warning: "border-warning/35",
  destructive: "border-destructive/35",
} as const;

const progressClassNames = {
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
} as const;

export function ToastProvider() {
  const toasts = useSyncExternalStore(
    subscribeToasts,
    getToastsSnapshot,
    getToastsSnapshot,
  );

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-3 top-[calc(0.75rem_+_env(safe-area-inset-top))] z-[90] min-h-28 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[22rem]"
    >
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto absolute inset-x-0 overflow-hidden rounded-[1.15rem] border bg-card/92 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-[transform,opacity] duration-300",
            toneClassNames[toast.tone],
          )}
          style={{
            transform: `translateY(${index * 0.7}rem) scale(${1 - index * 0.025})`,
            transformOrigin: "top center",
            zIndex: toasts.length - index,
            opacity: 1 - index * 0.12,
          }}
        >
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full shadow-[0_0_0_4px_rgb(255_255_255_/_0.035)]",
                progressClassNames[toast.tone],
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-[-0.01em] text-foreground">{toast.title}</p>
              {toast.message ? (
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {toast.message}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Închide notificarea"
              onClick={() => dismissToast(toast.id)}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="h-px bg-border/70">
            <div
              className={cn(
                "h-full origin-left animate-[toast-progress_linear_forwards]",
                progressClassNames[toast.tone],
              )}
              style={{ animationDuration: `${toast.durationMs}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
