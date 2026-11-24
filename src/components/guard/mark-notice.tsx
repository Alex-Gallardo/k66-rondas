"use client";

import { useEffect } from "react";

export function MarkNotice({ id }: { id: string }) {
  useEffect(() => {
    void fetch("/api/guard/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }, [id]);
  return null;
}
