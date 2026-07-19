"use client";

import {
  BatteryCharging,
  CheckCircle2,
  LockKeyhole,
  MapPinned,
  PackageCheck,
  Plane,
  Route,
  Warehouse,
} from "lucide-react";
import { droneClassLabels } from "@/constants/domain";
import { activeHub } from "@/constants/hub";
import { lockerStateLabels } from "@/constants/mission";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Mission } from "@/types/mission";

type MissionBriefProps = {
  mission: Mission;
  etaLabel: string;
};

const readinessItems = [
  {
    label: "Dronă alocată",
    icon: Plane,
  },
  {
    label: "Battery checked",
    icon: BatteryCharging,
  },
  {
    label: "Locker attached",
    icon: PackageCheck,
  },
  {
    label: "Traseu ready",
    icon: Route,
  },
  {
    label: "Plată confirmată",
    icon: CheckCircle2,
  },
] as const;

function getPinStatusLabel(mission: Mission, purpose: "pickup_verification" | "dropoff_verification") {
  const pin = mission.pins.find((item) => item.purpose === purpose);

  return pin ? "Emis" : "În așteptare";
}

export function MissionBrief({ mission, etaLabel }: MissionBriefProps) {
  return (
    <section className="app-container flex flex-col gap-6">
      <div className="rounded-[calc(var(--radius)+0.75rem)] border border-border bg-card p-5 shadow-[var(--elevation-soft)] md:p-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge label="Plată confirmată" tone="success" />
          <StatusBadge label="Mission brief" tone="info" />
        </div>
        <h1 className="mt-4 font-heading text-3xl tracking-tight text-foreground md:text-4xl">
          Mission is being prepared
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          SkySend is assigning the aircraft, locker and route before live
          tracking begins.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
        <SectionCard
          eyebrow="Mission"
          title={mission.id}
          description="Operational summary before pre-flight checks start."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Plane className="size-4" />
                Drone
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {mission.droneId}
                <br />
                {droneClassLabels[mission.droneClass]}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Warehouse className="size-4" />
                Hub
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {mission.hub.name || activeHub.name}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MapPinned className="size-4" />
                Punct de pickup
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {mission.pickup.label}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MapPinned className="size-4" />
                Punct de livrare
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {mission.dropoff.label}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
              <p className="text-sm text-muted-foreground">Durată estimată</p>
              <p className="mt-2 font-medium text-foreground">{etaLabel}</p>
            </div>
            <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
              <p className="text-sm text-muted-foreground">PIN pickup</p>
              <p className="mt-2 font-medium text-foreground">
                {getPinStatusLabel(mission, "pickup_verification")}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
              <p className="text-sm text-muted-foreground">Recipient PIN</p>
              <p className="mt-2 font-medium text-foreground">
                {getPinStatusLabel(mission, "dropoff_verification")}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
              <p className="text-sm text-muted-foreground">Locker</p>
              <p className="mt-2 font-medium text-foreground">
                {lockerStateLabels[mission.locker.state]}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Pregătire"
          title="Pregătire pre-flight"
          description="Misiunea poate trece în verificările pre-flight după ce aceste controale sunt gata."
        >
          <div className="grid gap-2">
            {readinessItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border/80 bg-background px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                  </div>
                  <StatusBadge label="Pregătit" tone="success" />
                </div>
              );
            })}
          </div>

          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
            <div className="flex items-center gap-3">
              <LockKeyhole className="size-4 text-foreground" />
              <p className="font-medium text-foreground">Dispatch aprobat</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Plata este confirmat? și misiunea este gata s? intre în pre-flight
              checks.
            </p>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
