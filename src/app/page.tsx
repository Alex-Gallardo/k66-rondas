import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";

export default async function Home() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.mustChangePassword) redirect("/change-password");
  redirect(actor.role === "guard" ? "/app" : "/admin");
}
