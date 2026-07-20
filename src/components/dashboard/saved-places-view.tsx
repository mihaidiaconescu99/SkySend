"use client";

import { useMemo, useState } from "react";
import { MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSavedPlaces } from "@/hooks/use-saved-places";
import type { SavedPlace, SavedPlaceCategory } from "@/types/saved-places";

type SavedPlaceFormState = {
  id: string | null;
  label: string;
  address: string;
  latitude: string;
  longitude: string;
  notes: string;
  category: SavedPlaceCategory;
};

const emptyForm: SavedPlaceFormState = {
  id: null,
  label: "",
  address: "",
  latitude: "",
  longitude: "",
  notes: "",
  category: "custom",
};

const categoryLabels: Record<SavedPlaceCategory, string> = {
  home: "Acasă",
  school: "Școală",
  work: "Serviciu",
  custom: "Personalizat",
  recent: "Recent",
};

function formFromPlace(place: SavedPlace): SavedPlaceFormState {
  return {
    id: place.id,
    label: place.label,
    address: place.address,
    latitude: String(place.coordinates.latitude),
    longitude: String(place.coordinates.longitude),
    notes: place.notes,
    category: place.category === "recent" ? "custom" : place.category,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function SavedPlacesView() {
  const {
    savedPlaces: places,
    savePlace,
    deleteSavedPlace,
  } = useSavedPlaces();
  const [form, setForm] = useState<SavedPlaceFormState>(emptyForm);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const canSave = useMemo(() => {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    return (
      form.label.trim().length > 0 &&
      form.address.trim().length > 0 &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    );
  }, [form]);

  const handleSave = async () => {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!canSave) {
      setFormMessage("Adaugă un nume, o adresă și coordonate valide înainte de salvare.");
      return;
    }

    await savePlace(
      {
        label: form.label,
        address: form.address,
        notes: form.notes,
        category: form.category,
        coordinates: { latitude, longitude },
      },
      form.id ?? undefined,
    );
    setForm(emptyForm);
    setFormMessage("Locația salvată a fost actualizată.");
  };

  const handleDelete = async (placeId: string) => {
    await deleteSavedPlace(placeId);
    setForm((currentValue) =>
      currentValue.id === placeId ? emptyForm : currentValue,
    );
  };

  return (
    <div className="grid gap-6 expanded-ui:grid-cols-[minmax(0,1fr)_24rem] expanded-ui:items-start">
      <SectionCard
        eyebrow="Locații"
        title={places.length ? "Locații salvate" : "Nu există locații salvate încă"}
        description={
          places.length
            ? "Folosește locațiile salvate pentru ridicare sau livrare mai rapid."
            : "Adaugă puncte de ridicare și livrare pe care le folosești des."
        }
      >
        {places.length ? (
          <div className="grid gap-3">
            {places.map((place) => (
              <article
                key={place.id}
                className="grid gap-4 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-secondary/35 p-4 expanded-ui:grid-cols-[minmax(0,1fr)_auto] expanded-ui:items-start"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPinned className="size-4 text-primary" />
                    <p className="font-medium text-foreground">{place.label}</p>
                    <StatusBadge
                      label={categoryLabels[place.category]}
                      tone="neutral"
                    />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {place.address}
                  </p>
                  {place.notes ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {place.notes}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Actualizat la {formatDate(place.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 expanded-ui:justify-end">
                  <AppButton
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Editează locația ${place.label}`}
                    onClick={() => setForm(formFromPlace(place))}
                  >
                    <Pencil className="size-4" />
                    <span className="hidden sm:inline">Editează</span>
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Șterge locația ${place.label}`}
                    onClick={() => handleDelete(place.id)}
                  >
                    <Trash2 className="size-4" />
                    <span className="hidden sm:inline">Șterge</span>
                  </AppButton>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-dashed border-border/80 bg-secondary/30 p-5">
            <div className="flex items-start gap-3">
              <MapPinned className="mt-0.5 size-4 text-foreground" />
              <p className="text-sm leading-6 text-muted-foreground">
                Salvează locații precum Acasă, Școală, Serviciu sau un magazin frecvent.
                Vor apărea ca scurtături în pasul Traseu.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow={form.id ? "Editează locația" : "Adaugă locație"}
        title={form.id ? "Actualizează locația salvată" : "Adaugă locație salvată"}
        description="Folosește coordonate exacte dintr-un punct cunoscut în zona activă Pitești."
      >
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Nume</span>
            <input
              value={form.label}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  label: event.target.value,
                }))
              }
              placeholder="Acasă, Serviciu, VIVO Mall"
              className="h-12 rounded-2xl border border-input bg-card px-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Adresă</span>
            <input
              value={form.address}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  address: event.target.value,
                }))
              }
              placeholder="Stradă, număr, oraș"
              className="h-12 rounded-2xl border border-input bg-card px-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring"
            />
          </label>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-foreground">Latitudine</span>
              <input
                value={form.latitude}
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    latitude: event.target.value,
                  }))
                }
                inputMode="decimal"
                className="h-12 w-full min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring"
              />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-medium text-foreground">Longitudine</span>
              <input
                value={form.longitude}
                onChange={(event) =>
                  setForm((currentValue) => ({
                    ...currentValue,
                    longitude: event.target.value,
                  }))
                }
                inputMode="decimal"
                className="h-12 w-full min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring"
              />
            </label>
          </div>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Categorie</span>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  category: event.target.value as SavedPlaceCategory,
                }))
              }
              className="h-12 rounded-2xl border border-input bg-card px-4 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring"
            >
              <option value="home">Acasă</option>
              <option value="school">Școală</option>
              <option value="work">Serviciu</option>
              <option value="custom">Personalizat</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              Note locație
            </span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((currentValue) => ({
                  ...currentValue,
                  notes: event.target.value,
                }))
              }
              rows={3}
              className="min-h-28 rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring"
            />
          </label>
          {formMessage ? (
            <p className="text-sm leading-6 text-muted-foreground">{formMessage}</p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <AppButton
              type="button"
              variant="outline"
              onClick={() => {
                setForm(emptyForm);
                setFormMessage(null);
              }}
            >
              Resetează
            </AppButton>
            <AppButton type="button" disabled={!canSave} onClick={handleSave}>
              <Plus className="size-4" />
              {form.id ? "Actualizează locația" : "Salvează locația"}
            </AppButton>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
