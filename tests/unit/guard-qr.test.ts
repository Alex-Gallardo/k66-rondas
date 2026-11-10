import { describe, expect, it } from "vitest";
import { parseQrCode } from "../../src/lib/guard/qr";

const code = "a".repeat(32);
const legacy = "ABCDEF0123456789";

describe("QR de ronda", () => {
  it("acepta el código opaco o el enlace impreso", () => {
    expect(parseQrCode(code)).toBe(code);
    expect(parseQrCode(`https://rondas.example/scan/${code}`)).toBe(code);
    expect(parseQrCode(`http://localhost:3000/scan/${code}`)).toBe(code);
    expect(parseQrCode(legacy)).toBe(legacy);
    expect(parseQrCode(`https://rondas.example/scan/${legacy}`)).toBe(legacy);
  });

  it("rechaza enlaces ajenos y códigos malformados", () => {
    expect(parseQrCode(`https://rondas.example/admin/${code}`)).toBeNull();
    expect(parseQrCode(`http://rondas.example/scan/${code}`)).toBeNull();
    expect(parseQrCode("contenido no válido")).toBeNull();
    expect(parseQrCode("abcdef0123456789")).toBeNull();
  });
});
