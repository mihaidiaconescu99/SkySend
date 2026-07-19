import type { CSSProperties, ReactNode } from "react";
import {
  deliveryUrgencyLabels,
  notificationTypeLabels,
  paymentStatusLabels,
} from "@/constants/domain";
import { roleConfigs } from "@/constants/roles";
import type { DeliveryOrder, Notification, OrderPoint, PaymentRecord } from "@/types/entities";
import type { DashboardRole } from "@/types/roles";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getMockAdminProfile,
  getMockClientDashboardStats,
  getMockFailedOrders,
  getMockNotificări,
  getMockOperatorProfile,
  getMockOrderPoints,
  getMockOrders,
  getMockPaymentMethods,
  getMockPaymentRecords,
  getMockUserProfile,
} from "@/lib/mock-data";
import {
  formatDeliveryUrgency,
  formatOrderStatus,
  getOrderProgress,
  sortOrdersByDate,
} from "@/lib/orders";
import { RoleOverviewCard } from "./role-overview-card";

type DashboardMetric = {
  label: string;
  value: string;
  hint: string;
};

type DashboardTone = "neutral" | "success" | "warning" | "destructive" | "info";

type DashboardListItem = {
  key: string;
  title: string;
  body: string;
  meta?: string;
  badge?: {
    label: string;
    tone?: DashboardTone;
  };
};

type DashboardSection = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  items: DashboardListItem[];
  footer?: ReactNode;
};

function formatCurrency(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "Time not available";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatOrderId(orderId: string) {
  return orderId.split("_").at(-1)?.replace(/^0+/, "") || orderId;
}

function getOrderTone(status: DeliveryOrder["status"]) {
  switch (status) {
    case "delivered":
      return "success";
    case "failed":
    case "cancelled":
    case "returned":
      return "destructive";
    case "queued":
    case "scheduled":
      return "warning";
    case "in_flight":
      return "info";
    default:
      return "neutral";
  }
}

function getNotificationTone(type: Notification["type"]) {
  switch (type) {
    case "critical":
      return "destructive";
    case "warning":
      return "warning";
    case "success":
      return "success";
    case "system":
      return "info";
    default:
      return "neutral";
  }
}

function getPaymentTone(status: PaymentRecord["status"]) {
  switch (status) {
    case "paid":
      return "success";
    case "failed":
      return "destructive";
    case "pending":
    case "authorized":
      return "warning";
    case "refunded":
      return "info";
    default:
      return "neutral";
  }
}

function createItem(item: DashboardListItem) {
  return item;
}

function createClientDashboardContent() {
  const profile = getMockUserProfile();
  const stats = getMockClientDashboardStats();
  const orders = sortOrdersByDate(getMockOrders(), "createdAt", "desc");
  const activeOrders = orders.filter((order) =>
    ["queued", "scheduled", "in_flight"].includes(order.status),
  );
  const paymentRecords = sortOrdersByDate(
    getMockPaymentRecords() as unknown as DeliveryOrder[],
    "createdAt",
    "desc",
  ) as unknown as PaymentRecord[];
  const paymentMethods = getMockPaymentMethods();
  const metrics: DashboardMetric[] = [
    {
      label: "Activ deliveries",
      value: `${stats.activeOrdersCount}`,
      hint: "Live and scheduled deliveries currently moving through the Pitesti zone.",
    },
    {
      label: "Monthly spend",
      value: formatCurrency(stats.monthlySpend.amountMinor, stats.monthlySpend.currency),
      hint: "Current client-side payment exposure across paid, authorized and pending orders.",
    },
  ];

  const sections: DashboardSection[] = [
    {
      id: "deliveries",
      eyebrow: "Deliveries",
      title: "Comenzi active în Pitești",
      description:
        "The client view stays focused on recent orders, their current state and the next visible step in the flow.",
      items: activeOrders.slice(0, 4).map((order) => {
        const progress = getOrderProgress(order);

        return {
          key: order.id,
          title: `Comanda ${formatOrderId(order.id)} · ${formatOrderStatus(order.status)}`,
          body: `${progress.label}. ${formatDeliveryUrgency(order.urgency)} priority with dispatch window at ${formatDateLabel(order.scheduledFor)}.`,
          meta: `Progress ${progress.value}% · Clasă drone ${order.assignedDroneClassId ?? "pending assignment"}`,
          badge: {
            label: formatOrderStatus(order.status),
            tone: getOrderTone(order.status),
          },
        };
      }),
    },
    {
      id: "payments",
      eyebrow: "Platăs",
      title: "Statusul plății rămâne vizibil lângă comenzi",
      description:
        "Recent payment records and the default billing method stay close to the delivery flow so clients can act without opening a separate finance tool.",
      items: paymentRecords.slice(0, 4).map((payment) => ({
        key: payment.id,
        title: `${formatCurrency(payment.amount.amountMinor, payment.amount.currency)} · ${paymentStatusLabels[payment.status]}`,
        body:
          payment.failureReason ??
          `Plată linked to order ${formatOrderId(payment.orderId)} and updated ${formatDateLabel(payment.updatedAt)}.`,
        meta:
          paymentMethods.find((method) => method.id === payment.paymentMethodId)?.label ??
          "Billing method pending",
        badge: {
          label: paymentStatusLabels[payment.status],
          tone: getPaymentTone(payment.status),
        },
      })),
      footer: (
        <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 px-4 py-4 text-sm leading-7 text-muted-foreground">
          Default billing method:{" "}
          <span className="font-medium text-foreground">
            {paymentMethods.find((method) => method.isDefault)?.label ?? "Not set"}
          </span>
          . The client surface stays anchored in Pitesti and keeps billing state visible without opening a full finance portal.
        </div>
      ),
    },
  ];

  return {
    eyebrow: "Prezentare client",
    title: `Comanda livrare for ${profile.companyName ?? profile.fullName}`,
    description:
      "Create, monitor and settle deliveries inside the active Pitesti service area through one compact workspace.",
    metrics,
    sections,
  };
}

function createAdminDashboardContent() {
  const profile = getMockAdminProfile();
  const orders = getMockOrders();
  const failedOrders = getMockFailedOrders();
  const notifications = getMockNotificări().filter(
    (notification) => notification.userProfileId === profile.id,
  );
  const paymentRecords = getMockPaymentRecords();
  const activeOrdersCount = orders.filter((order) =>
    ["queued", "scheduled", "in_flight"].includes(order.status),
  ).length;
  const completionRate = Math.round(
    (orders.filter((order) => order.status === "delivered").length / orders.length) * 100,
  );
  const authorizedValue = paymentRecords
    .filter((payment) => payment.status === "authorized" || payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount.amountMinor, 0);

  const metrics: DashboardMetric[] = [
    {
      label: "Prezentare comenzi",
      value: `${orders.length} live records`,
      hint: `${activeOrdersCount} orders are currently active across the Pitesti operating day.`,
    },
    {
      label: "Manual review",
      value: `${failedOrders.length} cases`,
      hint: "Incidents and role-sensitive exceptions waiting for administrative review.",
    },
    {
      label: "Completion rate",
      value: `${completionRate}%`,
      hint: "Closed successfully across the current order set for Pitesti operations.",
    },
  ];

  const sections: DashboardSection[] = [
    {
      id: "orders-overview",
      eyebrow: "Prezentare comenzi",
      title: "Operational volume at a glance",
      description:
        "Admin sees the system in terms of network load, not individual parcel detail.",
      items: [
        {
          key: "overview-queued",
          title: `${orders.filter((order) => order.status === "queued").length} queued for dispatch`,
          body: "Comenzi that passed intake and are waiting for final operational release.",
          badge: { label: "Queued", tone: "warning" },
        },
        {
          key: "overview-flight",
          title: `${orders.filter((order) => order.status === "in_flight").length} in flight`,
          body: "Mission traffic currently moving through the live Pitesti service area.",
          badge: { label: "Live", tone: "info" },
        },
        {
          key: "overview-complete",
          title: `${orders.filter((order) => order.status === "delivered").length} delivered`,
          body: "Completed missions closing cleanly across the current reporting window.",
          badge: { label: "Livrată", tone: "success" },
        },
      ],
    },
    {
      id: "manual-review",
      eyebrow: "Verificare manuală",
      title: "Exceptions that need an administrative decision",
      description:
        "Failed orders and critical notifications stay grouped so review can happen without leaving the dashboard.",
      items: [
        ...failedOrders.slice(0, 2).map((order) =>
          createItem({
          key: order.id,
          title: `Comanda ${formatOrderId(order.id)} · ${formatOrderStatus(order.status)}`,
          body: order.cancellationReason ?? "Failure reason not available.",
          meta: `Scheduled ${formatDateLabel(order.scheduledFor)}`,
          badge: { label: "Verificare", tone: "destructive" },
        }),
        ),
        ...notifications.map((notification) =>
          createItem({
          key: notification.id,
          title: notification.title,
          body: notification.body,
          meta: formatDateLabel(notification.createdAt),
          badge: {
            label: notificationTypeLabels[notification.type],
            tone: getNotificationTone(notification.type),
          },
        }),
        ),
      ],
    },
    {
      id: "analytics",
      eyebrow: "Analytics",
      title: "Commercial signals",
      description:
        "The admin view keeps billing movement readable without turning the page into a dense BI surface.",
      items: [
        {
          key: "billing",
          title: `${formatCurrency(authorizedValue, "RON")} awaiting capture or settlement`,
          body: "Pending and authorized value across the current Pitesti order set.",
          badge: { label: "Revenue pulse", tone: "info" },
        },
      ],
    },
  ];

  return {
    eyebrow: "Prezentare admin",
    title: `Network oversight for ${profile.companyName ?? profile.fullName}`,
    description:
      "Monitor order flow, review exceptions and keep the Pitesti network readable from one administrative surface.",
    metrics,
    sections,
  };
}

function createOperatorDashboardContent() {
  const profile = getMockOperatorProfile();
  const orders = getMockOrders();
  const orderPoints = getMockOrderPoints();
  const notifications = getMockNotificări().filter(
    (notification) => notification.userProfileId === profile.id,
  );
  const activeOrders = sortOrdersByDate(
    orders.filter((order) => ["queued", "in_flight", "scheduled"].includes(order.status)),
    "scheduledFor",
    "asc",
  );
  const validationPoints = orderPoints.filter(
    (point) => point.type !== "waypoint" && ["pending", "confirmed"].includes(point.status),
  );
  const failedOrders = getMockFailedOrders();

  const metrics: DashboardMetric[] = [
    {
      label: "Activ tasks",
      value: `${activeOrders.length}`,
      hint: "Queued, in-flight and scheduled missions still requiring operator attention.",
    },
    {
      label: "Validation queue",
      value: `${validationPoints.length} points`,
      hint: "Ridicare and drop-off states that still need eyes on route readiness or handoff quality.",
    },
    {
      label: "Incidents",
      value: `${failedOrders.length}`,
      hint: "Failure cases currently visible in the Pitesti mission desk.",
    },
  ];

  const sections: DashboardSection[] = [
    {
      id: "active-tasks",
      eyebrow: "Activ Tasks",
      title: "Missions currently moving through the queue",
      description:
        "The operator view prioritizes what needs action now: live dispatches, queued launches and the next scheduled wave.",
      items: activeOrders.slice(0, 4).map((order) => ({
        key: order.id,
        title: `Comanda ${formatOrderId(order.id)} · ${formatOrderStatus(order.status)}`,
        body: `${deliveryUrgencyLabels[order.urgency]} urgency, dispatch window ${formatDateLabel(order.scheduledFor)}.`,
        meta: `Dronă ${order.assignedDroneClassId ?? "pending"} · ${getOrderProgress(order).label}`,
        badge: {
          label: formatOrderStatus(order.status),
          tone: getOrderTone(order.status),
        },
      })),
    },
    {
      id: "validation",
      eyebrow: "Ridicare / Livrare Validation",
      title: "Route endpoints that still need confirmation",
      description:
        "Operators keep an eye on handoff quality, pad readiness and point status before and during dispatch.",
      items: validationPoints.slice(0, 4).map((point: OrderPoint) => ({
        key: point.id,
        title: `${point.type === "pickup" ? "Ridicare" : "Livrare"} · ${point.address.formattedAddress}`,
        body:
          point.notes ??
          `Point is ${point.status} and still inside the active Pitesti operating zone.`,
        meta: `Comanda ${formatOrderId(point.orderId)} · ${point.address.city}, ${point.address.county}`,
        badge: {
          label: point.status === "confirmed" ? "Confirmed" : "Pending",
          tone: point.status === "confirmed" ? "info" : "warning",
        },
      })),
    },
    {
      id: "incidents",
      eyebrow: "Incidents",
      title: "Exceptions requiring operator follow-up",
      description:
        "Failures and system notifications remain close to the mission queue so recovery actions stay grounded in the live operation.",
      items: [
        ...failedOrders.slice(0, 2).map((order) =>
          createItem({
          key: order.id,
          title: `Failed order ${formatOrderId(order.id)}`,
          body: order.cancellationReason ?? "Incident summary unavailable.",
          meta: `${formatDeliveryUrgency(order.urgency)} urgency`,
          badge: { label: "Incident", tone: "destructive" },
        }),
        ),
        ...notifications.slice(0, 2).map((notification) =>
          createItem({
          key: notification.id,
          title: notification.title,
          body: notification.body,
          meta: formatDateLabel(notification.createdAt),
          badge: {
            label: notificationTypeLabels[notification.type],
            tone: getNotificationTone(notification.type),
          },
        }),
        ),
      ],
    },
  ];

  return {
    eyebrow: "Prezentare operator",
    title: `Mission desk for ${profile.companyName ?? profile.fullName}`,
    description:
      "Keep dispatch, point validation and incident handling aligned inside the current Pitesti operating window.",
    metrics,
    sections,
  };
}

function DashboardList({ items, accent }: { items: DashboardListItem[]; accent: string }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-medium text-foreground">{item.title}</h3>
            {item.badge ? (
              <StatusBadge label={item.badge.label} tone={item.badge.tone} />
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
          {item.meta ? (
            <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span>{item.meta}</span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function RoleDashboardView({ role }: { role: DashboardRole }) {
  const config = roleConfigs[role];
  const content =
    role === "client"
      ? createClientDashboardContent()
      : role === "admin"
        ? createAdminDashboardContent()
        : createOperatorDashboardContent();

  return (
    <section className="app-container flex flex-col gap-8">
      <Card
        id="overview"
        className="scroll-mt-24 rounded-[var(--ui-radius-panel)] shadow-[var(--elevation-panel)]"
        style={{ "--role-accent": config.accent } as CSSProperties}
      >
        <CardContent className="flex min-w-0 flex-col gap-5 p-5 sm:p-8 md:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: config.accent }}
            />
            <Badge variant="outline">{content.eyebrow}</Badge>
            <StatusBadge label="Pitesti live" tone="success" />
          </div>
          <div className="space-y-3">
            <h2 className="font-heading text-3xl tracking-tight sm:text-4xl">
              {content.title}
            </h2>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
              {content.description}
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Badge variant="outline">Prezentare generală</Badge>
          <h3 className="font-heading text-2xl tracking-tight sm:text-3xl">
            Current signals for this workspace.
          </h3>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {content.metrics.map((metric) => (
            <RoleOverviewCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        {content.sections.map((section) => (
          <SectionCard
            key={section.id}
            eyebrow={section.eyebrow}
            title={section.title}
            description={section.description}
            footer={section.footer}
          >
            <DashboardList items={section.items} accent={config.accent} />
          </SectionCard>
        ))}
      </section>
    </section>
  );
}
