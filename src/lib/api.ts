import { NextResponse } from "next/server";
import type { Actor, Role } from "@/lib/auth";
import { getActor } from "@/lib/auth";

export function apiError(code: string, status: number, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function apiActor(roles?: Role[]): Promise<Actor | NextResponse> {
  const actor = await getActor();
  if (!actor)
    return apiError("NOT_AUTHENTICATED", 401, "Inicia sesión para continuar.");
  if (actor.mustChangePassword) {
    return apiError(
      "PASSWORD_CHANGE_REQUIRED",
      403,
      "Cambia tu contraseña para continuar.",
    );
  }
  if (roles && !roles.includes(actor.role)) {
    return apiError("FORBIDDEN", 403, "No tienes permiso para esta acción.");
  }
  return actor;
}

export function isApiError(value: Actor | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export function checkMutationRequest(
  request: Request,
  contentType = "application/json",
) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const actual = new URL(origin);
      const hosts = [
        request.headers.get("host"),
        request.headers.get("x-forwarded-host"),
      ].filter(Boolean);
      const protocol =
        request.headers.get("x-forwarded-proto") ??
        new URL(request.url).protocol.slice(0, -1);
      if (!hosts.includes(actual.host) || actual.protocol !== `${protocol}:`) {
        return apiError("INVALID_ORIGIN", 403, "Origen no permitido.");
      }
    } catch {
      return apiError("INVALID_ORIGIN", 403, "Origen no permitido.");
    }
  }
  if (!request.headers.get("content-type")?.startsWith(contentType)) {
    return apiError(
      "INVALID_CONTENT_TYPE",
      415,
      "Formato de solicitud no válido.",
    );
  }
  return null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
