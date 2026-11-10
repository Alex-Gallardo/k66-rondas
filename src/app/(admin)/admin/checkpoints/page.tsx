import { requireAdmin } from "@/lib/auth";
import { CatalogManager } from "@/components/admin/catalog-manager";

export default async function CheckpointsPage() {
  await requireAdmin();
  return <CatalogManager resource="checkpoints" />;
}
