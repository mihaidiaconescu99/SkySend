import type { ReactNode } from "react";

export type Option<Value extends string = string> = {
  label: string;
  value: Value;
};

export type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export type FilterBarItem = {
  id: string;
  label: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
};

export type PageHeaderAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
  icon?: ReactNode;
};
