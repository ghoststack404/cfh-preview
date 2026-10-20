"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Sparkles,
  Trophy,
  Zap,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Star,
  Flame,
  Award,
  X,
} from "lucide-react";
export interface PlanLevelUpCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName?: string;
  tierCode?: string; // BASIC, CURSOS_ONLY, ELITE, GOLD, PLATINUM
  headline?: string;
  onContinueToDashboard?: () => void;
}

interface TierMetaItem {
  title: string;
  headline: string;
  level: string;
  tagline: string;
  gradient: string;
  glow: string;
  badgeBg: string;
  levelGradient: string;
  sparklesColor: string;
  icon: typeof Crown;
  commissionText: string;
  aiCreditsText: string;
  primaryCardBg: string;
  primaryCardBorder: string;
  primaryCardText: string;
  primaryCardIconColor: string;
  secondaryCardBg: string;
  secondaryCardBorder: string;
  secondaryCardText: string;
  secondaryCardIconColor: string;
  checkColor: string;
  activeBadgeBg: string;
  verifiedText: string;
  buttonGradient: string;
  buttonGlow: string;
  confettiColors: string[];
  perks: string[];
}

const DEFAULT_META: TierMetaItem = {
  title: "Club CFH • Rango Élite",
  headline: "¡PLAN ÉLITE ACTIVADO!",
  level: "MEMBRESÍA CLUB ÉLITE",
  tagline: "¡Comisión reducida al 20% y herramientas interactivas listas para usar!",
  gradient: "from-sky-300 via-blue-200 to-indigo-300",
  glow: "rgba(59, 130, 246, 0.55)",
  badgeBg: "bg-blue-500/20 text-blue-200 border-blue-400/40",
  levelGradient: "from-sky-200 via-white to-blue-200",
  sparklesColor: "text-sky-300",
  icon: Trophy,
  commissionText: "Sólo 20% de comisión (¡Ahorras un 3% extra!)",
  aiCreditsText: "Herramientas de Mentoría Avanzadas",
  primaryCardBg: "bg-blue-500/15",
  primaryCardBorder: "border-blue-500/30",
  primaryCardText: "text-blue-100",
  primaryCardIconColor: "text-blue-300",
  secondaryCardBg: "bg-indigo-500/15",
  secondaryCardBorder: "border-indigo-500/30",
  secondaryCardText: "text-indigo-100",
  secondaryCardIconColor: "text-indigo-300",
  checkColor: "text-sky-400",
  activeBadgeBg: "bg-blue-500/25 text-blue-200 border-blue-500/40",
  verifiedText: "text-blue-300",
  buttonGradient: "from-blue-600 via-indigo-600 to-sky-600",
  buttonGlow: "rgba(59, 130, 246, 0.6)",
  confettiColors: ["#3b82f6", "#6366f1", "#38bdf8", "#0284c7", "#93c5fd", "#ffffff"],
  perks: [
    "Pizarra colaborativa interactiva en videollamadas",
    "Módulo de Seguimiento y Bitácora de Alumnos",
    "Grabación de Sesiones y Material Didáctico",
    "Insignia exclusiva de Coach Élite en tu perfil",
  ],
};

const TIER_META: Record<string, TierMetaItem> = {
  CURSOS_ONLY: {
    title: "Club CFH • Solo Cursos",
    headline: "¡CREADOR DE CURSOS ACTIVADO!",
    level: "ESPECIALIDAD SOLO CURSOS",
    tagline: "¡Constructor oficial activado para publicar y monetizar!",
    gradient: "from-teal-300 via-cyan-200 to-emerald-300",
    glow: "rgba(20, 184, 166, 0.55)",
    badgeBg: "bg-teal-500/20 text-teal-200 border-teal-400/40",
    levelGradient: "from-teal-200 via-white to-cyan-200",
    sparklesColor: "text-teal-300",
    icon: Award,
    commissionText: "25% comisión estándar sobre ventas",
    aiCreditsText: "Publicación y Cursos Ilimitados",
    primaryCardBg: "bg-teal-500/15",
    primaryCardBorder: "border-teal-500/30",
    primaryCardText: "text-teal-100",
    primaryCardIconColor: "text-teal-300",
    secondaryCardBg: "bg-cyan-500/15",
    secondaryCardBorder: "border-cyan-500/30",
    secondaryCardText: "text-cyan-100",
    secondaryCardIconColor: "text-cyan-300",
    checkColor: "text-teal-400",
    activeBadgeBg: "bg-teal-500/25 text-teal-200 border-teal-500/40",
    verifiedText: "text-teal-300",
    buttonGradient: "from-teal-600 via-cyan-600 to-emerald-600",
    buttonGlow: "rgba(20, 184, 166, 0.6)",
    confettiColors: ["#14b8a6", "#06b6d4", "#10b981", "#2dd4bf", "#67e8f9", "#ffffff"],
    perks: [
      "Constructor y editor de cursos en video",
      "Ventas automáticas por Stripe Checkout",
      "Subida de módulos, tareas y recursos en PDF",
      "Listado preferente en el catálogo de Cursos",
    ],
  },
  ELITE: DEFAULT_META,
  GOLD: {
    title: "Club CFH • Rango Gold",
    headline: "¡PLAN GOLD ACTIVADO!",
    level: "MEMBRESÍA PROFESIONAL GOLD",
    tagline: "¡Herramientas avanzadas, recordatorios y comisión reducida!",
    gradient: "from-amber-200 via-yellow-200 to-amber-400",
    glow: "rgba(245, 158, 11, 0.55)",
    badgeBg: "bg-amber-500/20 text-amber-200 border-amber-400/40",
    levelGradient: "from-amber-200 via-white to-yellow-200",
    sparklesColor: "text-amber-300",
    icon: Crown,
    commissionText: "Sólo 18% de comisión (¡Ahorras un 5% de cada cobro!)",
    aiCreditsText: "Herramientas Avanzadas y Recordatorios",
    primaryCardBg: "bg-amber-500/15",
    primaryCardBorder: "border-amber-500/30",
    primaryCardText: "text-amber-100",
    primaryCardIconColor: "text-amber-300",
    secondaryCardBg: "bg-yellow-500/15",
    secondaryCardBorder: "border-yellow-500/30",
    secondaryCardText: "text-yellow-100",
    secondaryCardIconColor: "text-yellow-300",
    checkColor: "text-amber-400",
    activeBadgeBg: "bg-amber-500/25 text-amber-200 border-amber-500/40",
    verifiedText: "text-amber-300",
    buttonGradient: "from-amber-500 via-yellow-500 to-orange-500",
    buttonGlow: "rgba(245, 158, 11, 0.6)",
    confettiColors: ["#f59e0b", "#fbbf24", "#d97706", "#fef08a", "#ea580c", "#ffffff"],
    perks: [
      "Creador de Cursos Online y venta ilimitada",
      "Recordatorios automáticos por WhatsApp y correo",
      "Pizarra interactiva + Bitácora avanzada de aprendices",
      "Insignia Dorada y posición destacada en el catálogo",
    ],
  },
  PLATINUM: {
    title: "Club CFH • Rango Platinum VIP",
    headline: "¡RANGO MÁXIMO PLATINUM!",
    level: "SUITE VIP PROFESIONAL",
    tagline: "¡El máximo nivel de prestigio y la menor comisión de CFH!",
    gradient: "from-purple-200 via-fuchsia-300 to-indigo-200",
    glow: "rgba(168, 85, 247, 0.6)",
    badgeBg: "bg-purple-500/20 text-purple-200 border-purple-400/40",
    levelGradient: "from-purple-200 via-white to-fuchsia-200",
    sparklesColor: "text-purple-300",
    icon: Flame,
    commissionText: "¡Sólo 15% de comisión! (La tarifa más baja de CFH)",
    aiCreditsText: "Soporte VIP Prioritario 24/7",
    primaryCardBg: "bg-purple-500/15",
    primaryCardBorder: "border-purple-500/30",
    primaryCardText: "text-purple-100",
    primaryCardIconColor: "text-purple-300",
    secondaryCardBg: "bg-fuchsia-500/15",
    secondaryCardBorder: "border-fuchsia-500/30",
    secondaryCardText: "text-fuchsia-100",
    secondaryCardIconColor: "text-fuchsia-300",
    checkColor: "text-purple-400",
    activeBadgeBg: "bg-purple-500/25 text-purple-200 border-purple-500/40",
    verifiedText: "text-purple-300",
    buttonGradient: "from-purple-600 via-fuchsia-600 to-indigo-600",
    buttonGlow: "rgba(168, 85, 247, 0.6)",
    confettiColors: ["#a855f7", "#c084fc", "#e879f9", "#818cf8", "#f472b6", "#ffffff"],
    perks: [
      "Todas las herramientas profesionales desbloqueadas",
      "Soporte VIP prioritario 24/7 y asesoría personalizada",
      "Campañas destacadas en la página principal y redes CFH",
      "Insignia Platinum con halo holográfico en tu tarjeta",
    ],
  },
  BASIC: {
    title: "Club CFH • Plan Inicial",
    headline: "¡PLAN BÁSICO ACTIVADO!",
    level: "MEMBRESÍA DOCENTE BÁSICA",
    tagline: "¡Comienza a dar tus sesiones de 60 min de inmediato sin costo mensual!",
    gradient: "from-emerald-300 via-green-200 to-teal-300",
    glow: "rgba(16, 185, 129, 0.45)",
    badgeBg: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
    levelGradient: "from-emerald-200 via-white to-teal-200",
    sparklesColor: "text-emerald-300",
    icon: Star,
    commissionText: "23% de comisión estándar",
    aiCreditsText: "Herramientas esenciales incluidas",
    primaryCardBg: "bg-emerald-500/15",
    primaryCardBorder: "border-emerald-500/30",
    primaryCardText: "text-emerald-100",
    primaryCardIconColor: "text-emerald-300",
    secondaryCardBg: "bg-teal-500/15",
    secondaryCardBorder: "border-teal-500/30",
    secondaryCardText: "text-teal-100",
    secondaryCardIconColor: "text-teal-300",
    checkColor: "text-emerald-400",
    activeBadgeBg: "bg-emerald-500/25 text-emerald-200 border-emerald-500/40",
    verifiedText: "text-emerald-300",
    buttonGradient: "from-emerald-600 via-teal-600 to-green-600",
    buttonGlow: "rgba(16, 185, 129, 0.55)",
    confettiColors: ["#10b981", "#34d399", "#059669", "#6ee7b7", "#14b8a6", "#ffffff"],
    perks: [
      "Sesiones en vivo de 60 minutos ilimitadas",
      "Chat seguro y protegido",
      "Intro gratuita de 15 minutos para captar alumnos",
    ],
  },
};

/**
 * Genera un breve acorde musical triunfal estilo Fortnite usando la Web Audio API nativa
 */
export function playVictorySound() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === notes.length - 1 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.85);
    });
  } catch (err) {
    // Si el navegador bloquea audio por interacción previa, silenciar limpiamente
  }
}

/**
 * Lanza confeti animado nativo en canvas sin librerías externas
 */
export function triggerFortniteConfetti(customColors?: string[]) {
  if (typeof window === "undefined") return;
  try {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "999999";
    document.body.appendChild(canvas);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    const colors = customColors && customColors.length > 0
      ? customColors
      : ["#6366f1", "#10b981", "#fbbf24", "#ec4899", "#38bdf8", "#a855f7", "#ffffff"];
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      vRot: number;
      alpha: number;
    }> = [];

    for (let i = 0; i < 140; i++) {
      const angle = (Math.PI * 2 * i) / 140 + (Math.random() - 0.5) * 0.6;
      const speed = Math.random() * 14 + 5;
      particles.push({
        x: canvas.width / 2,
        y: canvas.height * 0.65,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 8,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)] || "#fbbf24",
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        alpha: 1,
      });
    }

    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // gravity
        p.rotation += p.vRot;
        if (frame > 35) {
          p.alpha -= 0.015;
        }
        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
          ctx.restore();
        }
      }
      if (alive && frame < 180) {
        requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    };
    requestAnimationFrame(animate);
  } catch (e) {
    // Confetti fallback
  }
}

export default function PlanLevelUpCelebrationModal({
  isOpen,
  onClose,
  planName = "Élite",
  tierCode = "ELITE",
  headline,
  onContinueToDashboard,
}: PlanLevelUpCelebrationModalProps) {
  const [hasPlayedSound, setHasPlayedSound] = useState(false);

  const normalizedTier = (tierCode || "ELITE").toUpperCase();
  const meta: TierMetaItem = TIER_META[normalizedTier] || DEFAULT_META;
  const TierIcon = meta.icon;

  useEffect(() => {
    if (isOpen) {
      if (!hasPlayedSound) {
        playVictorySound();
        setHasPlayedSound(true);
      }
      triggerFortniteConfetti(meta.confettiColors);
    }
  }, [isOpen, hasPlayedSound, meta.confettiColors]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Fondo oscuro inmersivo estilo Club Fortnite */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#040814]/90 backdrop-blur-xl"
          onClick={onClose}
        />

        {/* Aura radial neon */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 40%, ${meta.glow} 0%, transparent 60%)`,
          }}
        />

        {/* Modal Card con diseño horizontal adaptativo (2 columnas) para evitar que se corte el botón */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl overflow-hidden border-2 border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.85)] bg-gradient-to-b from-[#0b1329] via-[#091024] to-[#040714] text-white z-10 flex flex-col md:flex-row"
        >
          {/* Botón cerrar X en esquina superior derecha */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Columna Izquierda: Celebración, Emblema y Rango */}
          <div className="relative p-6 sm:p-8 md:w-5/12 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-white/10 overflow-hidden bg-gradient-to-b md:bg-gradient-to-br from-white/[0.04] to-transparent shrink-0">
            {/* Glow decorativo de cabecera */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-gradient-to-b from-white/20 to-transparent blur-2xl pointer-events-none" />

            {/* Badge de Nivel */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: "spring" }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-black tracking-widest uppercase border mb-2.5 shadow-lg ${meta.badgeBg}`}
            >
              <Sparkles className={`w-3 h-3 ${meta.sparklesColor} animate-spin`} style={{ animationDuration: "6s" }} />
              <span className={`bg-gradient-to-r ${meta.levelGradient} bg-clip-text text-transparent`}>
                {meta.level}
              </span>
              <Sparkles className={`w-3 h-3 ${meta.sparklesColor} animate-spin`} style={{ animationDuration: "6s" }} />
            </motion.div>

            {/* Titular Principal Adaptado a Cada Plan */}
            <motion.h2
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl sm:text-3xl font-black tracking-tight uppercase"
            >
              <span className={`bg-gradient-to-r ${meta.gradient} bg-clip-text text-transparent drop-shadow-sm`}>
                {headline || meta.headline}
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-slate-300 text-xs font-medium mt-1 max-w-xs"
            >
              {meta.tagline}
            </motion.p>

            {/* Gran Emblema del Rango */}
            <motion.div
              initial={{ scale: 0.3, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
              className="my-4 relative inline-flex items-center justify-center"
            >
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-white/20 to-white/5 border-2 border-white/30 flex items-center justify-center shadow-[0_0_35px_rgba(255,255,255,0.2)] backdrop-blur-md relative group"
              >
                <div
                  className={`absolute inset-0 rounded-3xl bg-gradient-to-tr ${meta.buttonGradient} opacity-40 blur-xl group-hover:opacity-75 transition-opacity`}
                />
                <TierIcon className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] relative z-10" />
              </div>
            </motion.div>

            <div className="text-lg sm:text-xl font-black text-white tracking-wide">
              {meta.title}
            </div>
            <div className={`text-[11px] ${meta.verifiedText} font-bold uppercase tracking-wider mt-1 flex items-center justify-center gap-1`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Suscripción Verificada y Activada</span>
            </div>
          </div>

          {/* Columna Derecha: Recompensas, Beneficios y Botón de Acción */}
          <div className="p-6 sm:p-8 md:w-7/12 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Recompensas & Beneficios Desbloqueados
                </h3>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${meta.activeBadgeBg}`}>
                  Activos Ahora
                </span>
              </div>

              {/* Beneficios Destacados: Comisión y Créditos IA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${meta.primaryCardBg} ${meta.primaryCardBorder} ${meta.primaryCardText} text-xs font-bold`}>
                  <ShieldCheck className={`w-4 h-4 ${meta.primaryCardIconColor} shrink-0`} />
                  <span className="leading-tight">{meta.commissionText}</span>
                </div>

                <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${meta.secondaryCardBg} ${meta.secondaryCardBorder} ${meta.secondaryCardText} text-xs font-bold`}>
                  <Zap className={`w-4 h-4 ${meta.secondaryCardIconColor} shrink-0`} />
                  <span className="leading-tight">{meta.aiCreditsText}</span>
                </div>
              </div>

              {/* Lista de perks específicos */}
              <div className="space-y-2 py-1">
                {meta.perks.map((perk, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <CheckCircle2 className={`w-4 h-4 ${meta.checkColor} shrink-0 mt-0.5`} />
                    <span className="leading-relaxed">{perk}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botón de Acción Estilo Club Fortnite */}
            <div className="pt-4 mt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onContinueToDashboard) {
                    onContinueToDashboard();
                  }
                }}
                className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm uppercase tracking-wider text-white shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r ${meta.buttonGradient} hover:brightness-110`}
                style={{
                  boxShadow: `0 8px 25px ${meta.buttonGlow}`,
                }}
              >
                <span>¡Continuar al Portal de Coach!</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
