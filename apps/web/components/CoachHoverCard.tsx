"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ShieldCheck, Calendar, ArrowUpRight, Sparkles } from "lucide-react";

interface CoachHoverCardProps {
  coach: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    role?: string;
    coachProfile?: {
      slug?: string;
      headline?: string | null;
      hourlyRateCents?: number | null;
      currency?: string | null;
      averageRating?: number | null;
      reviewCount?: number | null;
      photoUrl?: string | null;
      categories?: Array<{ category: { name: string } }>;
    } | null;
  };
  children: React.ReactNode;
}

export default function CoachHoverCard({ coach, children }: CoachHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const profile = coach?.coachProfile;
  const isCoach = coach?.role === "COACH" || !!profile;

  // Si no es coach o no tiene perfil configurado, sólo renderizar los hijos sin popover
  if (!isCoach || !profile) {
    return <>{children}</>;
  }

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 180);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const formattedPrice =
    typeof profile.hourlyRateCents === "number" && profile.hourlyRateCents > 0
      ? `$${(profile.hourlyRateCents / 100).toFixed(0)} ${profile.currency || "USD"}/h`
      : null;

  const rating = profile.averageRating ? profile.averageRating.toFixed(1) : "5.0";
  const reviewCount = profile.reviewCount || 0;
  const profileUrl = profile.slug ? `/coaches/${profile.slug}` : `#`;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 bottom-full mb-2 z-50 w-72 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-emerald-500/20 text-slate-800 dark:text-slate-100 ring-1 ring-slate-900/5 pointer-events-auto"
          >
            {/* Header del Coach con Avatar y Verificación */}
            <div className="flex items-start gap-3 mb-3">
              <img
                src={
                  profile.photoUrl ||
                  coach.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(coach.name)}&background=7c3aed&color=fff`
                }
                alt={coach.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/30 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white truncate">
                    {coach.name}
                  </h4>
                  <span title="Coach Verificado" className="inline-flex items-center">
                    <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-purple-600 dark:text-purple-400">
                  Coach Certificado CFH
                </p>
                {/* Rating */}
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-amber-500 font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>{rating}</span>
                  <span className="text-gray-400 dark:text-slate-500 font-normal text-xs sm:text-sm">
                    ({reviewCount} reseñas)
                  </span>
                </div>
              </div>
            </div>

            {/* Headline / Titular */}
            {profile.headline && (
              <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-3 break-words [overflow-wrap:anywhere] overflow-hidden">
                {profile.headline}
              </p>
            )}

            {/* Categorías y Tarifa */}
            <div className="flex items-center justify-between text-xs pt-2.5 pb-3 border-t border-gray-100 dark:border-slate-800">
              <div className="flex flex-wrap gap-1 max-w-[60%]">
                {profile.categories && profile.categories.length > 0 ? (
                  profile.categories.slice(0, 2).map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-bold truncate max-w-[100px]"
                    >
                      {c.category.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">Coaching Online</span>
                )}
              </div>
              {formattedPrice && (
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                  {formattedPrice}
                </span>
              )}
            </div>

            {/* Acciones Rápidas */}
            <div className="flex items-center gap-2 pt-1">
              <Link
                href={profileUrl}
                className="flex-1 py-1.5 px-3 text-center rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all flex items-center justify-center gap-1"
              >
                <span>Ver perfil</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
              <Link
                href={`${profileUrl}#agendar`}
                className="flex-1 py-1.5 px-3 text-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-sm shadow-purple-600/20 flex items-center justify-center gap-1"
              >
                <Calendar className="w-3 h-3" />
                <span>Agendar</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
