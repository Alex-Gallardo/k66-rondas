import { z } from "zod";

export const templateInput = z
  .object({
    id: z.uuid().nullable(),
    gate_id: z.uuid(),
    name: z.string().trim().min(2).max(100),
    is_default: z.boolean(),
    points: z
      .array(z.object({ checkpoint_id: z.uuid(), required: z.boolean() }))
      .min(1),
  })
  .refine(
    (value) =>
      new Set(value.points.map((point) => point.checkpoint_id)).size ===
      value.points.length,
    {
      message: "Cada punto debe aparecer una sola vez.",
    },
  );
