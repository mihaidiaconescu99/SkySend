"use client";

import { useEffect, useState } from "react";
import {
  CircleDollarSign,
  Clock3,
  MapPinned,
  RotateCcw,
  Save,
  Settings2,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AppButton } from "@/components/shared/app-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getAdminOperationalSettings,
  getDefaultOperationalSettingsFormState,
  platformStatusOptions,
  saveAdminOperationalSettings,
  settingsToFormState,
} from "@/lib/admin-settings";
import { cn } from "@/lib/utils";
import type { OperationalSettings } from "@/types/admin";
import type {
  OperationalSettingsFormState,
  OperationalSettingsValidationErrors,
} from "@/types/admin-settings";

type AdminSettingsViewProps = {
  initialSettings: OperationalSettings;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Nesalvat";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPlatformTone(status: OperationalSettings["platformStatus"]) {
  switch (status) {
    case "active":
      return "success" as const;
    case "maintenance":
      return "warning" as const;
  }
}

function SettingsSaveState({
  feedback,
}: {
  feedback: { tone: "success" | "error"; message: string } | null;
}) {
  if (!feedback) {
    return null;
  }

  return (
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
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs leading-5 text-destructive">{message}</p>;
}

export function AdminSettingsView({ initialSettings }: AdminSettingsViewProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [form, setForm] = useState<OperationalSettingsFormState>(() =>
    settingsToFormState(initialSettings),
  );
  const [errors, setErrors] = useState<OperationalSettingsValidationErrors>({});
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const refreshFrame = window.requestAnimationFrame(() => {
      const refreshedSettings = getAdminOperationalSettings();

      setSettings(refreshedSettings);
      setForm(settingsToFormState(refreshedSettings));
    });

    return () => window.cancelAnimationFrame(refreshFrame);
  }, []);

  function updateField<Field extends keyof OperationalSettingsFormState>(
    field: Field,
    value: OperationalSettingsFormState[Field],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }));
  }

  function saveSettings() {
    setIsSaving(true);
    const result = saveAdminOperationalSettings(form);

    if (!result.ok) {
      setErrors(result.errors);
      setFeedback({
        tone: "error",
        message:
          result.reason === "storage_unavailable"
            ? "Setările nu pot fi salvate fără stocare locală în browser."
            : "Verifică valorile marcate în formular.",
      });
      setIsSaving(false);
      return;
    }

    setSettings(result.settings);
    setForm(settingsToFormState(result.settings));
    setErrors({});
    setFeedback({
      tone: "success",
      message:
        "Setările operaționale au fost salvate și sunt folosite de simulare, tarifare și verificarea razei de livrare în sesiunea curentă.",
    });
    window.dispatchEvent(new Event("skysend:admin-settings-updated"));
    setIsSaving(false);
  }

  function resetToDefaults() {
    setForm(getDefaultOperationalSettingsFormState());
    setErrors({});
    setFeedback({
      tone: "success",
      message: "Valorile implicite au fost încărcate în formular. Apasă Salvează pentru persistare.",
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Panou Administrator"
        title="Setări"
        description="Controlează statusul platformei, raza de livrare, tarifele și timpii folosiți în simulare."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Status platformă</p>
            <div>
              <StatusBadge
                label={settings.platformStatusLabel}
                tone={getPlatformTone(settings.platformStatus)}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Rază activă</p>
            <p className="font-heading text-3xl tracking-tight">
              {settings.serviceRadiusKm} km
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-[calc(var(--radius)+0.375rem)]">
          <CardContent className="grid gap-2 p-4">
            <p className="text-sm text-muted-foreground">Ultima salvare</p>
            <p className="text-sm font-medium text-foreground">
              {formatDateTime(settings.updatedAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <SettingsSaveState feedback={feedback} />

      <Card className="rounded-[calc(var(--radius)+0.5rem)]">
        <CardContent className="grid gap-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">Setări operaționale</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Valorile salvate sunt citite de fluxul de livrare și de
                simulările operaționale.
              </p>
            </div>
            <Settings2 className="size-5 text-muted-foreground" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <MapPinned className="size-4" />
                Rază activă de livrare
              </span>
              <input
                value={form.serviceRadiusKm}
                onChange={(event) =>
                  updateField("serviceRadiusKm", event.target.value)
                }
                inputMode="decimal"
                className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
                placeholder="6"
              />
              <FieldError message={errors.serviceRadiusKm} />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Settings2 className="size-4" />
                Status platformă
              </span>
              <select
                value={form.platformStatus}
                onChange={(event) =>
                  updateField(
                    "platformStatus",
                    event.target.value as OperationalSettingsFormState["platformStatus"],
                  )
                }
                className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
              >
                {platformStatusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.platformStatus} />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <CircleDollarSign className="size-4" />
                Preț de bază RON
              </span>
              <input
                value={form.basePriceRon}
                onChange={(event) => updateField("basePriceRon", event.target.value)}
                inputMode="decimal"
                className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
                placeholder="9.90"
              />
              <FieldError message={errors.basePriceRon} />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <CircleDollarSign className="size-4" />
                Preț pe kilometru RON
              </span>
              <input
                value={form.pricePerKmRon}
                onChange={(event) => updateField("pricePerKmRon", event.target.value)}
                inputMode="decimal"
                className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
                placeholder="2.20"
              />
              <FieldError message={errors.pricePerKmRon} />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Clock3 className="size-4" />
                Confirmare punct
              </span>
              <input
                value={form.meetingPointConfirmationMinutes}
                onChange={(event) =>
                  updateField("meetingPointConfirmationMinutes", event.target.value)
                }
                inputMode="numeric"
                className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
                placeholder="10"
              />
              <FieldError message={errors.meetingPointConfirmationMinutes} />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Clock3 className="size-4" />
                Încărcare colet
              </span>
              <input
                value={form.parcelLoadMinutes}
                onChange={(event) =>
                  updateField("parcelLoadMinutes", event.target.value)
                }
                inputMode="numeric"
                className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
                placeholder="10"
              />
              <FieldError message={errors.parcelLoadMinutes} />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <Clock3 className="size-4" />
                Descărcare colet
              </span>
              <input
                value={form.parcelUnloadMinutes}
                onChange={(event) =>
                  updateField("parcelUnloadMinutes", event.target.value)
                }
                inputMode="numeric"
                className="h-12 rounded-2xl border border-input bg-muted px-4 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus-visible:border-primary/55 focus-visible:ring-4 focus-visible:ring-ring"
                placeholder="10"
              />
              <FieldError message={errors.parcelUnloadMinutes} />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <AppButton type="button" onClick={saveSettings} disabled={isSaving}>
              <Save className="size-4" />
              Salvează setările
            </AppButton>
            <AppButton type="button" variant="outline" onClick={resetToDefaults}>
              <RotateCcw className="size-4" />
              Încarcă valorile implicite
            </AppButton>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
