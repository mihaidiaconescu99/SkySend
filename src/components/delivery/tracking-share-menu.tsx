"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Settings2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SharingResponse = {
  publicCodeAccessMode: "view" | "control";
  terminal: boolean;
  links: Record<"full" | "pickup" | "dropoff", string>;
};

export function TrackingShareMenu({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SharingResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || data) return;
    void fetch(`/api/client/orders/${encodeURIComponent(orderId)}/sharing`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Linkurile nu au putut fi încărcate.");
        return response.json() as Promise<SharingResponse>;
      })
      .then((value) => setData(value))
      .catch(() => setError("Linkurile nu au putut fi încărcate. Reîncearcă."));
  }, [data, open, orderId]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function copyLink(scope: "full" | "pickup" | "dropoff") {
    const value = data?.links[scope];
    if (!value) return;
    setError(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("textarea");
        input.value = value;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copiedWithFallback = document.execCommand("copy");
        input.remove();
        if (!copiedWithFallback) throw new Error("Clipboard unavailable");
      }
      setCopied(scope);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Linkul nu a putut fi copiat. Îl poți deschide direct.");
    }
  }

  async function updateAccess(mode: "view" | "control") {
    if (!data || data.terminal || data.publicCodeAccessMode === mode) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/client/orders/${encodeURIComponent(orderId)}/sharing`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicCodeAccessMode: mode }),
        },
      );
      if (response.ok) setData(await response.json());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Partajează urmărirea"
        aria-expanded={open}
        onClick={() => {
          setError(null);
          setOpen((value) => !value);
        }}
        className="inline-flex size-10 items-center justify-center border border-border/80 bg-background text-foreground transition-colors hover:border-primary/50 hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring"
      >
        {open ? <X className="size-4" /> : <Users className="size-4" />}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-2rem))] border border-border bg-popover p-4 text-popover-foreground shadow-[var(--elevation-panel)]">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            <p className="font-semibold">Partajează livrarea</p>
          </div>

          <div className="mt-4 grid gap-2">
            {([
              ["full", "Acces complet"],
              ["pickup", "Doar expeditor"],
              ["dropoff", "Doar destinatar"],
            ] as const).map(([scope, label]) => (
              <div key={scope} className="flex min-h-11 items-stretch border border-border/70">
                <a
                  href={data?.links[scope] ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!data}
                  onClick={(event) => {
                    if (!data) event.preventDefault();
                  }}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 text-left text-sm transition-colors hover:bg-secondary aria-disabled:pointer-events-none aria-disabled:opacity-50"
                >
                  <span>{label}</span>
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                </a>
                <button
                  type="button"
                  disabled={!data}
                  aria-label={`Copiază linkul: ${label}`}
                  title={`Copiază linkul: ${label}`}
                  onClick={() => copyLink(scope)}
                  className="inline-flex w-11 shrink-0 items-center justify-center border-l border-border/70 transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  {copied === scope ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                </button>
              </div>
            ))}
          </div>

          {error ? (
            <p className="mt-3 text-xs leading-5 text-destructive" role="status">
              {error}
            </p>
          ) : null}

          <div className="mt-4 border-t border-border/70 pt-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings2 className="size-4" />
              Acces prin ID-ul comenzii
            </div>
            <div className="mt-3 grid grid-cols-2 border border-border/70 p-1">
              {(["view", "control"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={!data || data.terminal || busy}
                  onClick={() => updateAccess(mode)}
                  className={cn(
                    "min-h-9 px-2 text-xs font-medium transition-colors",
                    data?.publicCodeAccessMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode === "view" ? "Vizualizare" : "Control complet"}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
