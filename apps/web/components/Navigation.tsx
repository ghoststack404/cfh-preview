"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "./TranslationProvider";
import { useSession } from "next-auth/react";

export default function Navigation({ initialUser = null }: { initialUser?: any }) {
  const pathname = usePathname();
  const { t, locale } = useTranslation();
  const locPrefix = locale ? '/' + locale : '';
  const makeHref = (p: string): string => p === '/' ? (locPrefix || '/') : `${locPrefix}${p}`;
  const { data: session } = useSession();
  const [user, setUser] = useState<any>(initialUser);
  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
    } else {
      setUser(null);
    }
  }, [JSON.stringify(initialUser)]);

  const currentUser = session?.user || user;
  const initialRole = currentUser?.activeRole || currentUser?.role;
  const [activeRole, setActiveRole] = useState(initialRole);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookieRole = document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1];
      if (cookieRole && cookieRole !== activeRole) {
        setActiveRole(cookieRole);
      }
    }
  }, [currentUser]);

  // Modo Coach: Portal Coach | Mis Cursos | Comunidad (Ocultamos Inicio si ya está logueado)
  // Modo Aprendiz: Mi Aprendizaje | Coaches | Cursos y Categorías | Comunidad
  // Siempre respetamos el rol activo del usuario para evitar que el Navbar cambie inesperadamente al visitar páginas públicas.
  const isCoachMode = activeRole === "COACH";

  // Si no hay sesión, mostramos links públicos básicos
  const isOnboarding = pathname?.includes('/onboarding');

  const links = isOnboarding
    ? []
    : !currentUser
      ? [
          { href: makeHref("/"), label: t("Navigation.home", "Inicio") },
          { href: makeHref("/coaches"), label: t("Navigation.coaches", "Coaches") },
          { href: makeHref("/cursos"), label: t("Navigation.courses", "Cursos") },
          // { href: makeHref("/comunidad"), label: t("Navigation.community", "Comunidad") },
        ]
      : isCoachMode ? [
              { href: makeHref("/coach/dashboard"), label: t("Navigation.coach_portal", "Portal Coach") },
            { href: makeHref("/coach/cursos"), label: t("Navigation.my_courses", "Mis Cursos") },
            { href: makeHref("/coach/billing"), label: t("Navigation.billing", "Suscripciones y Pagos") },
            // { href: makeHref("/comunidad"), label: t("Navigation.community", "Comunidad") },
          ] : [
              { href: makeHref("/dashboard"), label: t("Navigation.my_learning", "Mi aprendizaje") },
            { href: makeHref("/coaches"), label: t("Navigation.coaches", "Coaches") },
            { href: makeHref("/cursos"), label: t("Navigation.courses", "Cursos") },
            // { href: makeHref("/comunidad"), label: t("Navigation.community", "Comunidad") },
          ];

  return (
    <nav className="flex items-center gap-1 xl:gap-2 2xl:gap-4 whitespace-nowrap">
      {links.map((link) => {
        const isHome = link.href === (locPrefix || "/");
        const isActive = isHome
          ? pathname === link.href
          : pathname === link.href || (Boolean(pathname) && pathname.startsWith(link.href + "/"));

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-xs xl:text-sm 2xl:text-base px-2 xl:px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              isActive
                ? "font-extrabold text-cfh-dark-green dark:text-cfh-light-green bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40"
                : "font-semibold text-gray-600 dark:text-slate-300 hover:text-cfh-dark-green dark:hover:text-cfh-light-green hover:bg-gray-100/70 dark:hover:bg-slate-800/60"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
