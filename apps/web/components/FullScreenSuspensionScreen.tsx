"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  ShieldAlert, 
  Clock, 
  AlertOctagon, 
  BookOpen, 
  Lock, 
  Calendar,
  CheckCircle2,
  LogOut,
  RefreshCw,
  Loader2,
  X
} from "lucide-react";
import { signOut as nextAuthSignOut } from "next-auth/react";
import type { SuspensionDetails } from "@/lib/communityStrikes";

interface FullScreenSuspensionScreenProps {
  details: SuspensionDetails;
  onDismiss?: () => void;
}

export default function FullScreenSuspensionScreen({
  details,
  onDismiss,
}: FullScreenSuspensionScreenProps) {
  const targetTime = details.suspendedUntil ? new Date(details.suspendedUntil).getTime() : 0;
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [timeLeft, setTimeLeft] = useState(() => {
    const now = Date.now();
    const diff = Math.max(0, targetTime - now);
    return {
      total: diff,
      days: Math.floor(diff / (24 * 60 * 60 * 1000)),
      hours: Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)),
      minutes: Math.floor((diff % (60 * 1000)) / (60 * 1000)),
      seconds: Math.floor((diff % 1000) / 1000) || Math.floor((diff % (60 * 1000)) / 1000),
    };
  });

  useEffect(() => {
    if (!targetTime) return;

    const calculateTime = () => {
      const now = Date.now();
      const diff = Math.max(0, targetTime - now);

      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((diff % (60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((diff % (60 * 1000)) / 1000);

      setTimeLeft({ total: diff, days, hours, minutes, seconds });

      if (diff <= 0) {
        window.location.reload();
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  // Purgar borradores residuales inmediatamente si la cuenta está suspendida
  useEffect(() => {
    try {
      localStorage.removeItem("cfh_community_draft");
    } catch (_) {}
  }, []);

  const totalSuspensionDuration = 4 * 24 * 60 * 60 * 1000;
  const elapsedMs = Math.max(0, totalSuspensionDuration - timeLeft.total);
  const progressPercent = Math.min(100, Math.max(2, Math.round((elapsedMs / totalSuspensionDuration) * 100)));

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      localStorage.removeItem("cfh_community_draft");
    } catch (_) {}

    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    } catch (e) {
      console.warn("Logout custom error:", e);
    }

    try {
      await nextAuthSignOut({ redirect: false });
    } catch (e) {
      console.warn("NextAuth signOut error:", e);
    }

    window.location.href = "/?suspended=true";
  };

  return (
    <div className="fixed inset-0 z-[999999] min-h-screen w-full bg-slate-950/98 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto">
      {/* Background ambient security glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Dismiss button if modal */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-6 right-6 p-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Brand Header */}
      <div className="flex items-center justify-center gap-2.5 mb-6 select-none">
        <div className="relative w-10 h-10 shrink-0">
          <img
            src="/Logo.png"
            alt="CFH Logo"
            className="w-full h-full object-contain dark:hidden"
          />
          <img
            src="/Logo-dark.png"
            alt="CFH Logo"
            className="w-full h-full object-contain hidden dark:block"
          />
        </div>
        <span className="font-black text-2xl tracking-tight text-white">
          Coaching<span className="text-cfh-light-green">From</span>Home
        </span>
      </div>

      {/* Main Suspension Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-4xl rounded-3xl overflow-hidden border border-rose-900/60 bg-gradient-to-br from-rose-950/50 via-slate-900/95 to-slate-900/95 p-6 sm:p-8 md:p-10 shadow-2xl shadow-rose-950/40 relative"
      >
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-rose-900/50">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-900/60 text-rose-300 border border-rose-800/60">
                  Suspensión Temporal
                </span>
                <span className="text-xs sm:text-sm font-semibold px-3 py-1 rounded-full bg-amber-900/50 text-amber-300 border border-amber-800/50 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Bloqueo Total de Cuenta
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-rose-100 mt-1.5 tracking-tight">
                Tu cuenta se encuentra suspendida temporalmente
              </h1>
            </div>
          </div>

          <div className="text-xs text-rose-300 self-start sm:self-auto flex items-center gap-2 font-medium bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700 shadow-sm">
            <Calendar className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Reactivación automática:{" "}
              <strong className="text-white font-bold">
                {details.formattedDate || "En 4 días"}
              </strong>
            </span>
          </div>
        </div>

        {/* Main Grid: Motivo & Regla + Live Countdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Left Column: Motivo y Regla */}
          <div className="lg:col-span-7 space-y-4">
            {/* Motivo */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertOctagon className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Motivo de la Sanción (Infracción #{details.strikeNumber || 2})
                  </p>
                  <p className="text-sm text-slate-200 mt-1.5 leading-relaxed font-medium">
                    {details.reason || "Se detectó reincidencia en la publicación de información prohibida o conductas contrarias a las normas comunitarias."}
                  </p>
                </div>
              </div>
            </div>

            {/* Regla Infringida */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Regla de la Comunidad Infringida
                  </p>
                  <h4 className="text-sm font-extrabold text-slate-100 mt-1">
                    {details.ruleTitle || "Regla de Seguridad y Protección de la Comunidad"}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                    {details.ruleDescription || "Para resguardar la integridad y convivencia respetuosa, no se tolera lenguaje obsceno, agresiones ni el intercambio de datos de contacto o transacciones externas."}
                  </p>
                </div>
              </div>
            </div>

            {/* Bloqueo total notice */}
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-900/60 flex items-start gap-3 text-xs sm:text-sm text-rose-200 leading-relaxed">
              <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p>
                <strong>Bloqueo total de cuenta:</strong> Mientras dure esta suspensión,{" "}
                <strong>no tienes acceso a cursos, publicaciones, comentarios, mensajería ni ninguna función de la plataforma</strong>.
                Tu acceso permanecerá bloqueado hasta que el contador finalice.
              </p>
            </div>
          </div>

          {/* Right Column: Live Dynamic Countdown Timer */}
          <div className="lg:col-span-5 flex flex-col justify-between p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-400 animate-spin" style={{ animationDuration: "12s" }} />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose-300">
                    Tiempo Restante
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> En Vivo
                </span>
              </div>

              {/* Countdown Numbers Grid */}
              <div className="grid grid-cols-4 gap-2 sm:gap-2.5 mt-5">
                {/* Días */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-850 border border-rose-900/40">
                  <span suppressHydrationWarning className="font-mono text-2xl sm:text-3xl font-black text-rose-400 leading-none">
                    {String(timeLeft.days).padStart(2, "0")}
                  </span>
                  <span className="text-xs sm:text-xs font-bold uppercase tracking-wider text-slate-400 mt-1.5">
                    Días
                  </span>
                </div>

                {/* Horas */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-850 border border-rose-900/40">
                  <span suppressHydrationWarning className="font-mono text-2xl sm:text-3xl font-black text-rose-400 leading-none">
                    {String(timeLeft.hours).padStart(2, "0")}
                  </span>
                  <span className="text-xs sm:text-xs font-bold uppercase tracking-wider text-slate-400 mt-1.5">
                    Horas
                  </span>
                </div>

                {/* Minutos */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-850 border border-rose-900/40">
                  <span suppressHydrationWarning className="font-mono text-2xl sm:text-3xl font-black text-rose-400 leading-none">
                    {String(timeLeft.minutes).padStart(2, "0")}
                  </span>
                  <span className="text-xs sm:text-xs font-bold uppercase tracking-wider text-slate-400 mt-1.5">
                    Minutos
                  </span>
                </div>

                {/* Segundos */}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-rose-600 text-white shadow-md shadow-rose-600/30">
                  <span suppressHydrationWarning className="font-mono text-2xl sm:text-3xl font-black text-white leading-none">
                    {String(timeLeft.seconds).padStart(2, "0")}
                  </span>
                  <span className="text-xs sm:text-xs font-bold uppercase tracking-wider text-rose-100 mt-1.5">
                    Seg
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-5">
                <div className="flex justify-between text-xs text-slate-400 font-medium mb-1.5">
                  <span>Progreso de sanción (4 días)</span>
                  <span className="text-slate-200 font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-1000"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Sin intervención requerida
              </span>
              <span>Reactivación automática</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Sign Out and Refresh */}
        <div className="mt-8 pt-6 border-t border-rose-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>ID de usuario protegido · Sanción registrada en auditoría del sistema</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-sm transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Verificar estado</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm transition-all cursor-pointer shadow-lg shadow-rose-600/30 disabled:opacity-60"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cerrando sesión...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar sesión</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
