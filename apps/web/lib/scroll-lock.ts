"use client";

import { useEffect } from "react";

let lockCount = 0;
let prevBodyOverflow = "";
let prevHtmlOverflow = "";
let prevBodyPaddingRight = "";

/**
 * Bloquea el scroll tanto en <html> como en <body>.
 * Utiliza conteo de referencias para soportar múltiples modales superpuestos
 * sin desbloquear el scroll prematuramente.
 */
export function lockScroll() {
  if (typeof document === "undefined") return;

  if (lockCount === 0) {
    prevBodyOverflow = document.body.style.overflow;
    prevHtmlOverflow = document.documentElement.style.overflow;
    prevBodyPaddingRight = document.body.style.paddingRight;

    // Compensar el ancho del scrollbar para evitar saltos visuales en escritorio
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  lockCount++;
}

/**
 * Desbloquea el scroll de la página cuando todos los modales se han cerrado.
 */
export function unlockScroll() {
  if (typeof document === "undefined") return;

  lockCount = Math.max(0, lockCount - 1);

  if (lockCount === 0) {
    document.body.style.overflow = prevBodyOverflow || "";
    document.documentElement.style.overflow = prevHtmlOverflow || "";
    document.body.style.paddingRight = prevBodyPaddingRight || "";
  }
}

/**
 * Hook para bloquear el scroll de fondo mientras un modal o drawer esté activo.
 */
export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    lockScroll();

    return () => {
      unlockScroll();
    };
  }, [isLocked]);
}
