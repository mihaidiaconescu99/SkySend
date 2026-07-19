import { AdminSettingsView } from "@/components/admin/admin-settings-view";
import { AdminSettingsAccessGate } from "@/components/admin/admin-settings-access-gate";
import { hasAdminSettingsAccess, isAdminSettingsCodeConfigured } from "@/lib/admin-settings-access";
import { getAdminOperationalSettingsFromDB } from "@/lib/admin-data-server";
import { getAdminOperationalSettings } from "@/lib/admin-settings";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Setări",
  "Setări operaționale simple pentru Panoul Administrator SkySend.",
);

export default async function AdminSettingsPage() {
  if (!(await hasAdminSettingsAccess())) {
    return <AdminSettingsAccessGate configured={isAdminSettingsCodeConfigured()} />;
  }
  const dbSettings = await getAdminOperationalSettingsFromDB();

  const settings = dbSettings ?? getAdminOperationalSettings();

  return <AdminSettingsView initialSettings={settings} />;
}
