"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Funnel } from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { FilterBarItem } from "@/types/ui";

type FilterBarProps = {
  filters: FilterBarItem[];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onApplyFilters?: () => void;
  applyLabel?: string;
};

export function FilterBar({
  filters,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Caută",
  onApplyFilters,
  applyLabel = "Filtrează",
}: FilterBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApplyFilters?.();
  }

  const controls: ReactNode = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant="outline" className="gap-2">
          <Funnel className="size-3.5" />
          Filtre
        </Badge>
      </div>

      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.2fr)_repeat(3,minmax(10rem,1fr))]">
        <Input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />

        {filters.map((filter) => (
          <label key={filter.id} className="grid min-w-0 gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {filter.label}
            </span>
            <select
              value={filter.value}
              aria-label={filter.label}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                filter.onChange?.(event.target.value)
              }
              className="h-12 w-full min-w-0 rounded-2xl border border-input bg-card px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </>
  );

  return (
    <section
      aria-label="Filtre"
      className="rounded-[var(--ui-radius-card)] border border-border/80 bg-card p-4 shadow-[var(--elevation-card)]"
    >
      {onApplyFilters ? (
        <form
          onSubmit={handleSubmit}
          className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end"
        >
          {controls}
          <AppButton type="submit" className="h-12 shrink-0">
            {applyLabel}
          </AppButton>
        </form>
      ) : (
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center">
          {controls}
        </div>
      )}
    </section>
  );
}
