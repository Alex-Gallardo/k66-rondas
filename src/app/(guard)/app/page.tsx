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
  const now = new Date();
  return (
    <GuardOperations
      actor={{ fullName: actor.fullName, employeeCode: actor.employeeCode }}
      initial={current}
      notifications={{ ...agenda, checkedAt: now.getTime() }}
      initialGreeting={greetingForTime(
        now,
        current.timezone ?? "America/Guatemala",
      )}
    />
  );
}
