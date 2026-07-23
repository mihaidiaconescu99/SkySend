"use client";

import { useEffect, useState } from "react";
import { AppButton } from "@/components/shared/app-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { OperationalStatusSnapshot } from "@/types/operational-status";

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "—";
}

export function AdminOperationalStatusCard() {
  const [status, setStatus] = useState<OperationalStatusSnapshot | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/operational-status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((snapshot) => { if (active && snapshot) setStatus(snapshot); });
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);
  if (!status) return null;
  const remaining = status.override.expiresAt && now !== null
    ? Math.max(0, Date.parse(status.override.expiresAt) - now)
    : 0;
  const countdown = `${String(Math.floor(remaining / 3_600_000)).padStart(2, "0")}:${String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, "0")}:${String(Math.floor((remaining % 60_000) / 1_000)).padStart(2, "0")}`;
  const cancel = async () => {
    const response = await fetch("/api/admin/operational-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_override" }),
    });
    if (response.ok) setStatus((await response.json()).snapshot);
  };
  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div><p className="text-sm text-muted-foreground">Status efectiv / manual</p><div className="mt-2 flex gap-2"><StatusBadge label={status.effectiveStatus} tone={status.effectiveStatus === "active" ? "success" : "warning"} /><StatusBadge label={status.manualStatus} tone="neutral" /></div></div>
        <div><p className="text-sm text-muted-foreground">Meteo</p><p className="mt-2 font-medium">{status.weather.level ?? "verificare indisponibilă"}</p><p className="mt-1 text-xs text-muted-foreground">{status.weather.reasonCodes.join(", ") || "fără motive"}</p></div>
        <div><p className="text-sm text-muted-foreground">Încercare / verificare validă</p><p className="mt-2 text-xs leading-5">{date(status.weather.lastAttemptAt)}<br />{date(status.weather.lastValidAt)}</p>{status.weather.lastError ? <p className="text-xs text-destructive">{status.weather.lastError}</p> : null}</div>
        <div><p className="text-sm text-muted-foreground">Override Active</p><p className="mt-2 font-mono text-sm">{status.override.active ? countdown : "inactiv"}</p>{status.override.actorProfileId ? <p className="mt-1 truncate text-xs text-muted-foreground">Actor: {status.override.actorProfileId}</p> : null}{status.override.active ? <AppButton type="button" size="sm" variant="outline" className="mt-2" onClick={cancel}>Anulează anticipat</AppButton> : null}</div>
      </CardContent>
    </Card>
  );
}
