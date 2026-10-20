"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Aquí se reportaría el error crítico a Sentry, etc.
    console.error("Fallo crítico en el Layout raíz:", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen flex items-center justify-center">
        <div className="max-w-xl px-6 py-12 bg-white rounded-3xl shadow-xl text-center border border-slate-100">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-rose-100 text-rose-500 rounded-full mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-black mb-4">Error Crítico del Sistema</h1>
          <p className="text-slate-500 mb-8">
            Algo salió muy mal al intentar cargar la plataforma. Nuestros ingenieros han sido notificados.
            Por favor, recarga la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 rounded-xl font-bold bg-[#1d3557] hover:bg-[#457b9d] text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Recargar plataforma
          </button>
        </div>
      </body>
    </html>
  );
}
