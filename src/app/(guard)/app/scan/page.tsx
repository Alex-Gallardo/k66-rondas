import { requireActor } from "@/lib/auth";
import { QrScanner } from "@/components/guard/qr-scanner";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await requireActor(["guard"]);
  const { code } = await searchParams;
  return <QrScanner initialCode={code} />;
}
