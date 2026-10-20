"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut as nextAuthSignOut, useSession } from "next-auth/react";
import { useTranslation } from "./TranslationProvider";
import { useAuthModal } from "../context/AuthModalContext";
import { useCart } from "../context/CartContext";
import { switchUserRole } from "@/app/actions/onboarding";
import { useScrollLock } from "@/lib/scroll-lock";
import {
  Menu,
  X,
  Home,
  Users,
  BookOpen,
  GraduationCap,
  Briefcase,
  Calendar,
  MessageSquare,
  CreditCard,
  User,
  LogOut,
  ArrowLeftRight,
  Bot,
  Sparkles,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";

export default function MobileNavDrawer({
  initialUser = null,
  activeRole: initialActiveRole = null,
}: {
  initialUser?: any;
  activeRole?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const pathname = usePathname();
  const { t, locale } = useTranslation();
  const locPrefix = locale ? "/" + locale : "";
  const makeHref = (p: string): string => {
    if (!p) return locPrefix || "/";
    if (p === "/") return locPrefix || "/";
    if (locPrefix && (p === locPrefix || p.startsWith(locPrefix + "/"))) return p;
    const match = p.match(/^\/([a-z]{2})(?:\/|$)/);
    if (match) return p;
    return `${locPrefix}${p.startsWith("/") ? p : `/${p}`}`;
  };

  const { data: session } = useSession();
  const [user, setUser] = useState<any>(initialUser);
  const { openRegisterWithRole } = useAuthModal();
  const { clearCart, setIsOpen: setCartOpen, totalItems } = useCart();
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser);
    } else {
      setUser(null);
    }
  }, [JSON.stringify(initialUser)]);

  const currentUser = session?.user || user;
  const initialRole = initialActiveRole || currentUser?.activeRole || currentUser?.role;
  const [activeRole, setActiveRole] = useState(initialRole);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookieRole = document.cookie
        .split("; ")
        .find((r) => r.startsWith("cfh_active_role="))
        ?.split("=")[1];
      if (cookieRole && cookieRole !== activeRole) {
        setActiveRole(cookieRole);
      }
    }
  }, [currentUser]);

  // Lock body & html scroll when drawer is open
  useScrollLock(isOpen);

  // Close drawer on path change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const isCoachMode = activeRole === "COACH";

  const handleRoleSwitch = async (targetRole: "COACH" | "STUDENT") => {
    setIsSwitchingRole(true);
    try {
      const res = await switchUserRole(targetRole);
      if (res.success && res.redirectTo) {
        const dest = res.redirectTo.startsWith("/") ? makeHref(res.redirectTo) : res.redirectTo;
        window.location.href = dest;
      } else if (res.needsOnboarding && res.redirectTo) {
        const dest = res.redirectTo.startsWith("/") ? makeHref(res.redirectTo) : res.redirectTo;
        window.location.href = dest;
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error("Error switching role in mobile drawer:", err);
      setIsSwitchingRole(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      clearCart();
      localStorage.removeItem("cfh_community_draft");
    } catch (e) {
      console.error("Error clearing cart on sign out:", e);
    }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Error logging out from custom API:", e);
    }
    try {
      await nextAuthSignOut({ redirect: false });
    } catch (e) {
      console.error("Error logging out from NextAuth:", e);
    }
    window.location.href = makeHref("/");
  };

  useEffect(() => {
    const handleUserAvatar = (e: any) => {
      const url = e.detail;
      setUser((prev: any) => (prev ? { ...prev, avatarUrl: url, image: url } : prev));
    };
    const handleCoachAvatar = (e: any) => {
      const url = e.detail;
      setUser((prev: any) => (prev ? { ...prev, coachPhotoUrl: url } : prev));
    };
    window.addEventListener("cfh:user-avatar-updated", handleUserAvatar);
    window.addEventListener("cfh:coach-avatar-updated", handleCoachAvatar);
    return () => {
      window.removeEventListener("cfh:user-avatar-updated", handleUserAvatar);
      window.removeEventListener("cfh:coach-avatar-updated", handleCoachAvatar);
    };
  }, []);

  const rawAvatar = (() => {
    if (isCoachMode) {
      return currentUser?.coachPhotoUrl || currentUser?.coachProfile?.photoUrl || null;
    }
    return currentUser?.avatarUrl || currentUser?.image || null;
  })();

  const displayUserName =
    isCoachMode && ((currentUser as any)?.coachName || (currentUser as any)?.coachProfile?.displayName)
      ? ((currentUser as any)?.coachName || (currentUser as any)?.coachProfile?.displayName)
      : currentUser?.name || "Usuario";

  const avatarSrc =
    rawAvatar && !rawAvatar.startsWith("/avatars/")
      ? rawAvatar
      : isCoachMode
        ? `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(displayUserName)}&backgroundColor=04101e&textColor=ffffff`
        : `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(displayUserName)}`;

  return (
    <>
      {/* Hamburger Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir menú de navegación"
        className="xl:hidden p-2 rounded-xl text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors ml-1"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Backdrop & Drawer Container (Teleported to document.body to escape header containing block) */}
      {isMounted && isOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] xl:hidden flex justify-end animate-fadeIn">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Panel */}
          <aside
            className="relative w-[85vw] max-w-[340px] bg-white dark:bg-slate-900 h-[100dvh] max-h-[100dvh] shadow-2xl flex flex-col z-10 overflow-y-auto overscroll-contain border-l border-gray-200 dark:border-slate-800 transition-transform duration-300"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* Header: Logo & Close Button */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800">
              <Link
                href={makeHref("/")}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2"
              >
                <div className="relative w-8 h-8 shrink-0">
                  <img
                    src="/Logo.png"
                    alt="CFH Logo"
                    className="absolute inset-0 w-full h-full object-contain opacity-100 dark:opacity-0"
                  />
                  <img
                    src="/Logo-dark.png"
                    alt="CFH Logo"
                    className="absolute inset-0 w-full h-full object-contain rounded-xl opacity-0 dark:opacity-100"
                  />
                </div>
                <span className="font-black text-base tracking-tight text-cfh-dark-green dark:text-white">
                  Coaching<span className="text-cfh-light-green">FromHome</span>
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar menú"
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Card (if logged in) */}
            {currentUser ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 shadow-xs shrink-0">
                    <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-sm text-gray-900 dark:text-white truncate">
                      {displayUserName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {currentUser?.email || ""}
                    </p>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isCoachMode
                          ? "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                          : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {isCoachMode ? "Modo Coach" : "Modo Aprendiz"}
                    </span>
                  </div>
                </div>

                {/* Role Switch Button */}
                <button
                  type="button"
                  onClick={() => handleRoleSwitch(isCoachMode ? "STUDENT" : "COACH")}
                  disabled={isSwitchingRole}
                  className="w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-200 hover:border-cfh-light-green transition-all flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
                >
                  {isSwitchingRole ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cfh-dark-green dark:text-cfh-light-green" />
                      <span>Cambiando de rol...</span>
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-3.5 h-3.5 text-cfh-light-green" />
                      <span>{isCoachMode ? "Cambiar a Modo Aprendiz" : "Cambiar a Modo Coach"}</span>
                    </>
                  )}
                </button>
              </div>
            ) : null}

            {/* Navigation Links */}
            <div className="flex-1 py-4 px-3 space-y-1">
              <p className="px-3 pb-1 text-[11px] font-extrabold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                {currentUser ? "Navegación Principal" : "Explorar"}
              </p>

              {/* Public Links */}
              {!currentUser && (
                <>
                  <Link
                    href={makeHref("/")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <Home className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("Navigation.home", "Inicio")}</span>
                  </Link>

                  <Link
                    href={makeHref("/coaches")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <Users className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("Navigation.coaches", "Coaches")}</span>
                  </Link>

                  <Link
                    href={makeHref("/cursos")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("Navigation.courses", "Cursos")}</span>
                  </Link>
                </>
              )}

              {/* Coach Mode Links */}
              {currentUser && isCoachMode && (
                <>
                  <Link
                    href={makeHref("/coach/dashboard")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <Briefcase className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("Navigation.coach_portal", "Portal Coach")}</span>
                  </Link>

                  <Link
                    href={makeHref("/coach/cursos")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("Navigation.my_courses", "Mis Cursos")}</span>
                  </Link>

                  <Link
                    href={makeHref("/coach/profile")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <User className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>Mi Perfil de Coach</span>
                  </Link>

                  <Link
                    href={makeHref("/coach/availability")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>Gestionar Horarios</span>
                  </Link>

                  <Link
                    href={makeHref("/coach/ai-bot")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <Bot className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>Asistente IA</span>
                  </Link>

                  <Link
                    href={makeHref("/coach/billing")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <CreditCard className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("Navigation.billing", "Suscripciones y Pagos")}</span>
                  </Link>

                  <Link
                    href={makeHref("/messages")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>Mensajes</span>
                  </Link>
                </>
              )}

              {/* Student Mode Links */}
              {currentUser && !isCoachMode && (
                <>
                  <Link
                    href={makeHref("/dashboard")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <GraduationCap className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("Navigation.my_learning", "Mi aprendizaje")}</span>
                  </Link>

                  <Link
                    href={makeHref("/coaches")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <Users className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("Navigation.coaches", "Coaches")}</span>
                  </Link>

                  <Link
                    href={makeHref("/cursos")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("Navigation.courses", "Cursos")}</span>
                  </Link>

                  <Link
                    href={makeHref("/dashboard/profile")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <User className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>Mi Perfil</span>
                  </Link>

                  <Link
                    href={makeHref("/messages")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>Mensajes</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setCartOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-emerald-50/60 dark:hover:bg-slate-800 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                      <span>Carrito de Compras</span>
                    </div>
                    {totalItems > 0 && (
                      <span className="w-5 h-5 bg-cfh-dark-green text-white text-xs font-black rounded-full flex items-center justify-center">
                        {totalItems}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Coach CTA (if not logged in) */}
            {!currentUser && (
              <div className="p-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    openRegisterWithRole("COACH");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-cfh-dark-green dark:text-cfh-light-green font-extrabold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-cfh-light-green" />
                  <span>Quiero Enseñar como Coach</span>
                </button>
              </div>
            )}

            {/* Footer / Utilities: Theme & Language */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                  Preferencias
                </span>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <LanguageSwitcher />
                </div>
              </div>

              {currentUser && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full mt-2 py-2.5 px-3 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-extrabold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSigningOut ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cerrando sesión...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t("Header.logout", "Cerrar Sesión")}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
