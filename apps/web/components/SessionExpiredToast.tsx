"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * SessionExpiredToast
 *
 * Detecta el query param ?session=expired en la URL (inyectado por el middleware
 * cuando encuentra una cookie JWT inválida o cifrada con un secret diferente).
 *
 * Comportamiento:
 * 1. Muestra un banner/toast no intrusivo en la parte superior de la pantalla.
 * 2. Lo elimina automáticamente después de 5 segundos.
 * 3. Limpia el query param de la URL para que no quede visible ni se repita.
 */
export default function SessionExpiredToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Auth");

  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (searchParams.get("session") === "expired") {
      setVisible(true);

      // Limpiar el query param de la URL sin recargar la página
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("session");
      router.replace(cleanUrl.pathname + (cleanUrl.search || ""), { scroll: false });

      // Iniciar cuenta regresiva de 5 segundos
      const exitTimer = setTimeout(() => setExiting(true), 4500);
      const hideTimer = setTimeout(() => setVisible(false), 5000);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [searchParams]);

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between
        px-4 py-3 md:px-6
        bg-amber-500 dark:bg-amber-600
        text-white text-sm font-medium
        shadow-lg
        transition-all duration-500
        ${exiting ? "opacity-0 -translate-y-full" : "opacity-100 translate-y-0"}
      `}
    >
      {/* Ícono de advertencia */}
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <span>{t("session_expired_message")}</span>
      </div>

      {/* Botón de cierre manual */}
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => setVisible(false), 500);
        }}
        aria-label={t("session_expired_close")}
        className="ml-4 flex-shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
