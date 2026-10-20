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
  CheckCircle2
} from "lucide-react";
import type { SuspensionDetails } from "@/lib/communityStrikes";

interface AccountSuspendedBannerProps {
  details: SuspensionDetails;
  compact?: boolean;
}

export default function AccountSuspendedBanner({ details, compact = false }: AccountSuspendedBannerProps) {
  const targetTime = details.suspendedUntil ? new Date(details.suspendedUntil).getTime() : 0;
  
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
        // Reactivación cumplida: recargar página automáticamente
        window.location.reload();
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  const totalSuspensionDuration = 4 * 24 * 60 * 60 * 1000;
  const elapsedMs = Math.max(0, totalSuspensionDuration - timeLeft.total);
  const progressPercent = Math.min(100, Math.max(2, Math.round((elapsedMs / totalSuspensionDuration) * 100)));

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full rounded-3xl overflow-hidden border border-rose-200/90 dark:border-rose-900/60 bg-gradient-to-br from-rose-50/95 via-amber-50/50 to-orange-50/70 dark:from-rose-950/40 dark:via-slate-900 dark:to-orange-950/30 p-5 sm:p-7 shadow-sm mb-6 relative"
    >
      {/* Background ambient badge */}
      <div className="absolute top-0 right-0 -mr-6 -mt-6 w-36 h-36 bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-rose-200/70 dark:border-rose-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/60">
                Suspensión Temporal
              </span>
              <span className="text-xs sm:text-sm font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Modo Sólo Lectura
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-rose-950 dark:text-rose-100 mt-1">
              Tu cuenta se encuentra suspendida temporalmente
            </h2>
          </div>
        </div>

        <div className="text-xs text-rose-800/80 dark:text-rose-300/80 self-start sm:self-auto flex items-center gap-1.5 font-medium bg-white/70 dark:bg-slate-800/70 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-slate-800 shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-rose-500" />
          <span>
            Reactivación automática:{" "}
            <strong className="text-rose-900 dark:text-rose-100">
              {details.formattedDate || "En 4 días"}
            </strong>
          </span>
        </div>
      </div>

      {/* Main Grid: Info Motivo & Regla + Countdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* Left Column: Motivo y Regla */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* Motivo */}
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-rose-100 dark:border-slate-800 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Motivo de la Sanción (Infracción #{details.strikeNumber || 2})
                </p>
                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                  {details.reason || "Se detectó reincidencia en la publicación de información prohibida o restringida en la plataforma."}
                </p>
              </div>
            </div>
          </div>

          {/* Regla Infringida */}
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Regla de la Comunidad Infringida
                </p>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                  {details.ruleTitle || "Regla de Seguridad y Protección de la Comunidad"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {details.ruleDescription || "Para resguardar la seguridad y garantía de los usuarios, todo acuerdo, contacto y pago debe realizarse estrictamente dentro de Coaching From Home."}
                </p>
              </div>
            </div>
          </div>

          {/* Bloqueo total notice */}
          <div className="p-3.5 rounded-2xl bg-rose-100/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
            <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Bloqueo total de acciones:</strong> Mientras dure esta suspensión, <strong>no puedes publicar preguntas, comentar, dar me gusta, subir fotos, editar ni realizar ninguna interacción</strong>. Tu cuenta permanece en modo sólo lectura hasta que el contador finalice.
            </p>
          </div>
        </div>

        {/* Right Column: Dynamic Live Countdown */}
        <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-rose-200 dark:border-slate-800 shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400 animate-spin" style={{ animationDuration: "12s" }} />
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Tiempo Restante de Suspensión
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> En Vivo
              </span>
            </div>

            {/* Countdown timer numbers */}
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5 mt-4">
              {/* Días */}
              <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-gradient-to-b from-rose-50 to-rose-100/60 dark:from-rose-950/50 dark:to-slate-900 border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
                <span className="font-mono text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300 leading-none">
                  {String(timeLeft.days).padStart(2, "0")}
                </span>
                <span className="text-xs sm:text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                  Días
                </span>
              </div>

              {/* Horas */}
              <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-gradient-to-b from-rose-50 to-rose-100/60 dark:from-rose-950/50 dark:to-slate-900 border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
                <span className="font-mono text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300 leading-none">
                  {String(timeLeft.hours).padStart(2, "0")}
                </span>
                <span className="text-xs sm:text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                  Horas
                </span>
              </div>

              {/* Minutos */}
              <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-gradient-to-b from-rose-50 to-rose-100/60 dark:from-rose-950/50 dark:to-slate-900 border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
                <span className="font-mono text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300 leading-none">
                  {String(timeLeft.minutes).padStart(2, "0")}
                </span>
                <span className="text-xs sm:text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                  Minutos
                </span>
              </div>

              {/* Segundos */}
              <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-gradient-to-b from-rose-600 to-rose-700 text-white shadow-xs">
                <span className="font-mono text-2xl sm:text-3xl font-black text-white leading-none">
                  {String(timeLeft.seconds).padStart(2, "0")}
                </span>
                <span className="text-xs sm:text-xs sm:text-sm font-bold uppercase tracking-wider text-rose-100 mt-1">
                  Seg
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
                <span>Progreso de sanción (4 días)</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Sin intervención requerida
            </span>
            <span>Reactivación 100% automática</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
