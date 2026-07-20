"use client";

import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";

type ClientRuntimeStatsProps = {
  activeCount: number;
  completedCount: number;
  failedCount: number;
};

export function ClientRuntimeStats({
  activeCount,
  completedCount,
  failedCount,
}: ClientRuntimeStatsProps) {
  return (
    <div className="grid gap-4 expanded-ui:grid-cols-3">
      <StatCard
        label="Livrari active"
        value={`${activeCount}`}
        hint="Livrari in coada, programate sau in zbor, citite din baza de date."
        trend={<StatusBadge label="Live acum" tone="info" />}
      />
      <StatCard
        label="Livrari finalizate"
        value={`${completedCount}`}
        hint="Comenzi inchise cu succes in perioada curenta de raportare."
        trend={<StatusBadge label="Actualizat" tone="success" />}
      />
      <StatCard
        label="Livrari esuate"
        value={`${failedCount}`}
        hint="Exceptii care pot necesita reluare, rambursare sau follow-up."
        trend={<StatusBadge label="Necesita verificare" tone="warning" />}
      />
    </div>
  );
}
