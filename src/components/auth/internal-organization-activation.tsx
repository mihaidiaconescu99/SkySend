"use client";

import { useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InternalOrganizationActivation({
  organizationId,
  destination,
}: {
  organizationId: string;
  destination: string;
}) {
  const clerk = useClerk();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void clerk
      .setActive({
        organization: organizationId,
        redirectUrl: destination,
      })
      .catch((error) => {
        console.error("[authorization] Organization activation failed", error);
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [clerk, destination, organizationId]);

  if (failed) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-4 text-foreground">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6">
          <ShieldAlert className="size-8 text-destructive" />
          <h1 className="mt-4 font-heading text-2xl">
            Organizația SkySend nu a putut fi activată
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sesiunea rămâne restricționată. Reautentifică-te după ce verifici
            membership-ul în Clerk.
          </p>
          <Button
            className="mt-5"
            onClick={() => void clerk.signOut({ redirectUrl: "/sign-in" })}
          >
            Reautentificare
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin text-primary" />
        Se activează organizația internă SkySend…
      </div>
    </main>
  );
}
