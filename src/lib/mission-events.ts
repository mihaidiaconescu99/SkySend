import {
  missionActionLabels,
  missionStatusDescriptions,
  missionStatusLabels,
} from "@/constants/mission";
import type {
  Mission,
  MissionAction,
  MissionActor,
  MissionEvent,
  MissionEventId,
  MissionId,
  MissionStatus,
} from "@/types/mission";

export type MissionEventInput = {
  missionId: MissionId;
  status: MissionStatus;
  title: string;
  description: string;
  actor?: MissionActor;
  timestamp?: string;
  id?: MissionEventId;
};

export type StatusChangeEventInput = {
  missionId: MissionId;
  status: MissionStatus;
  timestamp?: string;
  actor?: MissionActor;
};

export type ActionEventInput = {
  missionId: MissionId;
  status: MissionStatus;
  action: MissionAction;
  timestamp?: string;
  actor?: MissionActor;
};

export type SystemEventInput = {
  missionId: MissionId;
  status: MissionStatus;
  title: string;
  description: string;
  timestamp?: string;
};

const statusEventCopy: Partial<
  Record<MissionStatus, Pick<MissionEvent, "title" | "description" | "actor">>
> = {
  mission_created: {
    title: "Comanda a fost plasata.",
    description: "SkySend pregateste drona pentru dispatch.",
    actor: "system",
  },
  preflight_checks: {
    title: "Drona alocata.",
    description: "Bateria, traseul si lockerul sunt verificate.",
    actor: "system",
  },
  drone_dispatched: {
    title: "Drona a plecat din hub.",
    description: "Drona se deplaseaza catre punctul de pickup.",
    actor: "operator",
  },
  en_route_to_pickup: {
    title: "Drona se deplaseaza catre punctul de pickup.",
    description: "Drona zboara catre punctul de intalnire curent.",
    actor: "system",
  },
  arrived_at_pickup: {
    title: "Drona a ajuns la punctul de pickup.",
    description: "Drona asteapta confirmarea expeditorului.",
    actor: "system",
  },
  pickup_safety_check: {
    title: "Punctul de pickup a fost confirmat.",
    description: "Drona verifica zona inainte de coborarea lockerului.",
    actor: "system",
  },
  locker_descending_pickup: {
    title: "Lockerul coboara.",
    description: "Lockerul coboara pentru incarcarea coletului.",
    actor: "system",
  },
  locker_ascending_pickup: {
    title: "Lockerul se securizeaza.",
    description: "Lockerul revine in pozitia de zbor.",
    actor: "system",
  },
  payload_verification: {
    title: "Coletul este verificat.",
    description: "SkySend verifica daca coletul este pregatit pentru zbor.",
    actor: "system",
  },
  parcel_secured: {
    title: "Coletul a fost incarcat.",
    description: "Coletul este securizat in locker.",
    actor: "system",
  },
  en_route_to_dropoff: {
    title: "Drona se deplaseaza catre punctul de livrare.",
    description: "Drona zboara catre punctul de intalnire curent.",
    actor: "system",
  },
  arrived_at_dropoff: {
    title: "Drona a ajuns la punctul de livrare.",
    description: "Drona asteapta confirmarea destinatarului.",
    actor: "system",
  },
  dropoff_safety_check: {
    title: "Punctul de livrare a fost confirmat.",
    description: "Drona verifica zona inainte de coborarea lockerului.",
    actor: "system",
  },
  locker_descending_dropoff: {
    title: "Lockerul coboara.",
    description: "Lockerul coboara pentru pickupa coletului.",
    actor: "system",
  },
  locker_ascending_dropoff: {
    title: "Lockerul se securizeaza.",
    description: "Lockerul revine la drona.",
    actor: "system",
  },
  delivery_completed: {
    title: "Coletul a fost ridicat.",
    description: "Destinatarul a confirmat pickupa coletului.",
    actor: "system",
  },
  proof_generated: {
    title: "Dovada livrarii a fost salvata.",
    description: "Detaliile livrarii au fost salvate in comanda.",
    actor: "system",
  },
  mission_closed: {
    title: "Livrare finalizata.",
    description: "Livrarea este completa.",
    actor: "system",
  },
  returning_to_hub: {
    title: "Drona se intoarce la hub.",
    description: "Fallback-ul a fost activat si drona revine la hub.",
    actor: "system",
  },
  returned_to_hub: {
    title: "Coletul a fost returnat la hub.",
    description: "Drona a revenit la hub-ul SkySend.",
    actor: "system",
  },
  mission_failed: {
    title: "Comanda a fost anulata.",
    description: "Livrarea nu poate continua.",
    actor: "operator",
  },
  fallback_required: {
    title: "Suport necesar.",
    description: "SkySend va gestiona pasul urmator.",
    actor: "operator",
  },
};

const actionEventCopy: Record<
  MissionAction,
  Pick<MissionEvent, "title" | "description" | "actor">
> = {
  confirm_sender_position: {
    title: "Punctul de pickup a fost confirmat.",
    description: "Expeditorul a confirmat ca vede drona la pickup.",
    actor: "sender",
  },
  verify_pickup_pin: {
    title: "PIN-ul lockerului este disponibil.",
    description: "PIN-ul a fost folosit pe tastatura lockerului.",
    actor: "sender",
  },
  confirm_parcel_loaded: {
    title: "Coletul a fost incarcat.",
    description: "Expeditorul a confirmat coletul in locker.",
    actor: "sender",
  },
  confirm_recipient_position: {
    title: "Punctul de livrare a fost confirmat.",
    description: "Destinatarul a confirmat ca vede drona la livrare.",
    actor: "recipient",
  },
  verify_recipient_pin: {
    title: "PIN-ul lockerului este disponibil.",
    description: "PIN-ul a fost folosit pe tastatura lockerului.",
    actor: "recipient",
  },
  confirm_parcel_collected: {
    title: "Coletul a fost ridicat.",
    description: "Destinatarul a confirmat pickupa coletului din locker.",
    actor: "recipient",
  },
  trigger_fallback: {
    title: "Suport solicitat.",
    description: "SkySend support a fost solicitat pentru aceasta livrare.",
    actor: "operator",
  },
};

function createMissionEventId(
  missionId: MissionId,
  timestamp: string,
): MissionEventId {
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const safeTimestamp = Date.parse(timestamp).toString(36);

  return `event_${missionId}_${safeTimestamp}_${entropy}`;
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

export function createMissionEvent({
  missionId,
  status,
  title,
  description,
  actor = "system",
  timestamp = getCurrentTimestamp(),
  id,
}: MissionEventInput): MissionEvent {
  return {
    id: id ?? createMissionEventId(missionId, timestamp),
    missionId,
    timestamp,
    status,
    title,
    description,
    actor,
  };
}

export function createStatusChangeEvent({
  missionId,
  status,
  timestamp,
  actor,
}: StatusChangeEventInput): MissionEvent {
  const copy = statusEventCopy[status] ?? {
    title: missionStatusLabels[status],
    description: missionStatusDescriptions[status],
    actor: "system" as const,
  };

  return createMissionEvent({
    missionId,
    status,
    timestamp,
    title: copy.title,
    description: copy.description,
    actor: actor ?? copy.actor,
  });
}

export function createActionEvent({
  missionId,
  status,
  action,
  timestamp,
  actor,
}: ActionEventInput): MissionEvent {
  const copy = actionEventCopy[action];

  return createMissionEvent({
    missionId,
    status,
    timestamp,
    title: copy.title ?? missionActionLabels[action],
    description: copy.description,
    actor: actor ?? copy.actor,
  });
}

export function createSystemEvent({
  missionId,
  status,
  title,
  description,
  timestamp,
}: SystemEventInput): MissionEvent {
  return createMissionEvent({
    missionId,
    status,
    title,
    description,
    timestamp,
    actor: "system",
  });
}

export function appendMissionEvent(
  mission: Mission,
  event: MissionEvent,
): Mission {
  return {
    ...mission,
    events: [...mission.events, event],
  };
}
