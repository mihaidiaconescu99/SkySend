"use client";

import { useState } from "react";
import { CreditCard, MapPinned } from "lucide-react";
import { PaymentMethodsView } from "@/components/billing/payment-methods-view";
import { SavedPlacesView } from "@/components/dashboard/saved-places-view";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";

type SavedItemsTab = "places" | "cards";

const savedItemsTabs = [
  {
    id: "places",
    label: "Locatii salvate",
    icon: MapPinned,
  },
  {
    id: "cards",
    label: "Carduri salvate",
    icon: CreditCard,
  },
] as const;

export function SavedItemsView() {
  const [activeTab, setActiveTab] = useState<SavedItemsTab>("places");

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Salvate"
        title="Locatii salvate"
        description="Gestioneaza locatiile folosite des pentru comenzi."
      />

      <div className="grid grid-cols-2 gap-2 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-secondary/35 p-1.5 compact-ui:grid expanded-ui:hidden">
        {savedItemsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="compact-ui:block expanded-ui:hidden">
        {activeTab === "places" ? <SavedPlacesView /> : <PaymentMethodsView />}
      </div>
      <div className="compact-ui:hidden expanded-ui:block">
        <SavedPlacesView />
      </div>
    </section>
  );
}
