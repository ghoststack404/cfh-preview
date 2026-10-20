"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "./TranslationProvider";
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  ShieldAlert,
  MessageSquare,
  GraduationCap,
  ExternalLink,
  X,
  CheckCircle2,
  Info,
  ChevronRight,
  Trash2,
  Video,
  Calendar
} from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  roleCategory?: "COACH" | "STUDENT";
}

function isCoachNotif(notif: Notification): boolean {
  if (notif.roleCategory === "COACH") return true;
  if (notif.roleCategory === "STUDENT") return false;
  const link = (notif.link || "").toLowerCase();
  const title = (notif.title || "").toLowerCase();
  const body = (notif.body || "").toLowerCase();
  return (
    link.startsWith("/coach") ||
    link.includes("/coach/") ||
    link.includes("/courses/manage") ||
    link.includes("/dashboard/courses/manage") ||
    link.includes("/dashboard/ai") ||
    link.includes("role=coach") ||
    title.includes("nueva solicitud") ||
    title.includes("solicitud de videollamada") ||
    title.includes("solicitud de apoyo") ||
    title.includes("solicitó una sesión") ||
    title.includes("solicitó apoyo") ||
    title.includes("nueva entrega") ||
    title.includes("entregó la actividad") ||
    title.includes("asistente ia") ||
    title.includes("post-sesión") ||
    title.includes("pago confirmado") ||
    title.includes("nuevo alumno") ||
    title.includes("inscrito a tu curso") ||
    title.includes("compró tu curso") ||
    body.includes("tu alumno") ||
    body.includes("solicitó apoyo en") ||
    (title.includes("en la sala") && !link.includes("role=student"))
  );
}

export default function NotificationBell() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadCoachCount, setUnreadCoachCount] = useState(0);
  const [unreadStudentCount, setUnreadStudentCount] = useState(0);
  const [isCoachAccount, setIsCoachAccount] = useState(false);
  const [userActiveRole, setUserActiveRole] = useState<"COACH" | "STUDENT">("STUDENT");
  const [activeTab, setActiveTab] = useState<"ALL" | "STUDENT" | "COACH">("ALL");
  const [isOpen, setIsOpen] = useState(false);
  const [badgeFlip, setBadgeFlip] = useState<"STUDENT" | "COACH">("STUDENT");

  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const coachCount = notifications.filter((n) => isCoachNotif(n)).length;
  const studentCount = notifications.filter((n) => !isCoachNotif(n)).length;

  const displayCoachCount = unreadCoachCount > 0 ? unreadCoachCount : coachCount;
  const displayStudentCount = unreadStudentCount > 0 ? unreadStudentCount : studentCount;
  const hasBothRoles = isCoachAccount && displayCoachCount > 0 && displayStudentCount > 0;

  // Alternar el badge cada 2.5 segundos SOLO cuando el usuario tiene cuenta de Coach y existen notificaciones de ambos roles
  useEffect(() => {
    if (!isCoachAccount) {
      setBadgeFlip("STUDENT");
      return;
    }
    if (hasBothRoles) {
      const flipTimer = setInterval(() => {
        setBadgeFlip((prev) => (prev === "STUDENT" ? "COACH" : "STUDENT"));
      }, 2500);
      return () => clearInterval(flipTimer);
    } else if (displayCoachCount > 0) {
      setBadgeFlip("COACH");
    } else if (displayStudentCount > 0) {
      setBadgeFlip("STUDENT");
    }
  }, [isCoachAccount, hasBothRoles, displayCoachCount, displayStudentCount]);

  // Bloquear el scroll del fondo (body) cuando la ventana emergente está abierta
  useEffect(() => {
    if (selectedNotif) {
      const prevOverflow = document.body.style.overflow;
      const prevPaddingRight = document.body.style.paddingRight;
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.paddingRight = prevPaddingRight;
      };
    }
  }, [selectedNotif]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        const list: Notification[] = data.notifications || [];
        setNotifications(list);
        setIsCoachAccount(Boolean(data.isCoachAccount));
        if (data.activeRole) {
          setUserActiveRole(data.activeRole);
        }

        const coachUnread = list.filter((n) => !n.readAt && isCoachNotif(n)).length;
        const studentUnread = list.filter((n) => !n.readAt && !isCoachNotif(n)).length;
        const totalUnread = data.unreadCount !== undefined ? data.unreadCount : (coachUnread + studentUnread);

        setUnreadCount(totalUnread);
        setUnreadCoachCount(data.unreadCoachCount !== undefined ? data.unreadCoachCount : coachUnread);
        setUnreadStudentCount(data.unreadStudentCount !== undefined ? data.unreadStudentCount : studentUnread);
      }
    } catch (error) {
      // Silenciosamente ignorar errores de red
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);
    const handleRefresh = () => {
      fetchNotifications();
    };
    window.addEventListener("refresh-notifications", handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("refresh-notifications", handleRefresh);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchNotifications();
    } catch (err) {
      // Silently ignore
    }
  };

  const markAllRead = async (roleFilter?: "COACH" | "STUDENT") => {
    try {
      setNotifications((prev) =>
        prev.map((n) => {
          const match = !roleFilter || (roleFilter === "COACH" ? isCoachNotif(n) : !isCoachNotif(n));
          return match ? { ...n, readAt: n.readAt || new Date().toISOString() } : n;
        })
      );
      if (!roleFilter) {
        setUnreadCount(0);
        setUnreadCoachCount(0);
        setUnreadStudentCount(0);
      } else if (roleFilter === "COACH") {
        setUnreadCount((prev) => Math.max(0, prev - unreadCoachCount));
        setUnreadCoachCount(0);
      } else {
        setUnreadCount((prev) => Math.max(0, prev - unreadStudentCount));
        setUnreadStudentCount(0);
      }

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleFilter ? { markRoleRead: roleFilter } : { markAllRead: true }),
      });
      fetchNotifications();
    } catch (err) {
      // Silently ignore
    }
  };

  const handleNotifClick = (notif: Notification) => {
    if (!notif.readAt) {
      markAsRead(notif.id);
    }
    setSelectedNotif(notif);
    setIsOpen(false);
  };

  const getNotificationTheme = (notif: Notification) => {
    const isCoach = isCoachNotif(notif);
    const titleLower = (notif.title || "").toLowerCase();
    const bodyLower = (notif.body || "").toLowerCase();

    if (
      titleLower.includes("suspendid") ||
      bodyLower.includes("suspendid") ||
      titleLower.includes("bloquead")
    ) {
      return {
        roleBadge: isCoach ? "Coach" : "Aprendiz",
        isCoach,
        badge: "Sanción de Cuenta",
        color: "red",
        icon: ShieldAlert,
        bgLight: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60",
        pill: "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
        border: "border-rose-300 dark:border-rose-800/80",
        alertBox: "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200",
      };
    }

    if (
      titleLower.includes("advertencia") ||
      titleLower.includes("seguridad") ||
      bodyLower.includes("advertencia") ||
      bodyLower.includes("restringid")
    ) {
      return {
        roleBadge: isCoach ? "Coach" : "Aprendiz",
        isCoach,
        badge: "Advertencia",
        color: "amber",
        icon: AlertTriangle,
        bgLight: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/60",
        pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
        border: "border-amber-300 dark:border-amber-800/80",
        alertBox: "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200",
      };
    }

    if (notif.type === "COMMUNITY") {
      return {
        roleBadge: isCoach ? "Coach" : "Aprendiz",
        isCoach,
        badge: "Comunidad CFH",
        color: isCoach ? "red" : "emerald",
        icon: MessageSquare,
        bgLight: isCoach
          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60"
          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60",
        pill: isCoach
          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
        border: isCoach ? "border-rose-300 dark:border-rose-800/80" : "border-emerald-300 dark:border-emerald-800/80",
        alertBox: isCoach
          ? "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200"
          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200",
      };
    }

    if (isCoach) {
      // 🔴 COACH: Estilo ROJO Carmesí
      return {
        roleBadge: "Coach",
        isCoach: true,
        badge: titleLower.includes("solicitud") ? "Solicitud de Alumno" : (notif.type === "PAYMENT" ? "Pago Confirmado" : "Sección Coach"),
        color: "red",
        icon: GraduationCap,
        bgLight: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60",
        pill: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800",
        border: "border-rose-300 dark:border-rose-800/80",
        alertBox: "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200",
      };
    }

    // 🟢 APRENDIZ / ALUMNO: Estilo VERDE Esmeralda
    return {
      roleBadge: "Aprendiz",
      isCoach: false,
      badge: notif.type === "BOOKING" || notif.type === "PAYMENT" ? "Cursos y Clases" : "Aviso de Aprendiz",
      color: "emerald",
      icon: notif.type === "BOOKING" ? GraduationCap : Info,
      bgLight: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60",
      pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
      border: "border-emerald-300 dark:border-emerald-800/80",
      alertBox: "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200",
    };
  };

  const displayedNotifications = notifications.filter((notif) => {
    if (!isCoachAccount) return !isCoachNotif(notif);
    if (activeTab === "COACH") return isCoachNotif(notif);
    if (activeTab === "STUDENT") return !isCoachNotif(notif);
    return true;
  });

  if (pathname?.includes("/onboarding")) {
    return null;
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Botón Campana con Indicadores Bicolor (Rojo Coach / Verde Aprendiz) */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-500 dark:text-slate-400 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-all rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 relative focus:outline-none cursor-pointer"
          title={t("Notifications.title", "Notificaciones")}
          aria-label="Notificaciones"
        >
          <Bell className="w-5 h-5 transition-transform hover:scale-105 active:scale-95" />
          
          {(unreadCount > 0 || hasBothRoles) && (
            hasBothRoles ? (
              // Alterna dinámicamente entre Verde (Aprendiz) y Rojo (Coach) de forma suave, fluida y con número 100% nítido
              <span
                key="badge-dual"
                className={`absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold leading-none border-2 border-white dark:border-slate-900 shadow-md transition-all duration-500 ease-in-out select-none ${
                  badgeFlip === "COACH"
                    ? "bg-rose-500 shadow-rose-500/30"
                    : "bg-emerald-600 shadow-emerald-600/30"
                }`}
                style={{ fontVariantNumeric: "tabular-nums" }}
                title={
                  badgeFlip === "COACH"
                    ? `Coach: ${displayCoachCount} notificaciones`
                    : `Aprendiz: ${displayStudentCount} notificaciones`
                }
              >
                <span
                  key={badgeFlip}
                  className="inline-flex items-center justify-center leading-none transform transition-transform duration-300 animate-in fade-in zoom-in-75"
                >
                  {badgeFlip === "COACH"
                    ? displayCoachCount > 9
                      ? "9+"
                      : displayCoachCount
                    : displayStudentCount > 9
                    ? "9+"
                    : displayStudentCount}
                </span>
              </span>
            ) : isCoachAccount && displayCoachCount > 0 ? (
              // Solo notificaciones de Coach: ROJO nítido
              <span
                className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-rose-500 text-white text-[11px] font-extrabold leading-none rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md select-none shadow-rose-500/30"
                style={{ fontVariantNumeric: "tabular-nums" }}
                title={`Coach: ${displayCoachCount} notificaciones`}
              >
                {displayCoachCount > 9 ? "9+" : displayCoachCount}
              </span>
            ) : displayStudentCount > 0 ? (
              // Solo notificaciones de Aprendiz: VERDE nítido
              <span
                className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-emerald-600 text-white text-[11px] font-extrabold leading-none rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md select-none shadow-emerald-600/30"
                style={{ fontVariantNumeric: "tabular-nums" }}
                title={`Aprendiz: ${displayStudentCount} notificaciones`}
              >
                {displayStudentCount > 9 ? "9+" : displayStudentCount}
              </span>
            ) : unreadCount > 0 ? (
              // Fallback cuando unreadCount > 0
              <span
                className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-emerald-600 text-white text-[11px] font-extrabold leading-none rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md select-none shadow-emerald-600/30"
                style={{ fontVariantNumeric: "tabular-nums" }}
                title={`${unreadCount} notificaciones`}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null
          )}
        </button>

        {/* Dropdown Emergente */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-24px))] sm:w-[440px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200/90 dark:border-slate-800 py-3 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header del Dropdown */}
            <div className="px-4 pb-3 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/60 dark:bg-slate-850/60">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                <h3 className="font-extrabold text-gray-800 dark:text-slate-200 text-sm tracking-tight">
                  {t("Notifications.title", "Notificaciones")}
                </h3>
                {unreadCount > 0 && (
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {unreadCount}
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead(isCoachAccount && activeTab !== "ALL" ? activeTab : undefined)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green hover:underline cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>
                    {isCoachAccount && activeTab === "COACH" ? "Marcar Coach leídas" : isCoachAccount && activeTab === "STUDENT" ? "Marcar Aprendiz leídas" : t("Notifications.mark_all_read", "Marcar leídas")}
                  </span>
                </button>
              )}
            </div>

            {/* 🌟 Selector de secciones SOLO para usuarios con cuenta de Coach */}
            {isCoachAccount && (
              <div className="p-2 border-b border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-850/60 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === "STUDENT" ? "ALL" : "STUDENT")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    activeTab === "STUDENT"
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/20"
                      : "bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 dark:hover:bg-emerald-950/70"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === "STUDENT" ? "bg-white" : "bg-emerald-500"}`}></span>
                  <span>Aprendiz</span>
                  {unreadStudentCount > 0 ? (
                    <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${activeTab === "STUDENT" ? "bg-white/20 text-white" : "bg-emerald-600 text-white"}`}>
                      {unreadStudentCount}
                    </span>
                  ) : (
                    <span className={`text-[10px] font-semibold opacity-70`}>
                      ({notifications.filter(n => !isCoachNotif(n)).length})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === "COACH" ? "ALL" : "COACH")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    activeTab === "COACH"
                      ? "bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-600/20"
                      : "bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-950/70"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${activeTab === "COACH" ? "bg-white" : "bg-rose-500"}`}></span>
                  <span>Coach</span>
                  {unreadCoachCount > 0 ? (
                    <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${activeTab === "COACH" ? "bg-white/20 text-white" : "bg-rose-600 text-white"}`}>
                      {unreadCoachCount}
                    </span>
                  ) : (
                    <span className={`text-[10px] font-semibold opacity-70`}>
                      ({notifications.filter(n => isCoachNotif(n)).length})
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Lista de Notificaciones con buen espaciado y distinción por color */}
            <div className="max-h-[65vh] overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin">
              {displayedNotifications.length === 0 ? (
                <div className="py-10 px-4 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 bg-gray-100 dark:bg-slate-800/80 rounded-2xl flex items-center justify-center mb-3 text-gray-400 dark:text-slate-500 shadow-inner">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-gray-700 dark:text-slate-300 text-sm">
                    {activeTab === "COACH"
                      ? "No tienes notificaciones de Coach"
                      : activeTab === "STUDENT"
                      ? "No tienes notificaciones de Aprendiz"
                      : (t("Notifications.empty_title", "No tienes notificaciones"))}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
                    {activeTab === "COACH"
                      ? "Aquí recibirás solicitudes de alumnos, videollamadas y compras de tus cursos."
                      : (t("Notifications.empty_desc", "Aquí aparecerán tus avisos de seguridad, cursos y comunidad."))}
                  </p>
                </div>
              ) : (
                displayedNotifications.map((notif) => {
                  const isUnread = !notif.readAt;
                  const isCoach = isCoachNotif(notif);
                  const theme = getNotificationTheme(notif);
                  const Icon = theme.icon;
                  const timeAgo = new Date(notif.createdAt).toLocaleDateString(locale.toLowerCase(), {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left relative group ${
                        isUnread
                          ? "bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 shadow-xs hover:border-cfh-light-green"
                          : "bg-white dark:bg-slate-850/70 border-gray-100 dark:border-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icono temático normal */}
                        <div className="shrink-0 p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 shadow-2xs">
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Contenido normal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              {/* 🏷️ Distintivo de Rol por Color (solo para usuarios con cuenta de Coach) */}
                              {isCoachAccount && (
                                <span
                                  className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-xs ${
                                    isCoach
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isCoach ? "bg-rose-500" : "bg-emerald-500"}`}></span>
                                  {isCoach ? "Coach" : "Aprendiz"}
                                </span>
                              )}

                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                                {theme.badge}
                              </span>
                            </div>

                            <span className="text-xs font-mono text-gray-400 dark:text-slate-500 shrink-0">
                              {timeAgo}
                            </span>
                          </div>

                          <h4
                            className={`text-xs font-bold leading-snug mb-1.5 ${
                              isUnread ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-slate-300"
                            }`}
                          >
                            {notif.title}
                          </h4>

                          {/* Cuerpo con texto normal y cómodo */}
                          <p className="text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-slate-400 line-clamp-3">
                            {notif.body}
                          </p>

                          {/* Pista de interacción */}
                          <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-gray-100/70 dark:border-slate-800/60">
                            {notif.link?.includes("/sesion/") ? (
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                <Video className="w-3 h-3" />
                                Entrar a la Sala →
                              </span>
                            ) : (
                              <span className="text-xs font-bold inline-flex items-center gap-1 text-gray-500 dark:text-slate-400 group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green group-hover:underline">
                                Toca para ver completa
                                <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                              </span>
                            )}

                            {isUnread && (
                              <span
                                className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                                  !isCoachAccount
                                    ? "bg-emerald-500"
                                    : isCoach
                                    ? "bg-rose-500"
                                    : "bg-emerald-500"
                                }`}
                                title={!isCoachAccount ? "No leída" : isCoach ? "No leída (Coach)" : "No leída (Aprendiz)"}
                              ></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie del Dropdown */}
            <div className="p-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 flex items-center justify-center">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 text-center">
                Haz clic en cualquier aviso para ver el texto completo sin cortes.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 🚀 VENTANA CHIQUITA / MODAL POPUP PARA LEER NOTIFICACIONES COMPLETAS      */}
      {/* ========================================================================= */}
      {mounted && selectedNotif && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-hidden overscroll-contain select-none"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {/* Backdrop con desenfoque suave */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
            onClick={() => setSelectedNotif(null)}
          ></div>

          {/* Caja del Modal */}
          <div
            className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200 z-10 overscroll-contain select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            {(() => {
              const theme = getNotificationTheme(selectedNotif);
              const isCoach = isCoachNotif(selectedNotif);
              const Icon = theme.icon;
              return (
                <>
                  <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/80 dark:bg-slate-850/80 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm border ${theme.bgLight}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          {isCoachAccount && (
                            <span
                              className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-xs ${
                                isCoach
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isCoach ? "bg-rose-500" : "bg-emerald-500"}`}></span>
                              {isCoach ? "Sección Coach" : "Sección Aprendiz"}
                            </span>
                          )}

                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${theme.pill}`}>
                            {theme.badge}
                          </span>
                        </div>
                        <h3 className="font-black text-gray-900 dark:text-white text-base tracking-tight">
                          {t("Notifications.details", "Detalle de la Notificación")}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedNotif(null)}
                      className="p-2 text-gray-400 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-750 rounded-full shadow-xs border border-gray-200 dark:border-slate-700 transition-all cursor-pointer"
                      title="Cerrar ventana"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Cuerpo del Modal con Excelente Espaciado y Texto Completo */}
                  <div className="p-6 sm:p-7 space-y-5 flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
                    {/* Fecha y Hora exacta */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-cfh-dark-green dark:text-cfh-light-green" />
                      <span>
                        {new Date(selectedNotif.createdAt).toLocaleDateString(locale.toLowerCase(), {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Título Completo */}
                    <h2 className="text-xl font-black text-gray-900 dark:text-white leading-snug">
                      {selectedNotif.title}
                    </h2>

                    {/* Contenedor del Mensaje Completo con Estilo Claro */}
                    <div className={`p-4 sm:p-5 rounded-2xl border text-sm leading-relaxed ${theme.alertBox} select-text`}>
                      <p className="whitespace-pre-line font-medium text-slate-800 dark:text-slate-100">
                        {selectedNotif.body}
                      </p>
                    </div>

                    {/* Indicación contextual si es aviso de seguridad */}
                    {(selectedNotif.title.includes("Advertencia") || selectedNotif.title.includes("Suspendida")) && (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                          <ShieldAlert className="w-4 h-4 text-emerald-500 shrink-0" />
                          Espacio Seguro CoachingFromHome
                        </p>
                        <p className="leading-relaxed text-xs sm:text-sm">
                          Para garantizar tu seguridad y la de la comunidad, el sistema modera automáticamente números de teléfono, correos externos o solicitudes de pago fuera de la plataforma.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Pie del Modal con Acciones Claras */}
                  <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-850/80 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 shrink-0">
                    {/* Botón Secundario: Entendido / Cerrar */}
                    <button
                      type="button"
                      onClick={() => setSelectedNotif(null)}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      {t("Notifications.understood", "Entendido / Cerrar")}
                    </button>

                    {/* Botón Principal: Si tiene enlace para unirse a la sala o ir a la sección */}
                    {selectedNotif.link && (
                      <button
                        type="button"
                        onClick={() => {
                          let target = selectedNotif.link!;
                          setSelectedNotif(null);

                          // Evitar que usuarios sin cuenta de coach sean dirigidos a rutas de coach
                          if (!isCoachAccount && (target.startsWith("/coach") || target.includes("/coach/"))) {
                            target = "/dashboard";
                          }

                          // Si es llamada directa en vivo
                          if (target.includes("/sesion/")) {
                            window.location.href = target;
                            return;
                          }

                          const [targetPath, hash] = target.split("#");
                          const loc = locale || "es";
                          const cleanCurrent = (pathname || "").replace(new RegExp(`^/${loc}(?=/|$)`, "i"), "") || "/";
                          const cleanTarget = (targetPath || "").replace(new RegExp(`^/${loc}(?=/|$)`, "i"), "") || "/";

                          const isSamePage = cleanCurrent === cleanTarget;

                          if (isSamePage && hash) {
                            const tryScroll = () => {
                              const el = document.getElementById(hash) || (hash.startsWith("booking-") ? document.getElementById("agenda") : null);
                              if (el) {
                                el.scrollIntoView({ behavior: "smooth", block: "center" });
                                el.classList.add("ring-4", "ring-emerald-500", "ring-offset-2", "transition-all");
                                setTimeout(() => {
                                  el.classList.remove("ring-4", "ring-emerald-500", "ring-offset-2");
                                }, 3500);
                                return true;
                              }
                              return false;
                            };

                            if (!tryScroll()) {
                              setTimeout(tryScroll, 150);
                              setTimeout(tryScroll, 400);
                            }
                            return;
                          }

                          const prefix = loc ? `/${loc}` : "";
                          const finalUrl = `${prefix}${cleanTarget}${hash ? '#' + hash : ''}`;
                          window.location.href = finalUrl;
                        }}
                        className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                          selectedNotif.link.includes("/sesion/")
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 active:scale-98"
                            : isCoachAccount && isCoach
                            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25"
                        }`}
                      >
                        {selectedNotif.link.includes("/sesion/") ? (
                          <>
                            <Video className="w-4 h-4 animate-pulse" />
                            <span>Entrar a la Sala</span>
                          </>
                        ) : selectedNotif.link.includes("#agenda") || selectedNotif.link.includes("/dashboard") ? (
                          <>
                            <Calendar className="w-4 h-4" />
                            <span>Ver en mi Agenda</span>
                          </>
                        ) : (
                          <>
                            <span>{t("Notifications.go_to_page", "Ir a la sección")}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
