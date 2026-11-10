import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Database,
  Layers3,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const foundations = [
  {
    icon: Layers3,
    title: "Sistema visual",
    description: "Tokens, componentes y patrones móviles en una página viva.",
  },
  {
    icon: Database,
    title: "Modelo relacional",
    description: "Sedes, garitas, puntos QR, turnos, rondas y visitas.",
  },
  {
    icon: ShieldCheck,
    title: "Acceso por servidor",
    description: "Base preparada para cuentas personales y roles por garita.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-5 sm:px-6 lg:px-10">
      <header className="flex items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <QrCode aria-hidden="true" className="size-6" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">K66 Rondas</p>
            <p className="text-xs text-muted-foreground">Base del producto</p>
          </div>
        </div>
        <Link
          href="/styleguide"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="hidden sm:inline">Ver styleguide</span>
          <span className="sm:hidden">Diseño</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-[#103d32] px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14 lg:py-20">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-32 size-96 rounded-full border border-white/15"
        />
        <div
          aria-hidden="true"
          className="absolute -right-10 -top-16 size-72 rounded-full border border-white/15"
        />
        <div
          aria-hidden="true"
          className="absolute right-8 top-3 size-44 rounded-full border border-white/15"
        />
        <div className="relative max-w-2xl">
          <Badge className="mb-6 border border-white/20 bg-white/10 text-white">
            Fase 1 · Fundamentos
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            Cada ronda, clara desde el primer punto.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#d3e9de] sm:text-lg">
            Estamos construyendo una herramienta sencilla para registrar visitas
            de seguridad con QR y dar visibilidad a cada garita. Esta versión
            contiene la base técnica y visual del MVP.
          </p>
          <Link
            href="/styleguide"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#103d32] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Explorar el sistema visual
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <div className="relative mt-10 flex flex-wrap gap-3 text-xs font-medium text-[#d3e9de]">
          <span className="rounded-full border border-white/20 px-3 py-1.5">
            📍 Puntos por área
          </span>
          <span className="rounded-full border border-white/20 px-3 py-1.5">
            🔐 Cuentas individuales
          </span>
          <span className="rounded-full border border-white/20 px-3 py-1.5">
            📱 Mobile first
          </span>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="foundation-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Lo que ya está preparado
            </p>
            <h2
              id="foundation-heading"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Una base para construir bien
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Los flujos de escaneo, administración y reportes se implementan en
            las siguientes fases.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {foundations.map((item) => (
            <Card
              key={item.title}
              className="border border-border/70 shadow-none ring-0"
            >
              <CardContent className="flex flex-col gap-4 pt-2">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <item.icon aria-hidden="true" className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mt-auto flex flex-col gap-4 pt-14 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>K66 Rondas · Especificación y Fase 1</p>
        <div className="flex flex-wrap gap-5">
          <Link
            className="inline-flex items-center gap-2 hover:text-primary"
            href="/styleguide"
          >
            <BookOpenText aria-hidden="true" className="size-4" /> Styleguide
          </Link>
          <a
            className="inline-flex items-center gap-2 hover:text-primary"
            href="https://github.com/Alex-Gallardo/k66-rondas"
            target="_blank"
            rel="noopener noreferrer"
          >
            Repositorio <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      </footer>
    </main>
  );
}
