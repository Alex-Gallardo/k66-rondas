"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  DoorOpen,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  QrCode,
  Route,
  Users,
} from "lucide-react";
import type { Role } from "@/lib/auth";

const items = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, adminOnly: false },
  {
    href: "/admin/visits",
    label: "Registros",
    icon: ListChecks,
    adminOnly: false,
  },
  { href: "/admin/users", label: "Usuarios", icon: Users, adminOnly: true },
  { href: "/admin/sites", label: "Sedes", icon: Building2, adminOnly: true },
  { href: "/admin/gates", label: "Garitas", icon: DoorOpen, adminOnly: true },
  { href: "/admin/areas", label: "Áreas", icon: MapPinned, adminOnly: true },
  {
    href: "/admin/checkpoints",
    label: "Puntos QR",
    icon: QrCode,
    adminOnly: true,
  },
  {
    href: "/admin/templates",
    label: "Plantillas",
    icon: Route,
    adminOnly: true,
  },
];

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Administración"
      className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
    >
      {items
        .filter((item) => !item.adminOnly || role === "admin")
        .map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
            >
              <Icon className="size-4" aria-hidden="true" /> {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
