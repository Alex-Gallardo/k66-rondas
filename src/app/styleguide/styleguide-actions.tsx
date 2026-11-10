"use client";

import { useState } from "react";
import { CheckCircle2, RotateCw, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function StyleguideActions() {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Dialog>
          <DialogTrigger render={<Button variant="secondary" />}>
            <Sparkles aria-hidden="true" />
            Ver confirmación
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-[#e7f5ec] text-[#157347]">
                <CheckCircle2 aria-hidden="true" className="size-6" />
              </div>
              <DialogTitle>Punto registrado</DialogTitle>
              <DialogDescription>
                Entrada de bodega · hoy a las 09:42. El registro ya está
                guardado.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button className="w-full sm:w-auto" />}>
                Continuar ronda
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" />}>
            <RotateCw aria-hidden="true" />
            Ver alerta importante
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-[#fff3e2] text-[#a56108]">
                <TriangleAlert aria-hidden="true" />
              </AlertDialogMedia>
              <AlertDialogTitle>¿Rotar este QR?</AlertDialogTitle>
              <AlertDialogDescription>
                El código actual dejará de registrar visitas. Imprime y coloca
                el nuevo antes de continuar las rondas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogCancel
                variant="default"
                onClick={() =>
                  setMessage("Ejemplo visual: no se cambió ningún QR.")
                }
              >
                Entendido
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {message && (
        <p role="status" className="text-sm font-medium text-primary">
          {message}
        </p>
      )}
    </div>
  );
}
