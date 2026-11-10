import { requireAdmin } from "@/lib/auth";
import { TemplatesManager } from "@/components/admin/templates-manager";

export default async function TemplatesPage() {
  await requireAdmin();
  return <TemplatesManager />;
}
