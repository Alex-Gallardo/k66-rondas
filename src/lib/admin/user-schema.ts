import { z } from "zod";

export const userInput = z.object({
  employee_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,32}$/, "Usa un código de 2–32 caracteres."),
  full_name: z.string().trim().min(3, "Escribe el nombre completo.").max(120),
  role: z.enum(["guard", "supervisor", "admin"]),
  gate_ids: z.array(z.uuid()).max(100),
});

export const userUpdate = userInput
  .omit({ employee_code: true })
  .extend({ active: z.boolean() });
