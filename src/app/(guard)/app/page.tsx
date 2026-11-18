import { requireActor } from "@/lib/auth";
import { getGuardCurrent } from "@/lib/guard/current";
import { GuardOperations } from "@/components/guard/guard-operations";
import { greetingForTime } from "@/lib/guard/greeting";

export default async function GuardHome() {
  const actor = await requireActor(["guard"]);
  const current = await getGuardCurrent(actor);
  return (
    <GuardOperations
      actor={{ fullName: actor.fullName, employeeCode: actor.employeeCode }}
      initial={current}
      initialGreeting={greetingForTime(
        new Date(),
        current.timezone ?? "America/Guatemala",
      )}
    />
  );
}
