"use client";

import { useState } from "react";
import { LogOut, ShieldAlert } from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { roleLabels } from "@/constants/roles";
import { AppButton } from "@/components/shared/app-button";
import type { UserRole } from "@/types/roles";
import { AdminAccessRequestGate } from "@/components/admin/admin-access-request-gate";

export function AdminRestrictedAccessState({
  currentRole,
}: {
  currentRole?: UserRole | null;
}) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (currentRole === "operator") return <AdminAccessRequestGate />;

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut({ redirectUrl: "/admin" });
  }

  return (
    <main className="min-h-screen min-w-0 bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center justify-center">
        <section className="w-full rounded-[var(--ui-radius-panel)] border border-border/80 bg-card/95 p-6 shadow-[var(--elevation-panel)] sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-destructive/35 bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase text-muted-foreground">
            Acces restricționat
          </p>
          <h1 className="mt-2 font-heading text-3xl tracking-tight text-foreground">
            Acces restricționat
          </h1>

          <div className="mt-5 grid gap-4 text-sm leading-7 text-muted-foreground sm:text-base">
            <p>
              Ne pare rău, dar această platformă este disponibilă doar pentru
              administratori, nu pentru conturile de client.
            </p>
            <p>
              Pentru a intra cu un cont de administrator, deconectează-te din
              contul actual și autentifică-te folosind contul de administrator.
            </p>
          </div>

          <div className="mt-6 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
            Rol curent:{" "}
            <strong className="text-foreground">
              {currentRole ? roleLabels[currentRole] : "Niciun rol valid"}
            </strong>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <AppButton
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              <LogOut className="size-4" />
              {isSigningOut ? "Se deconectează..." : "Deconectează-te"}
            </AppButton>
          </div>
        </section>
      </div>
    </main>
  );
}
