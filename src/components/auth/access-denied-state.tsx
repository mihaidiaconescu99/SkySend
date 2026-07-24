import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { roleHomePaths, roleLabels } from "@/constants/roles";
import type { UserRole } from "@/types/roles";
import { AppButton } from "@/components/shared/app-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";

type AccessDeniedReason =
  | "invalid-role"
  | "no-role"
  | "authorization-not-configured"
  | "authorization-unavailable";

export function AccessDeniedState({
  requiredRole,
  currentRole,
  reason,
}: {
  requiredRole?: UserRole | null;
  currentRole?: UserRole | null;
  reason?: AccessDeniedReason | null;
}) {
  const configurationError = reason === "authorization-not-configured";
  const authorizationUnavailable = reason === "authorization-unavailable";
  const authorizationError = configurationError || authorizationUnavailable;
  const missingRole =
    !authorizationError &&
    (reason === "no-role" || (!requiredRole && !currentRole));

  const title = authorizationError
    ? configurationError
      ? "Autorizarea internă nu este configurată"
      : "Autorizarea internă este temporar indisponibilă"
    : missingRole
      ? "Nu există un rol de spațiu de lucru pentru acest cont"
      : "Accesul nu este disponibil pentru acest spațiu de lucru";

  const description = authorizationError
    ? "Accesul rămâne blocat până când membership-ul organizației SkySend poate fi verificat server-side."
    : missingRole
      ? "Autentificarea a reușit, dar acest cont nu are momentan un rol SkySend valid."
      : "SkySend limitează fiecare spațiu de lucru la rolul autentificat corect.";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Rută protejată"
        title={title}
        description={description}
      />

      <SectionCard
        eyebrow={
          authorizationError
            ? "Verificare server-side"
            : missingRole
              ? "Rol necesar"
              : "Acces refuzat"
        }
        title={
          authorizationError
            ? "Acces blocat preventiv"
            : missingRole
              ? "Lipsește contextul rolului"
              : "Rol nepotrivit"
        }
        description={
          authorizationError
            ? configurationError
              ? "Configurează ID-ul organizației interne SkySend în mediul serverului."
              : "Clerk nu a putut confirma membership-ul în acest moment."
            : missingRole
              ? "Accesul necesită un rol valid de Client, Operator sau Administrator."
              : "Contul curent nu poate deschide această zonă."
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
          {authorizationError
            ? "Niciun rol nu este acordat din date trimise de browser sau dintr-un fallback local."
            : missingRole
              ? "Verifică membership-ul și rolul în organizația SkySend din Clerk."
              : "Folosește spațiul de lucru asociat rolului curent."}
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
