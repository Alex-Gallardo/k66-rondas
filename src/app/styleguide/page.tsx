import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  LayoutGrid,
  MapPin,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Type,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { StyleguideActions } from "./styleguide-actions";

export const metadata: Metadata = {
  title: "Styleguide",
  description: "Sistema visual de K66 Rondas para móvil y administración.",
};

const swatches = [
  {
    name: "Primary",
    hex: "#087F68",
    className: "bg-[#087f68]",
    usage: "Acción principal",
  },
  {
    name: "Deep",
    hex: "#103D32",
    className: "bg-[#103d32]",
    usage: "Superficies destacadas",
  },
  {
    name: "Canvas",
    hex: "#F6F8F7",
    className: "bg-[#f6f8f7]",
    usage: "Fondo general",
  },
  {
    name: "Surface",
    hex: "#FFFFFF",
    className: "bg-white",
    usage: "Tarjetas y modales",
  },
  {
    name: "Success",
    hex: "#157347",
    className: "bg-[#157347]",
    usage: "Registro confirmado",
  },
  {
    name: "Warning",
    hex: "#A56108",
    className: "bg-[#a56108]",
    usage: "Pendiente o incompleto",
  },
  {
    name: "Danger",
    hex: "#B42318",
    className: "bg-[#b42318]",
    usage: "Error o acción delicada",
  },
  {
    name: "Ink",
    hex: "#18252A",
    className: "bg-[#18252a]",
    usage: "Texto principal",
  },
];

const visitRows = [
  {
    time: "09:42",
    point: "Entrada de bodega",
    guard: "Carlos Méndez",
    gate: "Central",
    status: "Confirmado",
  },
  {
    time: "09:37",
    point: "Patio de carga",
    guard: "Carlos Méndez",
    gate: "Central",
    status: "Confirmado",
  },
  {
    time: "09:21",
    point: "Acceso principal",
    guard: "María López",
    gate: "Anexa",
    status: "Confirmado",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {title}
        </h2>
      </div>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <main className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-[#f6f8f7]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <QrCode aria-hidden="true" className="size-5" />
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-tight">
                K66 Rondas
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Sistema visual · v1.0
              </span>
            </div>
          </Link>
          <nav
            aria-label="Secciones del styleguide"
            className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex"
          >
            <a href="#fundamentos" className="hover:text-primary">
              Fundamentos
            </a>
            <a href="#componentes" className="hover:text-primary">
              Componentes
            </a>
            <a href="#patrones" className="hover:text-primary">
              Patrones
            </a>
            <a href="#accesibilidad" className="hover:text-primary">
              Accesibilidad
            </a>
          </nav>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Volver al inicio</span>
            <span className="sm:hidden">Volver</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-[#103d32] px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14">
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-32 size-96 rounded-full border border-white/15"
          />
          <div
            aria-hidden="true"
            className="absolute -right-4 -top-16 size-72 rounded-full border border-white/15"
          />
          <div className="relative grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <Badge className="border border-white/20 bg-white/10 text-white">
                Diseño del MVP
              </Badge>
              <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">
                Rondas fáciles de registrar. Datos fáciles de entender.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#d3e9de]">
                Una interfaz amable para quien camina la planta y precisa para
                quien supervisa. Cada decisión visual prioriza lectura rápida,
                confianza y pocos pasos.
              </p>
              <div className="mt-7 flex flex-wrap gap-2 text-xs text-[#d3e9de]">
                <span className="rounded-full border border-white/20 px-3 py-1.5">
                  Mobile first
                </span>
                <span className="rounded-full border border-white/20 px-3 py-1.5">
                  Accesible
                </span>
                <span className="rounded-full border border-white/20 px-3 py-1.5">
                  Fácil de escalar
                </span>
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#d3e9de]">
                  Vista rápida
                </span>
                <span className="flex size-8 items-center justify-center rounded-full bg-white/15">
                  <Bell aria-hidden="true" className="size-4" />
                </span>
              </div>
              <div className="mt-5 rounded-2xl bg-white p-5 text-[#18252a] shadow-xl shadow-black/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#5d6d72]">
                      Garita Central
                    </p>
                    <p className="mt-1 text-lg font-semibold">
                      Ronda en progreso
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e8f4ef] text-[#087f68]">
                    <ShieldCheck aria-hidden="true" className="size-6" />
                  </div>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <span className="text-sm text-[#5d6d72]">
                    Puntos registrados
                  </span>
                  <strong className="text-xl">3 / 7</strong>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8f4ef]">
                  <div className="h-full w-[43%] rounded-full bg-[#087f68]" />
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#f6f8f7] p-3 text-sm">
                  <CheckCircle2
                    aria-hidden="true"
                    className="size-5 text-[#157347]"
                  />
                  <span>Entrada de bodega registrada</span>
                  <span className="ml-auto text-xs text-[#5d6d72]">09:42</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="fundamentos" className="scroll-mt-24 pt-16">
          <SectionHeading
            eyebrow="01 · Fundamentos"
            title="Una base visual consistente"
            description="Color, tipografía y espacio definen una experiencia clara en planta y en escritorio."
            icon={LayoutGrid}
          />
          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <Card className="border border-border/80 shadow-none ring-0">
              <CardHeader>
                <CardTitle>Paleta de color</CardTitle>
                <CardDescription>
                  Los estados nunca dependen solo del color: siempre incluyen
                  texto o icono.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {swatches.map((swatch) => (
                  <div key={swatch.name} className="min-w-0">
                    <div
                      className={`h-20 rounded-xl border border-border/70 ${swatch.className}`}
                    />
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <strong className="text-xs">{swatch.name}</strong>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {swatch.hex}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {swatch.usage}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="border border-border/80 shadow-none ring-0">
              <CardHeader>
                <CardTitle>Tipografía y ritmo</CardTitle>
                <CardDescription>
                  Geist Sans, números tabulares y texto legible desde 16 px en
                  móvil.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="border-b border-border pb-4">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Display · 40 / 44
                  </span>
                  <p className="mt-1 text-4xl font-semibold tracking-[-0.045em]">
                    Ronda clara.
                  </p>
                </div>
                <div className="border-b border-border pb-4">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Heading · 28 / 34
                  </span>
                  <p className="mt-1 text-[28px] font-semibold tracking-tight">
                    Puntos registrados
                  </p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Body · 16 / 24
                  </span>
                  <p className="mt-1 text-base leading-6">
                    Una lectura cómoda incluso durante el recorrido.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Type aria-hidden="true" className="size-4 text-primary" />
                  <span className="text-xs text-muted-foreground">
                    Espaciado base: 4 · 8 · 12 · 16 · 24 · 32 px
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="componentes" className="scroll-mt-24 pt-16">
          <SectionHeading
            eyebrow="02 · Componentes"
            title="Piezas listas para usar"
            description="Componentes shadcn/ui adaptados con una escala táctil y estados visibles."
            icon={Sparkles}
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border border-border/80 shadow-none ring-0">
              <CardHeader>
                <CardTitle>Botones y acciones</CardTitle>
                <CardDescription>
                  El CTA primario guía el siguiente paso; las acciones delicadas
                  son explícitas.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button>
                  <QrCode aria-hidden="true" /> Leer QR
                </Button>
                <Button variant="secondary">
                  <Plus aria-hidden="true" /> Crear punto
                </Button>
                <Button variant="outline">
                  <Download aria-hidden="true" /> Exportar
                </Button>
                <Button variant="ghost">
                  Ver detalle <ChevronRight aria-hidden="true" />
                </Button>
                <Button variant="destructive">Desactivar</Button>
                <Button disabled>Cargando…</Button>
              </CardContent>
            </Card>
            <Card className="border border-border/80 shadow-none ring-0">
              <CardHeader>
                <CardTitle>Estados y progreso</CardTitle>
                <CardDescription>
                  Texto y símbolo acompañan al color en cada estado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-[#e7f5ec] text-[#157347]">
                    <Check aria-hidden="true" /> Completada
                  </Badge>
                  <Badge className="bg-[#fff3e2] text-[#a56108]">
                    <Clock3 aria-hidden="true" /> En progreso
                  </Badge>
                  <Badge variant="destructive">
                    <TriangleAlert aria-hidden="true" /> Incompleta
                  </Badge>
                  <Badge variant="outline">Pendiente</Badge>
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium">Cobertura de la ronda</span>
                    <span className="tabular-nums text-muted-foreground">
                      3 de 7
                    </span>
                  </div>
                  <Progress
                    value={43}
                    aria-label="Cobertura de la ronda: 43 por ciento"
                    className="[&_[data-slot=progress-track]]:h-2"
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 shadow-none ring-0">
              <CardHeader>
                <CardTitle>Campos y validación</CardTitle>
                <CardDescription>
                  Etiquetas visibles, ayuda breve y error cerca del campo.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-code">Código de empleado</Label>
                  <Input id="employee-code" placeholder="Ej. G-0042" />
                  <p className="text-xs text-muted-foreground">
                    Asignado por administración.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area-name">Nombre del área</Label>
                  <Input id="area-name" defaultValue="Bodega" />
                  <p className="text-xs text-muted-foreground">
                    Nombre visible en el registro.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="observation">Observación opcional</Label>
                  <Textarea
                    id="observation"
                    placeholder="Describe lo que encontraste..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Hasta 1000 caracteres; el escaneo se guarda antes.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="invalid-code">Ejemplo de error</Label>
                  <Input
                    id="invalid-code"
                    aria-invalid="true"
                    defaultValue=""
                    placeholder="Código requerido"
                  />
                  <p className="text-xs font-medium text-destructive">
                    Ingresa el código de empleado para continuar.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 shadow-none ring-0">
              <CardHeader>
                <CardTitle>Alertas y confirmaciones</CardTitle>
                <CardDescription>
                  Una acción normal confirma sin fricción; una irreversible pide
                  contexto.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-start gap-3 rounded-xl border border-[#cbe8d7] bg-[#f0faf4] p-4">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-[#157347]"
                  />
                  <div>
                    <strong className="text-sm">Punto registrado</strong>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Entrada de bodega · 09:42
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-[#f2d7af] bg-[#fff8ed] p-4">
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-[#a56108]"
                  />
                  <div>
                    <strong className="text-sm">
                      Sin ubicación del dispositivo
                    </strong>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      El punto QR sí quedó registrado.
                    </p>
                  </div>
                </div>
                <StyleguideActions />
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="patrones" className="scroll-mt-24 pt-16">
          <SectionHeading
            eyebrow="03 · Patrones de producto"
            title="Del teléfono al panel"
            description="Dos contextos, la misma jerarquía: primero la acción que importa, después el detalle."
            icon={Smartphone}
          />
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <Card className="border border-border/80 bg-[#e9f0ec] shadow-none ring-0">
              <CardHeader>
                <CardTitle>Guardia · móvil</CardTitle>
                <CardDescription>
                  Ejemplo de pantalla de inicio, diseñada a 390 px.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mx-auto max-w-[390px] overflow-hidden rounded-[2rem] border-[6px] border-[#20332d] bg-[#f6f8f7] shadow-xl shadow-[#103d32]/15">
                  <div className="flex items-center justify-between bg-white px-5 pb-5 pt-7">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Buen turno, Carlos 👋
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        Garita Central
                      </p>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-full bg-[#e8f4ef] text-primary">
                      <ShieldCheck aria-hidden="true" className="size-5" />
                    </div>
                  </div>
                  <div className="space-y-4 px-4 py-5">
                    <div className="rounded-2xl bg-[#103d32] p-5 text-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#d3e9de]">
                          Ronda actual
                        </span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
                          En progreso
                        </span>
                      </div>
                      <p className="mt-3 text-2xl font-semibold tabular-nums">
                        3 <span className="text-[#a7cbb9]">/ 7 puntos</span>
                      </p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                        <div className="h-full w-[43%] rounded-full bg-[#8de0b8]" />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-4">
                      <p className="text-xs text-muted-foreground">
                        Siguiente punto sugerido
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                        <MapPin
                          aria-hidden="true"
                          className="size-4 text-primary"
                        />{" "}
                        Puerta de producción
                      </div>
                      <p className="mt-1 pl-6 text-xs text-muted-foreground">
                        Área de producción
                      </p>
                    </div>
                    <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white">
                      <QrCode aria-hidden="true" className="size-5" /> Leer QR
                    </div>
                    <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                      <span>Último registro</span>
                      <span>Entrada de bodega · 09:42</span>
                    </div>
                  </div>
                  <div className="flex justify-around border-t border-border bg-white px-3 py-3 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-primary">Inicio</span>
                    <span>Historial</span>
                    <span>Perfil</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/80 shadow-none ring-0">
              <CardHeader>
                <CardTitle>Administración · escritorio</CardTitle>
                <CardDescription>
                  Filtros claros, datos legibles y acción de exportación.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-2xl border border-border bg-white">
                  <div className="flex flex-col justify-between gap-4 border-b border-border p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Operación de hoy
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">
                        Visitas recientes
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted-foreground">
                        <Search aria-hidden="true" className="size-4" /> Buscar
                        punto
                      </div>
                      <div className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium">
                        <Download aria-hidden="true" className="size-4" /> CSV
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hora</TableHead>
                          <TableHead>Punto</TableHead>
                          <TableHead>Guardia</TableHead>
                          <TableHead>Garita</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitRows.map((row) => (
                          <TableRow key={`${row.time}-${row.point}`}>
                            <TableCell className="font-medium tabular-nums">
                              {row.time}
                            </TableCell>
                            <TableCell>{row.point}</TableCell>
                            <TableCell>{row.guard}</TableCell>
                            <TableCell>{row.gate}</TableCell>
                            <TableCell>
                              <Badge className="bg-[#e7f5ec] text-[#157347]">
                                {row.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                    <span>Mostrando 3 de 24 visitas</span>
                    <span className="flex items-center gap-1 font-medium text-primary">
                      Ver todas{" "}
                      <ArrowRight aria-hidden="true" className="size-3" />
                    </span>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[#eef7f1] p-4">
                    <p className="text-xs text-muted-foreground">
                      Rondas completas
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      18
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#fff8ed] p-4">
                    <p className="text-xs text-muted-foreground">En curso</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      4
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f1f4f2] p-4">
                    <p className="text-xs text-muted-foreground">
                      Puntos activos
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      64
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Las pantallas de esta sección son ejemplos visuales con datos
            ficticios; los flujos funcionales se implementan en fases
            posteriores.
          </p>
        </section>

        <section id="accesibilidad" className="scroll-mt-24 pt-16">
          <SectionHeading
            eyebrow="04 · Reglas de uso"
            title="Diseñar para el turno real"
            description="La interfaz debe funcionar con prisa, luz variable, guantes y conexiones imperfectas."
            icon={ShieldCheck}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Smartphone,
                title: "Táctil primero",
                text: "Acciones principales de al menos 44 px de alto y espacio suficiente entre controles.",
              },
              {
                icon: Type,
                title: "Texto claro",
                text: "Cuerpo de 16 px, etiquetas visibles y mensajes que expliquen qué ocurrió.",
              },
              {
                icon: Camera,
                title: "Permisos explicados",
                text: "Cámara y ubicación se piden cuando hacen falta, con una salida si se rechazan.",
              },
              {
                icon: CheckCircle2,
                title: "Confirmación real",
                text: "Mostrar éxito solo después de recibir confirmación del servidor.",
              },
            ].map((rule) => (
              <Card
                key={rule.title}
                className="border border-border/80 shadow-none ring-0"
              >
                <CardContent className="space-y-3 pt-2">
                  <rule.icon
                    aria-hidden="true"
                    className="size-5 text-primary"
                  />
                  <h3 className="text-sm font-semibold">{rule.title}</h3>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {rule.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <footer className="mt-16 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>K66 Rondas · Sistema visual para el MVP</span>
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
          >
            Volver al inicio{" "}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </footer>
      </div>
    </main>
  );
}
