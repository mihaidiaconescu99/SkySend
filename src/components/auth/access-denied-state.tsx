import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { roleHomePaths, roleLabels } from "@/constants/roles";
import type { UserRole } from "@/types/roles";
import { AppButton } from "@/components/shared/app-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";

export function AccessDeniedState({
  requiredRole,
  currentRole,
  reason,
}: {
  requiredRole?: UserRole | null;
  currentRole?: UserRole | null;
  reason?: "invalid-role" | "no-role" | null;
}) {
  const missingRole = reason === "no-role" || (!requiredRole && !currentRole);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Rută protejată"
        title={
          missingRole
            ? "Nu există un rol de spațiu de lucru pentru acest cont"
            : "Accesul nu este disponibil pentru acest spațiu de lucru"
        }
        description={
          missingRole
            ? "Autentificarea a reușit, dar acest cont nu are momentan un rol SkySend activ."
            : "SkySend limitează fiecare spațiu de lucru la rolul autentificat corect. Contul curent nu poate deschide această zonă."
        }
      />

      <SectionCard
        eyebrow={missingRole ? "Rol necesar" : "Acces refuzat"}
        title={missingRole ? "Lipsește contextul rolului" : "Rol nepotrivit"}
        description={
          missingRole
            ? "Contul este autentificat, dar accesul necesită un rol activ de Client, Operator sau Admin."
            : "Autentificarea a reușit, dar acest spațiu de lucru nu este disponibil cu rolul curent al contului."
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/50 px-4 py-4 text-sm leading-6 text-muted-foreground">
            Rol necesar:
            <strong className="ml-2 text-foreground">
              {requiredRole ? roleLabels[requiredRole] : "Spațiu protejat"}
            </strong>
          </div>
          <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/50 px-4 py-4 text-sm leading-6 text-muted-foreground">
            Rol curent:
            <strong className="ml-2 text-foreground">
              {currentRole ? roleLabels[currentRole] : "Niciun rol rezolvat"}
            </strong>
          </div>
        </div>

        <div className="rounded-[var(--ui-radius-card)] border border-border/80 bg-card px-4 py-4 text-sm leading-6 text-muted-foreground">
          {missingRole
            ? "Dacă acest cont trebuie să acceseze SkySend, atribuie un rol valid."
            : "Dacă acest cont trebuie să acceseze această zonă, actualizează rolul și încearcă din nou."}
        </div>

        <div className="flex flex-wrap gap-3">
          {currentRole ? (
            <AppButton asChild>
              <Link href={roleHomePaths[currentRole]}>
                <ShieldAlert className="size-4" />
                Deschide spațiul {roleLabels[currentRole]}
              </Link>
            </AppButton>
          ) : null}
          <AppButton asChild variant="outline">
            <Link href="/">Înapoi la SkySend</Link>
          </AppButton>
        </div>
      </SectionCard>
    </div>
  );
}
