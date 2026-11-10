import { requireAdmin } from "@/lib/auth";
import { CatalogManager } from "@/components/admin/catalog-manager";

export default async function AreasPage() {
  await requireAdmin();
  return <CatalogManager resource="areas" />;
}
