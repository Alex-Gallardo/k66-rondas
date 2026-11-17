"use client";

import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/online-status";

export function PwaSupport() {
  const online = useOnlineStatus();

  useEffect(() => {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // La app sigue funcionando en línea si el navegador no admite el SW.
      });
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-[#fff3cd] px-4 py-3 text-center text-sm font-semibold text-[#5d3a00]"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      Sin conexión. Los QR no se guardarán hasta que vuelva internet.
    </div>
  );
}
