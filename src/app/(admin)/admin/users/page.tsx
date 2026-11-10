import { requireAdmin } from "@/lib/auth";
import { UsersManager } from "@/components/admin/users-manager";

export default async function UsersPage() {
  await requireAdmin();
  return <UsersManager />;
}
