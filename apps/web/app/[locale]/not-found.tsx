"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

export default function NotFound() {
  const tNav = useTranslations("Navigation");
  const tErr = useTranslations("Errors");
  const { data: session, status } = useSession();
  const [activeRole, setActiveRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookies = document.cookie;
      // Leemos la cookie del último rol activo (esta cookie no es HttpOnly)
      const cookieRole = cookies.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1];
      if (cookieRole) setActiveRole(cookieRole);
    }
  }, []);

  // Si tenemos sesión activa por NextAuth, o si al menos tenemos un rol en las cookies (como fallback)
  const isAuthenticated = status === "authenticated" || activeRole !== null;

  const isCoach = activeRole === "COACH";
  const dashboardLink = isCoach ? "/coach/dashboard" : "/dashboard";
  const dashboardText = isCoach ? tErr("go_coach") : tErr("go_learning");

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="relative w-48 h-48 sm:w-64 sm:h-64 mb-8">
        {/* Usamos un ícono SVG moderno de lupa/búsqueda rota en lugar de imagen externa para asegurar que siempre cargue */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-full h-full text-cfh-dark-green/20 dark:text-cfh-light-green/20"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl sm:text-6xl font-black text-cfh-dark-green dark:text-cfh-light-green opacity-80">
            404
          </span>
        </div>
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 dark:text-slate-100 mb-4">
        {tErr("not_found_title")}
      </h1>
      <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-lg">
        {tErr("not_found_desc")}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Link
          href="/"
          className="px-6 py-3 rounded-xl font-bold bg-cfh-dark-green hover:bg-cfh-light-green text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 text-center w-full sm:w-auto"
        >
          {tNav("home")}
        </Link>
        {isAuthenticated && (
          <Link
            href={dashboardLink}
            className="px-6 py-3 rounded-xl font-bold border-2 border-cfh-dark-green text-cfh-dark-green dark:border-cfh-light-green dark:text-cfh-light-green hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all text-center w-full sm:w-auto"
          >
            {dashboardText}
          </Link>
        )}
      </div>
    </div>
  );
}
