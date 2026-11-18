import { describe, expect, it } from "vitest";
import { greetingForTime } from "../../src/lib/guard/greeting";

describe("saludo según hora de la sede", () => {
  it("cambia de noche a mañana, tarde y noche en Guatemala", () => {
    const timezone = "America/Guatemala";
    expect(greetingForTime(new Date("2026-11-18T10:59:00Z"), timezone)).toBe(
      "Buenas noches 🌙",
    );
    expect(greetingForTime(new Date("2026-11-18T11:00:00Z"), timezone)).toBe(
      "Buenos días ☀️",
    );
    expect(greetingForTime(new Date("2026-11-18T18:00:00Z"), timezone)).toBe(
      "Buenas tardes 🌤️",
    );
    expect(greetingForTime(new Date("2026-11-19T00:00:00Z"), timezone)).toBe(
      "Buenas noches 🌙",
    );
  });
});
