"use client";

import { useEffect, useState } from "react";

type Option = { id: string; code: string; name: string };
type Resource = "sites" | "gates" | "areas" | "checkpoints";

export function RemoteSelect({
  type,
  value,
  onChange,
  label,
  siteId,
  optional = false,
  disabled = false,
}: {
  type: Resource;
  value: string;
  onChange: (id: string) => void;
  label: string;
  siteId?: string;
  optional?: boolean;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type, q: search });
        if (siteId) params.set("site_id", siteId);
        const response = await fetch(`/api/admin/options?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json();
        let next: Option[] = result.items ?? [];
        if (value && !next.some((item) => item.id === value)) {
          const selectedParams = new URLSearchParams({ type, id: value });
          const selected = await fetch(`/api/admin/options?${selectedParams}`, {
            signal: controller.signal,
          });
          if (selected.ok) {
            const selectedResult = await selected.json();
            next = [...(selectedResult.items ?? []), ...next];
          }
        }
        setOptions(next);
      } catch {
        /* Una búsqueda nueva cancela la anterior. */
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [type, search, siteId, value]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <input
        type="search"
        placeholder={`Buscar ${label.toLowerCase()}…`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        disabled={disabled}
        className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
      />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={!optional}
        className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
      >
        <option value="">{optional ? "Sin selección" : "Seleccionar"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} · {option.code}
          </option>
        ))}
      </select>
    </div>
  );
}
