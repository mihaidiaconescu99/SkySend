import Link from "next/link";
import { AppButton } from "@/components/shared/app-button";
import type { PageHeaderAction } from "@/types/ui";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: PageHeaderAction[];
};

export function PageHeader({
  title,
  description,
  actions = [],
}: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 max-w-3xl">
        <div className="min-w-0 space-y-2">
          <h1 className="type-h2 text-[1.375rem] sm:text-[var(--type-h2)]">{title}</h1>
          {description ? <p className="type-subtitle line-clamp-2 sm:line-clamp-none">{description}</p> : null}
        </div>
      </div>

      {actions.length > 0 ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto lg:justify-end">
          {actions.map((action) => {
            const content = (
              <>
                {action.icon}
                {action.label}
              </>
            );

            if (action.href) {
              return (
                <AppButton
                  key={`${action.label}-${action.href}`}
                  asChild
                  variant={action.variant ?? "outline"}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Link href={action.href}>{content}</Link>
                </AppButton>
              );
            }

            return (
              <AppButton
                key={action.label}
                type="button"
                variant={action.variant ?? "outline"}
                size="sm"
                className="w-full sm:w-auto"
                onClick={action.onClick}
              >
                {content}
              </AppButton>
            );
          })}
        </div>
      ) : null}
    </header>
  );
}
