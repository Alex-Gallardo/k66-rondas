import { describe, expect, it } from "vitest";
import { clientIpFromRequest } from "../../src/lib/guard/client-ip";

function request(headers: Record<string, string>) {
  return new Request("https://k66.example/api/visits", { headers });
}

describe("IP de la visita", () => {
  it("no confía en cabeceras fuera de Vercel", () => {
    expect(
      clientIpFromRequest(request({ "x-forwarded-for": "203.0.113.7" }), false),
    ).toBeNull();
  });

  it("acepta la IP normalizada del proxy y rechaza valores inválidos", () => {
    expect(
      clientIpFromRequest(
        request({ "x-vercel-forwarded-for": "203.0.113.7" }),
        true,
      ),
    ).toBe("203.0.113.7");
    expect(
      clientIpFromRequest(request({ "x-forwarded-for": "2001:db8::1" }), true),
    ).toBe("2001:db8::1");
    expect(
      clientIpFromRequest(request({ "x-forwarded-for": "desconocida" }), true),
    ).toBeNull();
  });
});
