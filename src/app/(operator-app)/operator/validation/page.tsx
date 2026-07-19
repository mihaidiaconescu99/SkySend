import { ArrowLeft, ClipboardCheck, Route } from "lucide-react";
import { OperatorValidationFlowView } from "@/components/operator/operator-validation-flow-view";
import { PageHeader } from "@/components/shared/page-header";
import { getOperatorValidationContext } from "@/lib/operator-validation";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Operator Validation Flow",
  "Ridicare and drop-off validation flow for SkySend operator deliveries in Pitesti.",
);

export default function OperatorValidationPage() {
  const context = getOperatorValidationContext();

  return (
    <section className="flex flex-col gap-6">
      <div className="app-container">
        <PageHeader
          eyebrow="Validation Flow"
          title="Ridicare, load and drop-off validation."
          description="A realistic operator flow for package handoff checks. It uses test sender, recipient and PIN/QR confirmation without hardware integration."
          actions={[
            {
              label: "Înapoi la operator",
              href: "/operator",
              variant: "ghost",
              icon: <ArrowLeft className="size-4" />,
            },
            {
              label: "Current Task",
              href: "/operator#missions",
              variant: "outline",
              icon: <ClipboardCheck className="size-4" />,
            },
            {
              label: "Validations",
              href: "/operator#pads",
              variant: "outline",
              icon: <Route className="size-4" />,
            },
          ]}
        />
      </div>

      {context ? (
        <OperatorValidationFlowView context={context} />
      ) : (
        <div className="app-container">
          <div className="rounded-[var(--ui-radius-card)] border border-border/80 bg-card p-6 text-sm leading-7 text-muted-foreground shadow-[var(--elevation-card)]">
            No active operator order is available for validation in the current
            dataset.
          </div>
        </div>
      )}
    </section>
  );
}
