import { MapPin } from "lucide-react";

type VisitLocationProps = {
  geoStatus: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  clientIp: string | null;
};

const statusText: Record<string, string> = {
  denied: "permiso denegado",
  timeout: "sin respuesta del dispositivo",
  unavailable: "no disponible",
  disabled: "desactivada",
};

export function VisitLocation({
  geoStatus,
  latitude,
  longitude,
  accuracyM,
  clientIp,
}: VisitLocationProps) {
  const hasGps =
    geoStatus === "captured" && latitude !== null && longitude !== null;
  const mapUrl = hasGps
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : null;
  return (
    <div className="space-y-1.5 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          GPS:{" "}
          {hasGps
            ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            : (statusText[geoStatus] ?? "no disponible")}
          {hasGps && accuracyM !== null
            ? ` · precisión ±${Math.round(accuracyM)} m`
            : ""}
        </span>
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Ver en mapa
          </a>
        )}
      </p>
      <p className="pl-6 text-muted-foreground">
        IP pública: {clientIp ?? "no registrada"}
      </p>
    </div>
  );
}
