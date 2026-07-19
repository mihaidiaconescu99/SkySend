"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AppButton } from "@/components/shared/app-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  defaultAdminExportFilters,
  getAvailableExportFilterOptions,
  prepareAdminCsvExport,
} from "@/lib/admin-export";
import { getAdminStatisticsSnapshot } from "@/lib/admin-statistics";
import { cn } from "@/lib/utils";
import type {
  AdminExportFilter,
  AdminStatisticsSnapshot,
} from "@/types/admin-statistics";

type ExportFilterOptions = ReturnType<typeof getAvailableExportFilterOptions>;

type AdminStatisticsViewProps = {
  initialSnapshot: AdminStatisticsSnapshot;
  initialExportOptions: ExportFilterOptions;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function StatisticsKpiGrid({ snapshot }: { snapshot: AdminStatisticsSnapshot }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {snapshot.kpis.map((kpi) => (
        <Card key={kpi.id} className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </p>
            </div>
            <p className="font-heading text-3xl tracking-tight text-foreground">
              {kpi.value}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">{kpi.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ExportPanel({
  exportOptions,
}: {
  exportOptions: ExportFilterOptions;
}) {
  const [filters, setFilters] = useState<AdminExportFilter>(
    defaultAdminExportFilters,
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  function updateFilter<Field extends keyof AdminExportFilter>(
    field: Field,
    value: AdminExportFilter[Field],
  ) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
  }

  function runExport() {
    const result = prepareAdminCsvExport("general_report", filters);

    if (!result.ok) {
      setFeedback({
        tone: "error",
        message:
          result.reason === "invalid_date_range"
            ? "Intervalul de export nu este valid."
            : result.reason === "no_results"
              ? "Nu există rezultate pentru filtrele selectate."
              : "Exportul nu este disponibil.",
      });
      return;
    }

    downloadCsv(result.filename, result.csv);
    setFeedback({
      tone: "success",
      message: `Export CSV generat: ${result.rowCount} rânduri.`,
    });
  }

  return (
    <Card className="rounded-[calc(var(--radius)+0.5rem)]">
      <CardContent className="grid gap-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">Export CSV</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Raport operațional generat în browser din comenzile disponibile.
            </p>
          </div>
          <FileSpreadsheet className="size-5 text-primary" />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              De la
            </span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
              className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Până la
            </span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
              className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Status comandă
            </span>
            <select
              value={filters.orderStatus}
              onChange={(event) =>
                updateFilter(
                  "orderStatus",
                  event.target.value as AdminExportFilter["orderStatus"],
                )
              }
              className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
            >
              <option value="all">Toate statusurile</option>
              {exportOptions.orderStatuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <AppButton type="button" className="w-fit" onClick={runExport}>
          <Download className="size-4" />
          Exportă raport CSV
        </AppButton>

        {feedback ? (
          <div
            className={cn(
              "rounded-[calc(var(--radius)+0.35rem)] border p-4 text-sm",
              feedback.tone === "success"
                ? "border-success/35 bg-success/10 text-foreground"
                : "border-destructive/35 bg-destructive/10 text-destructive",
            )}
          >
            {feedback.message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AdminStatisticsView({
  initialSnapshot,
  initialExportOptions,
}: AdminStatisticsViewProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [exportOptions, setExportOptions] = useState(initialExportOptions);

  useEffect(() => {
    const refreshFrame = window.requestAnimationFrame(() => {
      setSnapshot(getAdminStatisticsSnapshot());
      setExportOptions(getAvailableExportFilterOptions());
    });

    return () => window.cancelAnimationFrame(refreshFrame);
  }, []);

  const generatedLabel = useMemo(
    () => formatDateTime(snapshot.generatedAt),
    [snapshot.generatedAt],
  );

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Panou Administrator"
        title="Rapoarte"
        description="Raport operațional calculat doar din comenzile disponibile."
      />

      <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/35 p-4 text-sm text-muted-foreground">
        Date calculate la {generatedLabel}.
      </div>

      <StatisticsKpiGrid snapshot={snapshot} />

      <ExportPanel exportOptions={exportOptions} />
    </section>
  );
}
