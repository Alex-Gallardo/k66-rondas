import { isIP } from "node:net";

// Vercel normaliza estas cabeceras antes de entregar la solicitud a la función.
// Fuera de Vercel no confiamos en cabeceras que podría enviar un cliente directo.
export function clientIpFromRequest(
  request: Request,
  trustedProxy = Boolean(process.env.VERCEL),
): string | null {
  if (!trustedProxy) return null;
  const raw =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for");
  const candidate = raw?.split(",", 1)[0]?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}
