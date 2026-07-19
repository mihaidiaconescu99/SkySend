import type {
  DashboardRole,
  RoleBindingStrategy,
  RoleConfig,
  RoleHomePath,
  UserRole,
} from "@/types/roles";

export const userRoles: readonly UserRole[] = [
  "client",
  "admin",
  "operator",
];

export const adminPanelRoles: readonly UserRole[] = [
  "admin",
];

export const roleLabels: Record<UserRole, string> = {
  client: "Client",
  admin: "Admin",
  operator: "Operator",
};

export const roleHomePaths: Record<UserRole, RoleHomePath> = {
  client: "/client",
  admin: "/admin",
  operator: "/operator",
};

export const roleRoutingPaths = {
  authContinue: "/auth/continue",
  invalidRole: "/access-denied?reason=invalid-role",
  noRole: "/access-denied?reason=no-role",
} as const;

export const protectedRoleRoutePatterns = [
  "/client(.*)",
  "/admin(.*)",
  "/operator(.*)",
] as const;

export const guestOnlyRoutePatterns = ["/sign-in(.*)", "/sign-up(.*)"] as const;

export const rolePriority: Record<UserRole, number> = {
  client: 1,
  operator: 2,
  admin: 3,
};

export const roleConfigs: Record<DashboardRole, RoleConfig> = {
  client: {
    role: "client",
    label: "Client",
    title: "Client delivery command",
    description:
      "A focused space for placing delivery requests, monitoring live ETAs, and reviewing fulfillment history.",
    basePath: "/client",
    accent: "#0f9bd7",
    metrics: [
      {
        label: "Activ requests",
        value: "12",
        hint: "Reserved for live orders and scheduled dispatches.",
      },
      {
        label: "Avg. ETA",
        value: "18 min",
        hint: "Pregătit for customer-facing time prediction data.",
      },
      {
        label: "Fulfillment rate",
        value: "99.2%",
        hint: "Reserved for SLA and experience reporting.",
      },
    ],
    priorities: [
      "Preluare comandă, parcel tracking, and delivery confirmations.",
      "Customer billing, notifications, and service history.",
      "Self-service support for exceptions and priority requests.",
    ],
  },
  admin: {
    role: "admin",
    label: "Admin",
    title: "Network oversight console",
    description:
      "A control surface for revenue operations, compliance, and high-level platform health across the city network.",
    basePath: "/admin",
    accent: "#f0843c",
    metrics: [
      {
        label: "Network uptime",
        value: "99.98%",
        hint: "Reserved for platform-wide service availability reporting.",
      },
      {
        label: "Incidente deschise",
        value: "3",
        hint: "Reserved for operational and compliance escalations.",
      },
      {
        label: "Revenue pulse",
        value: "$184k",
        hint: "Finance and commercial performance visibility.",
      },
    ],
    priorities: [
      "Role management, permissions, and commercial governance.",
      "City coverage, fleet-level performance, and SLA health.",
      "Compliance reporting, exception review, and audit readiness.",
    ],
  },
  operator: {
    role: "operator",
    label: "Operator",
    title: "Mission operations desk",
    description:
      "An execution layer for launch pad readiness, mission sequencing, and real-time fleet coordination.",
    basePath: "/operator",
    accent: "#18b37e",
    metrics: [
      {
        label: "Live missions",
        value: "27",
        hint: "Reserved for active dispatches and in-flight tracking.",
      },
      {
        label: "Pad readiness",
        value: "92%",
        hint: "Space for launch corridor and station availability data.",
      },
      {
        label: "Battery reserve",
        value: "84%",
        hint: "Prepared for telemetry and maintenance-driven planning.",
      },
    ],
    priorities: [
      "Mission dispatch, route exceptions, and airspace conflict handling.",
      "Pad maintenance, drone readiness, and turnaround workflows.",
      "Operator alerts, weather risk, and fallback procedures.",
    ],
  },
};

export const roleBindingStrategy: RoleBindingStrategy = {
  sourceOfTruth: "database",
  clerkMetadataField: "publicMetadata.role",
  fallbackRole: "client",
  developmentFallbackRole: "client",
  notes: [
    "Persist the effective role in the application database and treat it as the source of truth for authorization.",
    "Mirror the same role into Clerk publicMetadata.role so the UI and middleware can resolve role context quickly.",
    "Admin panel access is reserved for active admin assignments; Operators can request temporary access.",
    "On sign-in or webhook sync, if database and Clerk disagree, prefer the database role and update Clerk metadata.",
    "Only bootstrap from Clerk metadata when the database has no role record yet for that user.",
    "New authenticated users without a persisted role start in the client workspace by default.",
  ],
};
