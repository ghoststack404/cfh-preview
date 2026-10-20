"use client";

import React from "react";
import {
  Code,
  Palette,
  Heart,
  BookOpen,
  Languages,
  TrendingUp,
  Sparkles,
  Cpu,
  ShieldCheck,
  Compass,
  Camera,
  Music,
  Activity,
  Award,
  Feather,
  Briefcase,
  Wallet,
  Users,
  Database,
  Tag,
} from "lucide-react";

export interface CategoryTheme {
  type: string;
  symbol?: string;
  Icon: React.ElementType;
  bg: string;
  border: string;
  text: string;
  glow?: string;
  hasFlame?: boolean;
  hasHeart?: boolean;
  hasMath?: boolean;
  hasCode?: boolean;
}

export function getCategoryTheme(rawName: string): CategoryTheme {
  const norm = (rawName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 1. Arte & Creatividad & Diseño (Efecto Fuego / Naranja cálido estilo Imagen 2 del usuario)
  if (norm.includes("arte") || norm.includes("diseno") || norm.includes("creativid")) {
    return {
      type: "art",
      symbol: "🎨",
      Icon: Palette,
      bg: "bg-gradient-to-r from-amber-500/15 via-orange-500/20 to-red-500/15 dark:from-amber-500/25 dark:via-orange-500/30 dark:to-red-500/25",
      border: "border-orange-500/50 dark:border-orange-400/60 shadow-[0_0_12px_rgba(249,115,22,0.25)]",
      text: "text-orange-700 dark:text-orange-300",
      hasFlame: true,
    };
  }

  // 2. Psicología, Salud Mental & Bienestar (Efecto Corazones / Rosa pastel estilo Imagen 2 del usuario)
  if (norm.includes("psicolog") || norm.includes("bienestar") || norm.includes("salud mental") || norm.includes("emocion")) {
    return {
      type: "psychology",
      symbol: "♥",
      Icon: Heart,
      bg: "bg-gradient-to-r from-rose-500/15 via-pink-500/20 to-fuchsia-500/15 dark:from-rose-500/25 dark:via-pink-500/30 dark:to-fuchsia-500/25",
      border: "border-pink-400/50 dark:border-pink-400/60 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
      text: "text-rose-700 dark:text-pink-300",
      hasHeart: true,
    };
  }

  // 3. Tecnología & Programación (Efecto Código </>, Terminal, Cyan/Esmeralda)
  if (
    norm.includes("tecnolog") ||
    norm.includes("programac") ||
    norm.includes("codigo") ||
    norm.includes("software") ||
    norm.includes("dev") ||
    norm.includes("web")
  ) {
    return {
      type: "code",
      symbol: "</>",
      Icon: Code,
      bg: "bg-gradient-to-r from-emerald-500/15 via-teal-500/20 to-cyan-500/15 dark:from-emerald-500/25 dark:via-teal-500/30 dark:to-cyan-500/25",
      border: "border-cyan-400/50 dark:border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.25)]",
      text: "text-emerald-700 dark:text-cyan-300",
      hasCode: true,
    };
  }

  // 4. Matemáticas, Ciencias & Apoyo Académico (Efecto π, ∑, Fórmulas)
  if (
    norm.includes("mate") ||
    norm.includes("cienc") ||
    norm.includes("fisic") ||
    norm.includes("academ") ||
    norm.includes("calcul")
  ) {
    return {
      type: "math",
      symbol: "π ∑",
      Icon: BookOpen,
      bg: "bg-gradient-to-r from-blue-500/15 via-indigo-500/20 to-sky-500/15 dark:from-blue-500/25 dark:via-indigo-500/30 dark:to-sky-500/25",
      border: "border-blue-400/50 dark:border-blue-400/60 shadow-[0_0_12px_rgba(59,130,246,0.25)]",
      text: "text-blue-700 dark:text-blue-300",
      hasMath: true,
    };
  }

  // 5. Inteligencia Artificial & Big Data (Efecto IA, Rayos, Violeta)
  if (norm.includes("ia") || norm.includes("inteligen") || norm.includes("datos") || norm.includes("data")) {
    return {
      type: "ai",
      symbol: "⚡ AI",
      Icon: Cpu,
      bg: "bg-gradient-to-r from-violet-500/15 via-purple-500/20 to-fuchsia-500/15 dark:from-violet-500/25 dark:via-purple-500/30 dark:to-fuchsia-500/25",
      border: "border-violet-400/50 dark:border-violet-400/60 shadow-[0_0_12px_rgba(139,92,246,0.25)]",
      text: "text-violet-700 dark:text-violet-300",
    };
  }

  // 6. Ciberseguridad & Redes
  if (norm.includes("ciber") || norm.includes("segurid") || norm.includes("redes")) {
    return {
      type: "security",
      symbol: "🛡️",
      Icon: ShieldCheck,
      bg: "bg-gradient-to-r from-slate-600/15 via-cyan-600/20 to-emerald-600/15 dark:from-slate-600/30 dark:via-cyan-600/30 dark:to-emerald-600/30",
      border: "border-cyan-500/50 dark:border-cyan-400/60",
      text: "text-cyan-800 dark:text-cyan-200",
    };
  }

  // 7. Idiomas & Inglés
  if (norm.includes("idioma") || norm.includes("ingles") || norm.includes("english")) {
    return {
      type: "languages",
      symbol: "🌐 EN",
      Icon: Languages,
      bg: "bg-gradient-to-r from-sky-500/15 via-blue-500/20 to-indigo-500/15 dark:from-sky-500/25 dark:via-blue-500/30 dark:to-indigo-500/25",
      border: "border-sky-400/50 dark:border-sky-400/60 shadow-[0_0_12px_rgba(14,165,233,0.25)]",
      text: "text-sky-700 dark:text-sky-300",
    };
  }

  // 8. Finanzas & Inversiones
  if (norm.includes("finanz") || norm.includes("invers")) {
    return {
      type: "finance",
      symbol: "$",
      Icon: Wallet,
      bg: "bg-gradient-to-r from-emerald-500/15 via-teal-500/20 to-green-500/15 dark:from-emerald-500/25 dark:via-teal-500/30 dark:to-green-500/25",
      border: "border-emerald-400/50 dark:border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
      text: "text-emerald-700 dark:text-emerald-300",
    };
  }

  // 9. Negocios & Ventas & Emprendimiento
  if (norm.includes("negocio") || norm.includes("ventas") || norm.includes("emprend")) {
    return {
      type: "business",
      symbol: "▲ BIZ",
      Icon: norm.includes("ventas") ? TrendingUp : Briefcase,
      bg: "bg-gradient-to-r from-amber-500/15 via-emerald-500/20 to-teal-500/15 dark:from-amber-500/25 dark:via-emerald-500/30 dark:to-teal-500/25",
      border: "border-amber-400/50 dark:border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
      text: "text-amber-800 dark:text-amber-300",
    };
  }

  // 10. Salud & Fitness & Nutrición
  if (norm.includes("salud") || norm.includes("fitness") || norm.includes("nutric")) {
    return {
      type: "fitness",
      symbol: "⚡ FIT",
      Icon: Activity,
      bg: "bg-gradient-to-r from-lime-500/15 via-emerald-500/20 to-teal-500/15 dark:from-lime-500/25 dark:via-emerald-500/30 dark:to-teal-500/25",
      border: "border-lime-400/50 dark:border-lime-400/60 shadow-[0_0_12px_rgba(132,204,22,0.25)]",
      text: "text-lime-700 dark:text-lime-300",
    };
  }

  // 11. Música, Canto & Producción
  if (norm.includes("music") || norm.includes("canto") || norm.includes("audio")) {
    return {
      type: "music",
      symbol: "♪ ♫",
      Icon: Music,
      bg: "bg-gradient-to-r from-fuchsia-500/15 via-purple-500/20 to-pink-500/15 dark:from-fuchsia-500/25 dark:via-purple-500/30 dark:to-pink-500/25",
      border: "border-fuchsia-400/50 dark:border-fuchsia-400/60 shadow-[0_0_12px_rgba(217,70,239,0.25)]",
      text: "text-fuchsia-700 dark:text-fuchsia-300",
    };
  }

  // 12. Fotografía & Video
  if (norm.includes("foto") || norm.includes("video") || norm.includes("film")) {
    return {
      type: "photo",
      symbol: "🎥",
      Icon: Camera,
      bg: "bg-gradient-to-r from-indigo-500/15 via-blue-500/20 to-cyan-500/15 dark:from-indigo-500/25 dark:via-blue-500/30 dark:to-cyan-500/25",
      border: "border-indigo-400/50 dark:border-indigo-400/60 shadow-[0_0_12px_rgba(99,102,241,0.25)]",
      text: "text-indigo-700 dark:text-indigo-300",
    };
  }

  // 13. Escritura & Copywriting
  if (norm.includes("escrit") || norm.includes("copy") || norm.includes("story")) {
    return {
      type: "writing",
      symbol: "✍️",
      Icon: Feather,
      bg: "bg-gradient-to-r from-yellow-500/15 via-amber-500/20 to-stone-500/15 dark:from-yellow-500/25 dark:via-amber-500/30 dark:to-stone-500/25",
      border: "border-amber-400/50 dark:border-amber-400/60",
      text: "text-amber-800 dark:text-amber-300",
    };
  }

  // 14. Liderazgo & Equipos
  if (norm.includes("lider") || norm.includes("equipo") || norm.includes("manage")) {
    return {
      type: "leadership",
      symbol: "👥",
      Icon: Users,
      bg: "bg-gradient-to-r from-blue-500/15 via-cyan-500/20 to-teal-500/15 dark:from-blue-500/25 dark:via-cyan-500/30 dark:to-teal-500/25",
      border: "border-blue-400/50 dark:border-blue-400/60",
      text: "text-blue-700 dark:text-blue-300",
    };
  }

  // 15. Productividad & Organización
  if (norm.includes("productiv") || norm.includes("organiz") || norm.includes("habito")) {
    return {
      type: "productivity",
      symbol: "🧭",
      Icon: Compass,
      bg: "bg-gradient-to-r from-teal-500/15 via-emerald-500/20 to-cyan-500/15 dark:from-teal-500/25 dark:via-emerald-500/30 dark:to-cyan-500/25",
      border: "border-teal-400/50 dark:border-teal-400/60",
      text: "text-teal-700 dark:text-teal-300",
    };
  }

  // 16. Coaching Ejecutivo & Carrera
  if (norm.includes("carrera") || norm.includes("ejecutiv")) {
    return {
      type: "career",
      symbol: "🏆",
      Icon: Award,
      bg: "bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-orange-500/15 dark:from-amber-500/25 dark:via-yellow-500/30 dark:to-orange-500/25",
      border: "border-amber-400/50 dark:border-amber-400/60",
      text: "text-amber-800 dark:text-amber-300",
    };
  }

  // 17. Desarrollo Personal (Genérico de Crecimiento)
  if (norm.includes("desarrollo personal") || norm.includes("personal")) {
    return {
      type: "growth",
      symbol: "✨",
      Icon: Sparkles,
      bg: "bg-gradient-to-r from-purple-500/15 via-pink-500/20 to-amber-500/15 dark:from-purple-500/25 dark:via-pink-500/30 dark:to-amber-500/25",
      border: "border-purple-400/50 dark:border-purple-400/60 shadow-[0_0_12px_rgba(168,85,247,0.2)]",
      text: "text-purple-700 dark:text-purple-300",
    };
  }

  // Fallback por defecto
  return {
    type: "default",
    symbol: "✦",
    Icon: Tag,
    bg: "bg-gray-100 dark:bg-slate-800",
    border: "border-gray-200 dark:border-slate-700",
    text: "text-gray-700 dark:text-slate-300",
  };
}

export interface CategoryBadgeProps {
  category: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showIcon?: boolean;
}

export default function CategoryBadge({
  category,
  size = "md",
  className = "",
  showIcon = true,
}: CategoryBadgeProps) {
  const theme = getCategoryTheme(category);
  const Icon = theme.Icon;

  const sizeClasses = {
    sm: "px-2.5 py-0.5 text-[11px] gap-1.5",
    md: "px-3.5 py-1 text-xs sm:text-sm gap-2",
    lg: "px-4 py-1.5 text-sm sm:text-base gap-2.5",
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-xl border font-bold transition-all backdrop-blur-xs select-none ${sizeClasses} ${theme.bg} ${theme.border} ${theme.text} ${className}`}
    >
      {/* Micro-símbolo temático característico (código </>, math π, arte fuego, psicología corazón) */}
      {showIcon && (
        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-[10px] font-black tracking-tighter shrink-0 leading-none">
          {theme.symbol}
        </span>
      )}

      {/* Nombre de la categoría */}
      <span className="leading-snug">{category}</span>

      {/* Decoración gráfica distintiva */}
      {theme.hasFlame && (
        <span className="text-[11px] animate-pulse shrink-0" title="Área de Arte & Creatividad">
          🔥
        </span>
      )}
      {theme.hasHeart && (
        <span className="text-[11px] shrink-0" title="Área de Psicología & Bienestar">
          💗
        </span>
      )}
    </span>
  );
}
