import { requireActor } from "@/lib/auth";
import { getGuardCurrent } from "@/lib/guard/current";
import { GuardOperations } from "@/components/guard/guard-operations";
import { greetingForTime } from "@/lib/guard/greeting";
import { getGuardNotificationSummary } from "@/lib/notifications/data";

export default async function GuardHome() {
  const actor = await requireActor(["guard"]);
  const [current, agenda] = await Promise.all([
    getGuardCurrent(actor),
    getGuardNotificationSummary(actor.id).catch(() => ({
      agenda: [],
      unread: 0,
    })),
  ]);
  return (
    <GuardOperations
      actor={{ fullName: actor.fullName, employeeCode: actor.employeeCode }}
      initial={current}
      notifications={{ ...agenda, checkedAt: Date.now() }}
      initialGreeting={greetingForTime(
        new Date(),
        current.timezone ?? "America/Guatemala",
      )}
    />
  );
}
