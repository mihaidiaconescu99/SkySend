import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type ProfilesRow = Database["public"]["Tables"]["profiles"]["Row"];
type AddressesRow = Database["public"]["Tables"]["addresses"]["Row"];
type SettingsRow = Database["public"]["Tables"]["operational_settings"]["Row"];
type NotificationsRow = Database["public"]["Tables"]["notifications"]["Row"];
type ContactMessagesRow =
  Database["public"]["Tables"]["contact_messages"]["Row"];
type PaymentRecordsRow =
  Database["public"]["Tables"]["payment_records"]["Row"];
type OrdersRow = Database["public"]["Tables"]["orders"]["Row"];
type MissionsRow = Database["public"]["Tables"]["missions"]["Row"];
type MissionEventsRow =
  Database["public"]["Tables"]["mission_events"]["Row"];
type ParcelsRow = Database["public"]["Tables"]["parcels"]["Row"];
type AuditEventsRow = Database["public"]["Tables"]["audit_events"]["Row"];
type TableName = keyof Database["public"]["Tables"];
type Op = "select" | "insert" | "update" | "delete";

type AnyRow = Record<string, unknown>;

export interface InjectedError {
  code: string;
  message: string;
}

interface PostgrestLikeError {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}

interface QueryResultSingle {
  data: AnyRow | null;
  error: PostgrestLikeError | null;
}

interface QueryResultList {
  data: AnyRow[] | null;
  error: PostgrestLikeError | null;
}

type FilterClause =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "in"; column: string; values: readonly unknown[] }
  | { kind: "gte"; column: string; value: unknown };

interface ChainState {
  table: TableName;
  op: Op;
  filters: FilterClause[];
  insertPayload?: AnyRow;
  updatePayload?: AnyRow;
  orderBy?: { column: string; ascending: boolean };
  limit?: number;

  rangeFrom?: number;
}

function buildError(injected: InjectedError): PostgrestLikeError {
  return {
    code: injected.code,
    message: injected.message,
    details: null,
    hint: null,
  };
}

export class FakeStore {

  readonly rows = new Map<string, ProfilesRow>();
  readonly addressRows = new Map<string, AddressesRow>();
  readonly settingsRows = new Map<string, SettingsRow>();
  readonly notificationRows = new Map<string, NotificationsRow>();
  readonly contactMessageRows = new Map<string, ContactMessagesRow>();
  readonly paymentRecordRows = new Map<string, PaymentRecordsRow>();
  readonly orderRows = new Map<string, OrdersRow>();
  readonly missionRows = new Map<string, MissionsRow>();
  readonly missionEventRows = new Map<string, MissionEventsRow>();
  readonly parcelRows = new Map<string, ParcelsRow>();
  readonly auditEventRows = new Map<string, AuditEventsRow>();

  private readonly nextErrors: Partial<Record<Op, InjectedError[]>> = {};

  seedProfile(row: ProfilesRow): void {
    this.rows.set(row.id, { ...row });
  }

  seedAddress(row: AddressesRow): void {
    this.addressRows.set(row.id, { ...row });
  }

  seedSettings(row: SettingsRow): void {
    this.settingsRows.set(row.id, { ...row });
  }

  seedNotification(row: NotificationsRow): void {
    this.notificationRows.set(row.id, { ...row });
  }

  seedContactMessage(row: ContactMessagesRow): void {
    this.contactMessageRows.set(row.id, { ...row });
  }

  seedPaymentRecord(row: PaymentRecordsRow): void {
    this.paymentRecordRows.set(row.id, { ...row });
  }

  seedOrder(row: OrdersRow): void {
    this.orderRows.set(row.id, { ...row });
  }

  seedMission(row: MissionsRow): void {
    this.missionRows.set(row.id, { ...row });
  }

  seedMissionEvent(row: MissionEventsRow): void {
    this.missionEventRows.set(row.id, { ...row });
  }

  seedParcel(row: ParcelsRow): void {
    this.parcelRows.set(row.id, { ...row });
  }

  seedAuditEvent(row: AuditEventsRow): void {
    this.auditEventRows.set(row.id, { ...row });
  }

  injectErrorOnNext(op: Op, error: InjectedError): void {
    (this.nextErrors[op] ??= []).push(error);
  }

  injectInsertRace(victorRow: ProfilesRow): void {
    this.injectErrorOnNext("insert", {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    this.seedProfile(victorRow);
  }

  consumeError(op: Op): InjectedError | null {
    const queue = this.nextErrors[op];
    if (!queue || queue.length === 0) return null;
    return queue.shift() ?? null;
  }

  bucketFor(table: TableName): Map<string, AnyRow> {
    if (table === "profiles") {
      return this.rows as unknown as Map<string, AnyRow>;
    }
    if (table === "addresses") {
      return this.addressRows as unknown as Map<string, AnyRow>;
    }
    if (table === "operational_settings") {
      return this.settingsRows as unknown as Map<string, AnyRow>;
    }
    if (table === "notifications") {
      return this.notificationRows as unknown as Map<string, AnyRow>;
    }
    if (table === "contact_messages") {
      return this.contactMessageRows as unknown as Map<string, AnyRow>;
    }
    if (table === "payment_records") {
      return this.paymentRecordRows as unknown as Map<string, AnyRow>;
    }
    if (table === "orders") {
      return this.orderRows as unknown as Map<string, AnyRow>;
    }
    if (table === "missions") {
      return this.missionRows as unknown as Map<string, AnyRow>;
    }
    if (table === "mission_events") {
      return this.missionEventRows as unknown as Map<string, AnyRow>;
    }
    if (table === "parcels") {
      return this.parcelRows as unknown as Map<string, AnyRow>;
    }
    if (table === "audit_events") {
      return this.auditEventRows as unknown as Map<string, AnyRow>;
    }
    throw new Error(`FakeStore: unsupported table "${table}"`);
  }

  matches(row: AnyRow, filters: ChainState["filters"]): boolean {
    return filters.every((filter) => {
      if (filter.kind === "eq") return row[filter.column] === filter.value;
      if (filter.kind === "in") {
        return filter.values.some((value) => row[filter.column] === value);
      }

      const lhs = row[filter.column];
      const rhs = filter.value;
      if (lhs === undefined || lhs === null) return false;
      return (lhs as number | string) >= (rhs as number | string);
    });
  }

  findAll(table: TableName, filters: ChainState["filters"]): AnyRow[] {
    const bucket = this.bucketFor(table);
    return [...bucket.values()].filter((row) => this.matches(row, filters));
  }
}

class FakeBuilder implements PromiseLike<QueryResultList> {
  private state: ChainState;

  constructor(private readonly store: FakeStore, table: TableName) {
    this.state = { table, op: "select", filters: [] };
  }

  select(_columns?: unknown): this {
    return this;
  }

  insert(payload: AnyRow | AnyRow[]): this {
    this.state.op = "insert";
    this.state.insertPayload = Array.isArray(payload) ? payload[0] : payload;
    return this;
  }

  update(payload: AnyRow): this {
    this.state.op = "update";
    this.state.updatePayload = payload;
    return this;
  }

  delete(): this {
    this.state.op = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.state.filters.push({ kind: "eq", column, value });
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.state.filters.push({ kind: "in", column, values });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.state.filters.push({ kind: "gte", column, value });
    return this;
  }

  order(
    column: string,
    options: { ascending?: boolean } = {},
  ): this {
    this.state.orderBy = {
      column,
      ascending: options.ascending ?? true,
    };
    return this;
  }

  limit(n: number): this {
    this.state.limit = n;
    return this;
  }

  range(from: number, to: number): this {
    this.state.rangeFrom = from;
    this.state.limit = to - from + 1;
    return this;
  }

  async single(): Promise<QueryResultSingle> {
    return this.executeSingle("single");
  }

  async maybeSingle(): Promise<QueryResultSingle> {
    return this.executeSingle("maybeSingle");
  }

  then<T1 = QueryResultList, T2 = never>(
    onFulfilled?:
      | ((value: QueryResultList) => T1 | PromiseLike<T1>)
      | null,
    onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.executeList().then(onFulfilled, onRejected);
  }

  private async executeList(): Promise<QueryResultList> {
    const injected = this.store.consumeError(this.state.op);
    if (injected) {
      return { data: null, error: buildError(injected) };
    }
    if (this.state.op === "insert") {
      const single = await this.executeSingle("maybeSingle");
      if (single.error) return { data: null, error: single.error };
      return { data: single.data ? [single.data] : [], error: null };
    }
    if (this.state.op === "update") {

      const matches = this.store.findAll(this.state.table, this.state.filters);
      const bucket = this.store.bucketFor(this.state.table);
      const now = new Date().toISOString();
      const updated: AnyRow[] = matches.map((target) => {
        const merged: AnyRow = {
          ...target,
          ...this.state.updatePayload,
          updated_at: now,
        };
        bucket.set(target.id as string, merged);
        return merged;
      });
      return { data: updated, error: null };
    }
    if (this.state.op === "delete") {
      const matches = this.store.findAll(this.state.table, this.state.filters);
      const bucket = this.store.bucketFor(this.state.table);
      const deleted: AnyRow[] = matches.map((target) => {
        bucket.delete(target.id as string);
        return target;
      });
      return { data: deleted, error: null };
    }
    let matches = this.store.findAll(this.state.table, this.state.filters);
    if (this.state.orderBy) {
      const { column, ascending } = this.state.orderBy;
      matches = [...matches].sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (av === bv) return 0;

        if (av === null || av === undefined) return ascending ? 1 : -1;
        if (bv === null || bv === undefined) return ascending ? -1 : 1;
        if (av < bv) return ascending ? -1 : 1;
        return ascending ? 1 : -1;
      });
    }
    if (typeof this.state.rangeFrom === "number") {
      matches = matches.slice(this.state.rangeFrom);
    }
    if (typeof this.state.limit === "number") {
      matches = matches.slice(0, this.state.limit);
    }
    return { data: matches, error: null };
  }

  private async executeSingle(
    mode: "single" | "maybeSingle",
  ): Promise<QueryResultSingle> {
    const injected = this.store.consumeError(this.state.op);
    if (injected) {
      return { data: null, error: buildError(injected) };
    }

    switch (this.state.op) {
      case "select":
        return this.executeSelect(mode);
      case "insert":
        return this.executeInsert();
      case "update":
        return this.executeUpdate(mode);
      case "delete":
        return this.executeDelete(mode);
    }
  }

  private executeSelect(mode: "single" | "maybeSingle"): QueryResultSingle {
    const matches = this.store.findAll(this.state.table, this.state.filters);
    if (matches.length === 0) {
      if (mode === "single") {
        return {
          data: null,
          error: buildError({
            code: "PGRST116",
            message: "The result contains 0 rows.",
          }),
        };
      }
      return { data: null, error: null };
    }
    return { data: matches[0], error: null };
  }

  private executeInsert(): QueryResultSingle {
    const payload = this.state.insertPayload ?? {};
    const table = this.state.table;

    if (table === "profiles") {
      const clerkUserId = payload.clerk_user_id;
      if (typeof clerkUserId === "string") {
        const conflict = [...this.store.rows.values()].some(
          (row) => row.clerk_user_id === clerkUserId,
        );
        if (conflict) {
          return {
            data: null,
            error: buildError({
              code: "23505",
              message: "duplicate key value violates unique constraint",
            }),
          };
        }
      }
    }

    const now = new Date().toISOString();
    const bucket = this.store.bucketFor(table);
    const id =
      typeof payload.id === "string" ? (payload.id as string) : randomUUID();

    const row = applyDefaults(table, {
      ...payload,
      id,
      created_at: (payload.created_at as string | undefined) ?? now,
      updated_at: (payload.updated_at as string | undefined) ?? now,
    });
    bucket.set(id, row);
    return { data: row, error: null };
  }

  private executeUpdate(mode: "single" | "maybeSingle"): QueryResultSingle {
    const matches = this.store.findAll(this.state.table, this.state.filters);
    if (matches.length === 0) {
      if (mode === "single") {
        return {
          data: null,
          error: buildError({
            code: "PGRST116",
            message: "The result contains 0 rows.",
          }),
        };
      }
      return { data: null, error: null };
    }
    const target = matches[0];
    const merged: AnyRow = {
      ...target,
      ...this.state.updatePayload,
      updated_at: new Date().toISOString(),
    };
    const bucket = this.store.bucketFor(this.state.table);
    bucket.set(target.id as string, merged);
    return { data: merged, error: null };
  }

  private executeDelete(mode: "single" | "maybeSingle"): QueryResultSingle {
    const matches = this.store.findAll(this.state.table, this.state.filters);
    if (matches.length === 0) {
      if (mode === "single") {
        return {
          data: null,
          error: buildError({
            code: "PGRST116",
            message: "The result contains 0 rows.",
          }),
        };
      }
      return { data: null, error: null };
    }
    const target = matches[0];
    const bucket = this.store.bucketFor(this.state.table);
    bucket.delete(target.id as string);
    return { data: { id: target.id }, error: null };
  }
}

function applyDefaults(table: TableName, row: AnyRow): AnyRow {
  if (table === "profiles") {
    return {
      ...row,
      clerk_user_id: row.clerk_user_id,
      email: row.email,
      full_name: row.full_name ?? null,
      role: row.role ?? "client",
      notification_preferences:
        row.notification_preferences ?? { popup: true, email: true },
    };
  }
  if (table === "addresses") {
    return {
      ...row,
      profile_id: row.profile_id ?? null,
      label: row.label ?? null,
      formatted_address: row.formatted_address,
      city: row.city ?? null,
      county: row.county ?? null,
      country: row.country ?? null,
      postal_code: row.postal_code ?? null,
      latitude: row.latitude,
      longitude: row.longitude,
      is_saved: row.is_saved ?? false,
      usage_count: row.usage_count ?? 1,
      last_used_at: row.last_used_at ?? row.created_at,
    };
  }
  if (table === "operational_settings") {
    return {
      ...row,
      is_active: row.is_active ?? true,
      is_singleton: row.is_singleton ?? true,
      service_radius_km: row.service_radius_km ?? 6,
      base_price_minor: row.base_price_minor ?? 990,
      price_per_km_minor: row.price_per_km_minor ?? 220,
      confirmation_timer_minutes: row.confirmation_timer_minutes ?? 10,
      loading_timer_minutes: row.loading_timer_minutes ?? 10,
      unloading_timer_minutes: row.unloading_timer_minutes ?? 10,
      hub_latitude: row.hub_latitude ?? 44.8565,
      hub_longitude: row.hub_longitude ?? 24.8692,
      last_saved_at: row.last_saved_at ?? row.created_at,
      last_saved_by: row.last_saved_by ?? null,
    };
  }
  if (table === "notifications") {
    return {
      ...row,
      profile_id: row.profile_id ?? null,
      type: row.type,
      title: row.title,
      message: row.message,
      metadata: row.metadata ?? {},
      action_url: row.action_url ?? null,
      read: row.read ?? false,
      read_at: row.read_at ?? null,
    };
  }
  if (table === "contact_messages") {
    return {
      ...row,
      sender_email: row.sender_email,
      sender_name: row.sender_name ?? null,
      subject: row.subject,
      body: row.body,
      category: row.category ?? null,
      status: row.status ?? "new",
      read_at: row.read_at ?? null,
      internal_note: row.internal_note ?? null,
    };
  }
  if (table === "payment_records") {
    return {
      ...row,
      order_id: row.order_id,
      profile_id: row.profile_id,
      stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
      stripe_charge_id: row.stripe_charge_id ?? null,
      stripe_refund_id: row.stripe_refund_id ?? null,
      amount_minor: row.amount_minor,
      currency: row.currency ?? "RON",
      type: row.type,
      status: row.status,
      failure_reason: row.failure_reason ?? null,
    };
  }
  if (table === "mission_events") {
    return {
      ...row,
      mission_id: row.mission_id,
      event_type: row.event_type,
      title: row.title,
      description: row.description ?? null,
      metadata: row.metadata ?? {},
      occurred_at: row.occurred_at ?? row.created_at,
    };
  }
  if (table === "missions") {
    return {
      ...row,
      order_id: row.order_id,
      current_status: row.current_status ?? "mission_created",
      started_at: row.started_at ?? null,
      completed_at: row.completed_at ?? null,
      drone_telemetry_snapshot: row.drone_telemetry_snapshot ?? {},
      pickup_pin: row.pickup_pin ?? null,
      dropoff_pin: row.dropoff_pin ?? null,
      pickup_pin_attempts: row.pickup_pin_attempts ?? 0,
      dropoff_pin_attempts: row.dropoff_pin_attempts ?? 0,
      pickup_pin_verified_at: row.pickup_pin_verified_at ?? null,
      dropoff_pin_verified_at: row.dropoff_pin_verified_at ?? null,
      fallback_reason: row.fallback_reason ?? null,
    };
  }
  if (table === "audit_events") {
    return {
      ...row,
      actor_profile_id: row.actor_profile_id ?? null,
      actor_role: row.actor_role,
      action: row.action,
      entity_type: row.entity_type ?? null,
      entity_id: row.entity_id ?? null,
      changes: row.changes ?? {},
      occurred_at: row.occurred_at ?? row.created_at,
    };
  }
  if (table === "parcels") {
    return {
      ...row,
      contents_description: row.contents_description,
      approximate_size: row.approximate_size ?? null,
      declared_dimensions_cm: row.declared_dimensions_cm ?? null,
      declared_weight_kg: row.declared_weight_kg ?? null,
      estimated_weight_range: row.estimated_weight_range ?? null,
      fragility_level: row.fragility_level ?? "low",
      packaging_type: row.packaging_type ?? null,
      security_module: row.security_module ?? "standard",
      thermal_protection: row.thermal_protection ?? "none",
    };
  }
  if (table === "orders") {
    return {
      ...row,
      local_order_id: row.local_order_id,
      public_tracking_code: row.public_tracking_code,
      recipient_tracking_token: row.recipient_tracking_token,
      sender_profile_id: row.sender_profile_id,
      recipient_email: row.recipient_email ?? null,
      recipient_name: row.recipient_name ?? null,
      recipient_phone: row.recipient_phone ?? null,
      pickup_address_id: row.pickup_address_id,
      dropoff_address_id: row.dropoff_address_id,
      parcel_id: row.parcel_id,
      status: row.status ?? "pending",
      fulfillment_status: row.fulfillment_status ?? null,
    dispatch_timing: row.dispatch_timing ?? "standard",
    dispatch_starts_at: row.dispatch_starts_at ?? null,
      scheduled_at: row.scheduled_at ?? null,
      drone_class: row.drone_class,
      delivery_configuration_id: row.delivery_configuration_id,
      eta_min_minutes: row.eta_min_minutes ?? null,
      eta_max_minutes: row.eta_max_minutes ?? null,
      total_amount_minor: row.total_amount_minor,
      currency: row.currency ?? "RON",
      pricing_snapshot: row.pricing_snapshot,
      handoff_points_snapshot: row.handoff_points_snapshot ?? null,
      selected_pickup_handoff_point: row.selected_pickup_handoff_point ?? null,
      selected_dropoff_handoff_point:
        row.selected_dropoff_handoff_point ?? null,
      stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
      stripe_charge_id: row.stripe_charge_id ?? null,
      payment_status: row.payment_status ?? "pending",
      refund_status: row.refund_status ?? null,
      notes: row.notes ?? null,
    };
  }
  return row;
}

export interface FakeSupabase {
  client: SupabaseClient<Database>;
  store: FakeStore;
}

export function createFakeSupabase(): FakeSupabase {
  const store = new FakeStore();
  const client = {
    from: (tableName: TableName) => new FakeBuilder(store, tableName),
  };
  return {
    client: client as unknown as SupabaseClient<Database>,
    store,
  };
}

export function buildProfileRow(
  overrides: Partial<ProfilesRow> = {},
): ProfilesRow {
  return {
    id: overrides.id ?? randomUUID(),
    clerk_user_id: "user_clerk_xyz",
    email: "test@example.com",
    avatar_url: null,
    full_name: "Test User",
    role: "client",
    notification_preferences: { popup: true, email: true },
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

export function buildAuditEventRow(
  overrides: Partial<AuditEventsRow> = {},
): AuditEventsRow {
  return {
    id: overrides.id ?? randomUUID(),
    actor_profile_id: null,
    actor_role: "admin",
    action: "test.action",
    entity_type: null,
    entity_id: null,
    changes: {} as never,
    occurred_at: "2026-05-23T10:00:00Z",
    created_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

export function buildParcelRow(
  overrides: Partial<ParcelsRow> = {},
): ParcelsRow {
  return {
    id: overrides.id ?? randomUUID(),
    contents_description: "Test parcel contents",
    approximate_size: null,
    declared_dimensions_cm: null,
    declared_weight_kg: null,
    estimated_weight_range: null,
    fragility_level: "low",
    packaging_type: null,
    security_module: "standard",
    thermal_protection: "none",
    created_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

export function buildMissionEventRow(
  overrides: Partial<MissionEventsRow> = {},
): MissionEventsRow {
  return {
    id: overrides.id ?? randomUUID(),
    mission_id: "00000000-0000-0000-0000-000000000111",
    event_type: "drone_dispatched",
    title: "Drona a fost dispusă",
    description: null,
    metadata: {} as never,
    occurred_at: "2026-05-23T10:00:00Z",
    created_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

export function buildMissionRow(
  overrides: Partial<MissionsRow> = {},
): MissionsRow {
  return {
    id: overrides.id ?? randomUUID(),
    order_id: "00000000-0000-0000-0000-000000000111",
    current_status: "mission_created",
    started_at: null,
    completed_at: null,
    drone_telemetry_snapshot: {
      position: { latitude: 44.8565, longitude: 24.8692 },
      heading: 0,
      speed: 0,
      segmentProgress: 0,
      segmentId: null,
      lastUpdatedAt: "2026-05-23T10:00:00Z",
    } as never,
    pickup_pin: null,
    dropoff_pin: null,
    pickup_pin_attempts: 0,
    dropoff_pin_attempts: 0,
    pickup_pin_verified_at: null,
    dropoff_pin_verified_at: null,
    fallback_reason: null,
    failed_at: null,
    failure_code: null,
    runtime_state: {},
    state_version: 0,
    step_expires_at: null,
    step_started_at: null,
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

const defaultPricingSnapshot = {
  version: "skysend-pricing-v1",
  baseFee: 990,
  distanceFee: 1320,
  configMultiplier: 1,
  dispatchAdjustment: 0,
  surcharges: [],
  subtotal: 2310,
  total: 2310,
};

export function buildOrderRow(
  overrides: Partial<OrdersRow> = {},
): OrdersRow {
  return {
    id: overrides.id ?? randomUUID(),
    local_order_id: "SKY-PT-DEFAULT",
    public_tracking_code: "TRACK-DEFAULT",
    public_code_access_mode: "view",
    recipient_tracking_token: "TOKEN-DEFAULT",
    sender_profile_id: "00000000-0000-0000-0000-000000000111",
    recipient_email: null,
    recipient_name: null,
    recipient_phone: null,
    pickup_address_id: "00000000-0000-0000-0000-000000000222",
    dropoff_address_id: "00000000-0000-0000-0000-000000000333",
    parcel_id: "00000000-0000-0000-0000-000000000444",
    status: "pending",
    fulfillment_status: null,
    dispatch_timing: "standard",
    scheduled_at: null,
    drone_class: "medium_standard",
    delivery_configuration_id: "aer_express",
    eta_min_minutes: 15,
    eta_max_minutes: 25,
    total_amount_minor: 2310,
    currency: "RON",
    pricing_snapshot: defaultPricingSnapshot as never,
    handoff_points_snapshot: null,
    selected_pickup_handoff_point: null,
    selected_dropoff_handoff_point: null,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    payment_status: "pending",
    refund_status: null,
    notes: null,
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
    dispatch_starts_at: overrides.dispatch_starts_at ?? null,
  };
}

export function buildPaymentRecordRow(
  overrides: Partial<PaymentRecordsRow> = {},
): PaymentRecordsRow {
  return {
    id: overrides.id ?? randomUUID(),
    order_id: "00000000-0000-0000-0000-000000000111",
    profile_id: "00000000-0000-0000-0000-000000000222",
    stripe_payment_intent_id: "pi_test_123",
    stripe_charge_id: "ch_test_123",
    stripe_refund_id: null,
    amount_minor: 3100,
    currency: "RON",
    type: "payment",
    status: "succeeded",
    failure_reason: null,
    created_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

export function buildContactMessageRow(
  overrides: Partial<ContactMessagesRow> = {},
): ContactMessagesRow {
  return {
    id: overrides.id ?? randomUUID(),
    sender_email: "ana@example.com",
    sender_name: "Ana Pop",
    subject: "Întrebare",
    body: "Salut!",
    category: null,
    status: "new",
    read_at: null,
    internal_note: null,
    last_message_at: "2026-05-23T10:00:00Z",
    replied_at: null,
    closed_at: null,
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

export function buildNotificationRow(
  overrides: Partial<NotificationsRow> = {},
): NotificationsRow {
  return {
    id: overrides.id ?? randomUUID(),
    profile_id: null,
    type: "system",
    title: "Test notification",
    message: "Body text.",
    metadata: {},
    action_url: null,
    read: false,
    read_at: null,
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

export function buildSettingsRow(
  overrides: Partial<SettingsRow> = {},
): SettingsRow {
  return {
    id: overrides.id ?? randomUUID(),
    is_active: true,
    is_singleton: true,
    service_radius_km: 6,
    base_price_minor: 990,
    price_per_km_minor: 220,
    confirmation_timer_minutes: 10,
    loading_timer_minutes: 10,
    unloading_timer_minutes: 10,
    hub_latitude: 44.8565,
    hub_longitude: 24.8692,
    last_saved_at: "2026-05-23T10:00:00Z",
    last_saved_by: null,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

export function buildAddressRow(
  overrides: Partial<AddressesRow> = {},
): AddressesRow {
  return {
    id: overrides.id ?? randomUUID(),
    profile_id: null,
    label: null,
    formatted_address: "Strada Test 1, Pitești",
    city: "Pitești",
    county: "Argeș",
    country: "România",
    postal_code: null,
    latitude: 44.8565,
    longitude: 24.8692,
    is_saved: false,
    usage_count: 1,
    last_used_at: "2026-05-23T10:00:00Z",
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}
