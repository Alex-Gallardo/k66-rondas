import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";

export default async function NativeScan({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!/^[0-9a-f]{32}$/.test(code)) redirect("/app/scan?invalid=1");
  const actor = await getActor();
  if (!actor) redirect(`/login?next=/scan/${code}`);
  if (actor.mustChangePassword) redirect("/change-password");
  if (actor.role !== "guard") redirect("/admin");
  redirect(`/app/scan?code=${code}`);
}
