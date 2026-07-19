

export interface AuditEvent {
  id: string;
  actorProfileId: string | null;
  actorRole: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  changes: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface CreateAuditEventInput {
  actorProfileId?: string | null;
  actorRole: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  changes?: Record<string, unknown>;
  occurredAt?: string;
}
