import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";

export default function AdminNotFoundPage() {
  return (
    <section className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="Rută indisponibilă"
        title="Secțiunea nu există în Panoul Administrator"
        description="Navigația adminului include doar modulele operaționale pregătite pentru SkySend."
      />
      <SectionCard
        eyebrow="Navigare"
        title="Revino în Centrul operațional"
        description="Folosește ruta principală pentru a continua administrarea."
      >
        <AppButton asChild>
          <Link href="/admin">Deschide Centrul operațional</Link>
        </AppButton>
      </SectionCard>
    </section>
  );
}
