import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  void eyebrow;
  void title;
  void description;
  return actions ? (
    <div className="flex flex-wrap justify-end gap-2 border-b border-border/70 pb-4">
      {actions}
    </div>
  ) : null;
}
