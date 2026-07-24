export type UserRole = "client" | "admin" | "operator";

export type DashboardRole = UserRole;
export type RoleHomePath = `/${DashboardRole}`;

export type RoleMetric = {
  label: string;
  value: string;
  hint: string;
};

export type RoleConfig = {
  role: DashboardRole;
  label: string;
  title: string;
  description: string;
  basePath: RoleHomePath;
  accent: string;
  metrics: RoleMetric[];
  priorities: string[];
};
