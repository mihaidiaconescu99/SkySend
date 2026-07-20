"use client";

import { Activity, Clock3 } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import type { MissionActor, MissionEvent } from "@/types/mission";

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function getActorTone(actor: MissionActor) {
  if (actor === "sender" || actor === "recipient") {
    return "success" as const;
  }

  if (actor === "operator" || actor === "admin") {
    return "warning" as const;
  }

  return "info" as const;
}

function formatActor(actor: MissionActor) {
  switch (actor) {
    case "sender":
      return "Sender";
    case "recipient":
      return "Recipient";
    case "operator":
      return "Operations";
    case "admin":
      return "SkySend";
    default:
      return "SkySend";
  }
}

function MissionEventLogList({ events }: { events: MissionEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
        <div className="flex items-center gap-3">
          <Activity className="size-4 text-foreground" />
          <p className="font-medium text-foreground">Așteaptă actualizări despre livrare</p>
        </div>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Updates will appear here as dispatch, pickup and delivery steps are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {events.map((event) => (
        <article
          key={event.id}
          className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full border border-border bg-secondary/60 text-foreground">
                <Clock3 className="size-4" />
              </span>
              <div>
                <p className="font-medium text-foreground">{event.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatEventTime(event.timestamp)}
                </p>
              </div>
            </div>
            <StatusBadge
              label={formatActor(event.actor)}
              tone={getActorTone(event.actor)}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {event.description}
          </p>
        </article>
      ))}
    </div>
  );
}

export function MissionEventLog() {
  const { eventLog } = useMissionRuntime();
  const events = [...eventLog].reverse();

  return (
    <SectionCard
      eyebrow="Event Log"
      title="Actualizări livrare"
      description="A clear record of the delivery as it moves through pickup and drop-off."
    >
      <details className="group rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/30 p-4 compact-ui:block expanded-ui:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-foreground">
          Latest delivery updates
          <StatusBadge label={`${events.length} events`} tone="neutral" />
        </summary>
        <div className="mt-4">
          <MissionEventLogList events={events} />
        </div>
      </details>

      <div className="hidden max-h-[36rem] overflow-y-auto pr-1 expanded-ui:block">
        <MissionEventLogList events={events} />
      </div>
    </SectionCard>
  );
}
