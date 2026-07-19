

export interface MissionEvent {
  id: string;
  missionId: string;
  eventType: string;
  title: string;
  description: string | null;

  metadata: Record<string, unknown>;

  occurredAt: string;

  createdAt: string;
}

export interface CreateMissionEventInput {
  missionId: string;
  eventType: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;

  occurredAt?: string;
}
