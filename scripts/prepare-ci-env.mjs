import { readFileSync, writeFileSync } from "node:fs";

const lines = readFileSync(process.argv[2], "utf8").split(/\r?\n/);
const entries = Object.fromEntries(lines.map((line) => {
  const match = /^([A-Z_]+)=(.*)$/.exec(line);
  return match ? [match[1], match[2].replace(/^['"]|['"]$/g, "")] : [];
}).filter((entry) => entry.length));

const url = entries.API_URL;
const publishable = entries.ANON_KEY ?? entries.PUBLISHABLE_KEY;
const secret = entries.SERVICE_ROLE_KEY ?? entries.SECRET_KEY;
if (!url || !publishable || !secret || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) {
  throw new Error("El estado de Supabase local no contiene las claves esperadas.");
}

writeFileSync(".env.local", [
  `NEXT_PUBLIC_SUPABASE_URL=${url}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}`,
  `SUPABASE_SECRET_KEY=${secret}`,
  "APP_BASE_URL=http://127.0.0.1:3000",
].join("\n") + "\n", { mode: 0o600 });
console.log("Entorno local de CI preparado.");
