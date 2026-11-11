import { requireAdmin } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { SiteSettingsManager } from "@/components/admin/site-settings-manager";

export default async function SettingsPage() {
  await requireAdmin();
  const db = createAdminSupabase();
  const [sitesResult, settingsResult] = await Promise.all([
    db.from("sites").select("id,name,active").order("name"),
    db
      .from("site_settings")
      .select("site_id,geo_enabled,idle_logout_minutes,photo_retention_days"),
  ]);
  if (sitesResult.error || settingsResult.error)
    throw new Error("No pudimos cargar la configuración.");
  const bySite = new Map(
    (settingsResult.data ?? []).map((item) => [item.site_id, item]),
  );
  const sites = (sitesResult.data ?? []).map((site) => ({
    ...site,
    geo_enabled: bySite.get(site.id)?.geo_enabled ?? true,
    idle_logout_minutes: bySite.get(site.id)?.idle_logout_minutes ?? 30,
    photo_retention_days: bySite.get(site.id)?.photo_retention_days ?? 90,
  }));
  return <SiteSettingsManager sites={sites} />;
}
