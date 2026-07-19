import { redirect } from "next/navigation";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Livrare activă",
  "Gestionează livrările SkySend, comenzile active, plățile, locațiile salvate și notificările în aplicația client.",
);

export default function ClientDashboardPage() {
  redirect("/client/create-delivery");
}
