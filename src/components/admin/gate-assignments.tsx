"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RemoteSelect } from "@/components/admin/remote-select";

export function GateAssignments({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const [candidate, setCandidate] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      ids.map(async (id) => {
        const response = await fetch(`/api/admin/options?type=gates&id=${id}`);
        const data = response.ok ? await response.json() : { items: [] };
        return [id, data.items?.[0]?.name ?? "Garita archivada"] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setNames(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Garitas asignadas</p>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <RemoteSelect
            type="gates"
            label="Buscar garita"
            value={candidate}
            onChange={setCandidate}
            optional
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!candidate || ids.includes(candidate)}
          onClick={() => {
            onChange([...ids, candidate]);
            setCandidate("");
          }}
        >
          <Plus className="size-4" aria-hidden="true" /> Añadir
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
          >
            {names[id] ?? "Cargando…"}
            <button
              type="button"
              aria-label={`Quitar ${names[id] ?? "garita"}`}
              onClick={() => onChange(ids.filter((entry) => entry !== id))}
              className="ml-1 rounded-full p-1 hover:bg-card"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {ids.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Ninguna garita asignada.
          </span>
        )}
      </div>
    </div>
  );
}
