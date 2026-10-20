"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "../context/AuthModalContext";
import { useTranslation } from "./TranslationProvider";
import { translateCoachName, translateCoachHeadline } from "@/lib/i18n-helpers";
import dynamic from "next/dynamic";
import { AutoTranslate } from "./AutoTranslate";

const ValeriaAvatarWidget = dynamic(() => import("./ValeriaAvatarWidget"), { ssr: false });
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Video,
  Star,
  Users,
  CheckCircle2,
  BookOpen,
  Award,
  Zap,
  TrendingUp,
  Brain,
  MessageSquare,
  Globe,
  Calendar,
  Lock,
  Heart,
  Languages,
  Code,
  Wallet,
  Megaphone,
  Palette,
  Briefcase,
  Layout,
} from "lucide-react";

interface CoachItem {
  id: string;
  name: string;
  headline: string;
  expert: string;
  rating: number;
  reviews: number;
  price: number;
  currency: string;
  level: string;
  img: string;
}

interface CategoryItem {
  name: string;
  icon: string;
  slug?: string;
  coursesCount?: string;
}

export default function HomeClient({
  coaches,
  categories,
}: {
  coaches: CoachItem[];
  categories: CategoryItem[];
}) {
  const { t } = useTranslation();

  const translateCategory = (catName: string) => {
    if (!catName) return "";
    const key = catName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return t(`Categories.${key}`, catName);
  };

  const { data: session } = useSession();
  const { openRegister, openRegisterWithRole, switchToRegister } = useAuthModal();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"students" | "coaches">("students");
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);
  const cookieRole = isMounted && typeof document !== "undefined"
    ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
    : null;
  const effectiveUser = currentUser || session?.user;
  const activeRole = cookieRole || effectiveUser?.activeRole || effectiveUser?.role;
  const isCoach = activeRole === "COACH";
  const isStudent = activeRole === "STUDENT" || activeRole === "APPRENTICE";

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const user = data?.user || (data?.authenticated ? data?.user : null);
        if (user) {
          setCurrentUser(user);
        }
      })
      .catch(() => {});
  }, []);

  const handleTrialBooking = (coachId?: string) => {
    if (!currentUser) {
      openRegisterWithRole("STUDENT");
    } else {
      if (coachId) {
        router.push(`/coaches/${coachId}`);
      } else {
        router.push("/coaches");
      }
    }
  };

  const featuredCoaches = coaches.slice(0, 4);
  const currentCoach = featuredCoaches[currentSlide];

  React.useEffect(() => {
    if (featuredCoaches.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredCoaches.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [featuredCoaches.length]);

  const getTierBadge = (tier: string) => {
    switch (tier?.toUpperCase()) {
      case "ELITE":
        return "bg-purple-50 text-purple-700 border-purple-200/80";
      case "EXPERT":
        return "bg-indigo-50 text-indigo-700 border-indigo-200/80";
      case "DESTACADO":
      case "FEATURED":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
    }
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case "heart": return <Heart className="w-6 h-6" />;
      case "languages": return <Languages className="w-6 h-6" />;
      case "code": return <Code className="w-6 h-6" />;
      case "wallet": return <Wallet className="w-6 h-6" />;
      case "sparkles": return <Sparkles className="w-6 h-6" />;
      case "megaphone": return <Megaphone className="w-6 h-6" />;
      case "palette": return <Palette className="w-6 h-6" />;
      case "briefcase": return <Briefcase className="w-6 h-6" />;
      default: return <Layout className="w-6 h-6" />;
    }
  };

  const containerVariants = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 1, y: 0 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <div className="w-full bg-slate-50/60 dark:bg-slate-950 overflow-x-clip min-h-screen">
      
      {/* HERO SECTION */}
      <section className="relative pt-8 pb-16 md:pt-14 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Background Ambient Lights */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-gradient-to-tr from-cfh-light-green/20 via-cfh-dark-green/15 to-blue-300/20 blur-3xl -z-10 pointer-events-none rounded-full" />

        <motion.div
          initial={false}
          animate="show"
          variants={containerVariants}
          className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center"
        >
          {/* Left Column: Copy & CTAs (7 cols) */}
          <motion.div variants={itemVariants} className="lg:col-span-7 flex flex-col items-start text-left">
            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-gray-950 dark:text-slate-100 tracking-tight leading-[1.12] mb-5 sm:mb-6">
              {t("Home.hero_title_1") || "Aprende de los mejores coaches,"}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cfh-dark-green via-[#0e4b39] to-cfh-light-green dark:from-cfh-light-green dark:via-emerald-400 dark:to-teal-200">
                {t("Home.hero_title_2") || "transforma tu mañana."}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-slate-300 mb-7 sm:mb-9 max-w-2xl leading-relaxed font-normal">
              {t("Home.hero_desc") || "Conecta en sesiones en vivo de 60 minutos con mentores certificados, accede a cursos prácticos y acelera tu carrera con herramientas de Inteligencia Artificial integradas."}
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4 w-full sm:w-auto mb-8 sm:mb-10">
              {isStudent ? (
                <>
                  <Link
                    href="/dashboard#agenda"
                    className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 lg:px-9 py-3.5 sm:py-4 rounded-2xl bg-cfh-dark-green hover:bg-[#061528] text-white font-black text-base sm:text-lg shadow-xl shadow-cfh-dark-green/25 hover:shadow-2xl transition-all transform hover:-translate-y-0.5 active:scale-98 text-center"
                  >
                    <span>{t("Navigation.dashboard", "Mi Aprendizaje")}</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/coaches"
                    className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 text-cfh-dark-green dark:text-cfh-light-green border-2 border-gray-200 dark:border-slate-700 hover:border-cfh-light-green dark:hover:border-cfh-light-green font-bold text-base sm:text-lg shadow-sm transition-all cursor-pointer text-center"
                  >
                    <span>{t("Home.explore_coaches") || "Explorar Coaches"}</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </>
              ) : isCoach ? (
                <>
                  <Link
                    href="/coach/dashboard"
                    className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 lg:px-9 py-3.5 sm:py-4 rounded-2xl bg-cfh-dark-green hover:bg-[#061528] text-white font-black text-base sm:text-lg shadow-xl shadow-cfh-dark-green/25 hover:shadow-2xl transition-all transform hover:-translate-y-0.5 active:scale-98 text-center"
                  >
                    <span>{t("Navigation.coach_portal", "Portal Coach")}</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/coach/cursos"
                    className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 text-cfh-dark-green dark:text-cfh-light-green border-2 border-gray-200 dark:border-slate-700 hover:border-cfh-light-green dark:hover:border-cfh-light-green font-bold text-base sm:text-lg shadow-sm transition-all cursor-pointer text-center"
                  >
                    <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t("Navigation.my_courses", "Mis Cursos")}</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/coaches"
                    className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 lg:px-9 py-3.5 sm:py-4 rounded-2xl bg-cfh-dark-green hover:bg-[#061528] text-white font-black text-base sm:text-lg shadow-xl shadow-cfh-dark-green/25 hover:shadow-2xl transition-all transform hover:-translate-y-0.5 active:scale-98 text-center"
                  >
                    <span>{t("Home.explore_coaches") || "Explorar Coaches"}</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <button
                    type="button"
                    suppressHydrationWarning
                    onClick={() => openRegisterWithRole("COACH")}
                    className="inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 text-cfh-dark-green dark:text-cfh-light-green border-2 border-gray-200 dark:border-slate-700 hover:border-cfh-light-green dark:hover:border-cfh-light-green font-bold text-base sm:text-lg shadow-sm transition-all cursor-pointer text-center"
                  >
                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <span>{t("Home.teach_cta") || "Quiero Enseñar"}</span>
                  </button>

                </>
              )}
            </div>

            {/* Trust Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-5 pt-6 border-t border-gray-200/80 dark:border-slate-800 w-full text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-cfh-light-green shrink-0" />
                <span>{t("Home.free_intro") || "1ra Sesión Gratis (15 min)"}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-cfh-light-green shrink-0" />
                <span>{t("Home.video_pitch") || "Coaches con Video Pitch"}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-cfh-light-green shrink-0" />
                <span>{t("Home.secure_payments") || "Pagos protegidos con Stripe"}</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Interactive Card / Visual Showcase (5 cols) */}
          <motion.div variants={itemVariants} className="lg:col-span-5 relative w-full">
            <div className="relative mx-auto w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-gray-100/80 dark:border-slate-800 min-h-[340px]">
              
              {/* Featured Badge */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green bg-cfh-dark-green/5 dark:bg-slate-800 px-3 py-1 rounded-full">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{t("Home.featured_session") || "Sesión en Vivo Destacada"}</span>
                </div>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {t("Home.live_1on1") || "Sesiones en vivo de 60 minutos"}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {featuredCoaches.length > 0 && currentCoach && (
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Coach Showcase Card */}
                    <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100 dark:border-slate-800">
                      <div className="relative">
                        <img
                          src={currentCoach.img}
                          alt={currentCoach.name}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(currentCoach.name)}`;
                          }}
                          className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-white dark:border-slate-800 bg-gray-200 dark:bg-slate-800"
                        />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-gray-900 dark:text-slate-100 text-base truncate">
                          {translateCoachName(currentCoach.name, t)}
                        </h4>
                        <p className="text-xs font-semibold text-cfh-dark-green dark:text-cfh-light-green truncate">
                          <AutoTranslate text={currentCoach.headline} fallback={translateCoachHeadline(currentCoach.headline, t)} />
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-1">
                          <span className="text-amber-500 font-bold flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                            <span>{currentCoach.rating.toFixed(1)}</span>
                            <span className="text-gray-400 dark:text-slate-500 font-normal">({currentCoach.reviews} {t("Home.reviews_count") || "reseñas"})</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-xs text-gray-700 dark:text-slate-300">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-gray-500 dark:text-slate-400 shrink-0">{t("Home.advisory_subject") || "Materia de Asesoría:"}</span>
                        <span className="font-bold text-gray-900 dark:text-slate-100 truncate text-right">
                          {translateCategory(currentCoach.expert)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-slate-400">{t("Home.session_format") || "Formato:"}</span>
                        <span className="font-bold text-cfh-dark-green dark:text-cfh-light-green flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" /> {t("Home.live_video_call") || "Videollamada en vivo"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 dark:text-slate-400">{t("Home.initial_trial") || "Prueba inicial:"}</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                          {t("Home.free_minutes") || "15 Minutos Gratis"}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      suppressHydrationWarning
                      onClick={() => handleTrialBooking(featuredCoaches[currentSlide]?.id)}
                      className="w-full py-3.5 rounded-2xl bg-cfh-dark-green hover:bg-[#061528] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cfh-dark-green/20 transition-all cursor-pointer"
                    >
                      <span>{t("Home.book_trial") || "Agendar Sesión de Prueba"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* DINAMISMO DE COACHES */}
      <section className="py-12 bg-white dark:bg-slate-900/60 border-y border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-cfh-dark-green dark:text-cfh-light-green uppercase tracking-wider mb-1.5">
                <Sparkles className="w-5 h-5 text-cfh-light-green" />
                <span>{t("Home.available_mentors_badge") || "Nuestros Mentores Disponibles"}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                {t("Home.available_mentors_title") || "Coaches Expertos listos para impulsarte"}
              </h2>
              <p className="text-base sm:text-lg text-gray-600 dark:text-slate-300 mt-2">
                {t("Home.available_mentors_desc") || "Aprende en sesiones de 60 min con profesionales activos en las industrias más demandadas."}
              </p>
            </div>

            <Link
              href="/coaches"
              className="inline-flex items-center gap-2 text-base font-black text-cfh-dark-green dark:text-cfh-light-green hover:underline transition-colors self-start md:self-auto"
            >
              <span>{t("Home.view_all_coaches") || "Ver todos los coaches"} ({coaches.length})</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Coaches Marquee */}
          <div className="relative w-full pt-4 pb-8 overflow-hidden">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-8 md:w-24 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 md:w-24 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10 pointer-events-none"></div>
            
            <div className="flex gap-6 w-max animate-marquee">
              {(coaches.length < 6 ? [...coaches, ...coaches, ...coaches, ...coaches] : [...coaches, ...coaches]).map((coach, index) => (
                <Link
                  key={`${coach.id}-${index}`}
                  href={`/coaches/${coach.id}`}
                  className="w-[260px] sm:w-[290px] shrink-0 bg-white dark:bg-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-750 rounded-3xl p-4 sm:p-5 border border-gray-200/90 dark:border-slate-700 hover:border-cfh-light-green dark:hover:border-cfh-light-green shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    {/* Avatar & Tier */}
                    <div className="relative mb-4">
                      <div className="w-22 h-22 rounded-2xl overflow-hidden shadow-md border-2 border-white dark:border-slate-700 mx-auto bg-gradient-to-br from-slate-100 to-emerald-50/40 dark:from-slate-700 dark:to-slate-800">
                        <img
                          src={coach.img}
                          alt={coach.name}
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(coach.name)}`;
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      {coach.level && (
                        <span className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 border text-[11px] font-black uppercase tracking-wider rounded-full shadow-sm ${getTierBadge(coach.level)}`}>
                          {coach.level}
                        </span>
                      )}
                    </div>

                    {/* Coach Info */}
                    <div className="text-center mt-4">
                      <h3 className="font-black text-lg text-gray-900 dark:text-slate-100 group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green transition-colors truncate">
                        {translateCoachName(coach.name, t)}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-slate-300 font-medium line-clamp-1 mt-1">
                        <AutoTranslate text={coach.headline} fallback={translateCoachHeadline(coach.headline, t)} />
                      </p>
                      <span className="inline-block mt-2.5 px-3.5 py-1 bg-slate-100/80 dark:bg-slate-700/80 group-hover:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green text-xs font-bold rounded-full border border-gray-200/60 dark:border-slate-600 transition-colors truncate max-w-full">
                        {translateCategory(coach.expert)}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-center gap-3 text-sm text-gray-600 dark:text-slate-400 mt-4 pt-3.5 border-t border-gray-100 dark:border-slate-700">
                      <span className="flex items-center gap-1 font-bold text-amber-500">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                        <span className="text-gray-900 dark:text-slate-100 font-bold">{coach.rating.toFixed(1)}</span>
                      </span>
                      <span className="text-gray-300 dark:text-slate-600">•</span>
                      <span className="font-black text-gray-900 dark:text-slate-100 text-base">
                        ${coach.price}{" "}
                        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                          {coach.currency}/{t("Home.per_hour") || "hr"}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Direct CTA */}
                  <div className="mt-5 w-full py-3 rounded-xl bg-slate-100/80 dark:bg-slate-700 text-cfh-dark-green dark:text-cfh-light-green border border-gray-200/80 dark:border-slate-600 group-hover:bg-cfh-dark-green dark:group-hover:bg-cfh-light-green group-hover:text-white dark:group-hover:text-slate-900 font-black text-sm text-center transition-all duration-200 shadow-sm flex items-center justify-center gap-2">
                    <span>{t("Home.view_profile_book") || "Ver Perfil & Reservar"}</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA / BENEFICIOS (Unificado) */}
      <section className="py-16 md:py-24 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header with Switch Tabs */}
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-14">
            <span className="text-sm font-black uppercase tracking-wider text-cfh-dark-green dark:text-cfh-light-green bg-cfh-dark-green/10 dark:bg-cfh-light-green/10 px-4 py-1.5 rounded-full mb-3.5">
              {t("Home.how_it_works_badge") || t("Home.step_by_step") || "Paso a Paso"}
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-slate-100 tracking-tight leading-tight">
              {t("Home.benefits_title") || "Diseñado para impulsar a Aprendices y Coaches"}
            </h2>
            <p className="text-base sm:text-xl text-gray-600 dark:text-slate-300 mt-4 mb-9 max-w-2xl leading-relaxed">
              {t("Home.benefits_desc") || t("Home.ecosystem_desc") || "Un ecosistema integral que combina mentorías en vivo, marketplace de cursos y herramientas de productividad."}
            </p>

            {/* Toggle Tabs */}
            <div className="flex w-full max-w-[340px] sm:max-w-[460px] p-1.5 sm:p-2 rounded-2xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setActiveTab("students")}
                className={`flex-1 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-base transition-all cursor-pointer ${
                  activeTab === "students"
                    ? "bg-cfh-dark-green text-white shadow-md"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                }`}
              >
                {t("Home.tab_students") || "Para Aprendices"}
              </button>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setActiveTab("coaches")}
                className={`flex-1 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-base transition-all cursor-pointer ${
                  activeTab === "coaches"
                    ? "bg-cfh-dark-green text-white shadow-md"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                }`}
              >

                {t("Home.tab_coaches") || "Para Coaches & Mentores"}
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Tab Content: Alumnos */}
            {activeTab === "students" && (
              <motion.div
                key="students"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
              >
                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm relative hover:shadow-md transition-shadow">
                  <div className="w-16 h-16 rounded-2xl bg-cfh-dark-green/10 dark:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center font-black text-2xl mb-6">
                    1
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-3">{t("Home.student_step_1_title", "Encuentra a tu Coach Ideal")}</h3>
                  <p className="text-base text-gray-600 dark:text-slate-300 leading-relaxed">
                    {t("Home.student_step_1_desc", "Explora perfiles verificados, mira sus videos de presentación y lee reseñas de otros alumnos.")}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm relative hover:shadow-md transition-shadow">
                  <div className="w-16 h-16 rounded-2xl bg-cfh-light-green/20 dark:bg-cfh-light-green/20 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center font-black text-2xl mb-6">
                    2
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-3">{t("Home.student_step_2_title", "Agenda tu Sesión Segura")}</h3>
                  <p className="text-base text-gray-600 dark:text-slate-300 leading-relaxed">
                    {t("Home.student_step_2_desc", "Aprovecha la 1ra sesión de 15 minutos gratis, con garantía de reagendamiento y pagos 100% resguardados por Stripe.")}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm relative hover:shadow-md transition-shadow">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-2xl mb-6">
                    3
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-3">{t("Home.student_step_3_title", "Aprende en Sesiones en vivo de 60 minutos")}</h3>
                  <p className="text-base text-gray-600 dark:text-slate-300 leading-relaxed">
                    {t("Home.student_step_3_desc", "Conéctate en salas interactivas nativas y obtén resúmenes automáticos de tus clases generados por IA al terminar.")}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Tab Content: Coaches */}
            {activeTab === "coaches" && (
              <motion.div
                key="coaches"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
              >
                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm relative hover:shadow-md transition-shadow">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 flex items-center justify-center font-black text-2xl mb-6">
                    1
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-3">{t("Home.coach_step_1_title", "Crea tu Perfil y Cursos")}</h3>
                  <p className="text-base text-gray-600 dark:text-slate-300 leading-relaxed">
                    {t("Home.coach_step_1_desc", "Construye tu marca personal y usa el Course Builder 24/7 para empaquetar tu conocimiento y generar ingresos pasivos.")}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm relative hover:shadow-md transition-shadow">
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 flex items-center justify-center font-black text-2xl mb-6">
                    2
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-3">{t("Home.coach_step_2_title", "Gestiona tus Sesiones")}</h3>
                  <p className="text-base text-gray-600 dark:text-slate-300 leading-relaxed">
                    {t("Home.coach_step_2_desc", "Mantén el control con una agenda flexible y comparte tu link de perfil público para recibir reservas en piloto automático.")}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 shadow-sm relative hover:shadow-md transition-shadow">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 flex items-center justify-center font-black text-2xl mb-6">
                    3
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-3">{t("Home.coach_step_3_title", "Enseña y Cobra en Automático")}</h3>
                  <p className="text-base text-gray-600 dark:text-slate-300 leading-relaxed">
                    {t("Home.coach_step_3_desc", "Usa el Coach Assistant AI Copilot para transcribir clases y preparar tareas, con comisiones transparentes directas a tu cuenta.")}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </section>

      {/* CATEGORÍAS POPULARES */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-sm font-black uppercase tracking-wider text-cfh-dark-green dark:text-cfh-light-green">
              {t("Home.categories_badge") || "Explora por Tema"}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-slate-100 tracking-tight mt-1.5">
              {t("Home.categories_title") || "Categorías más Demandadas"}
            </h2>
          </div>
          <Link href="/cursos" className="text-sm sm:text-base font-black text-cfh-dark-green dark:text-cfh-light-green hover:underline">
            {t("Home.view_all_categories") || "Ver todas"} →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {categories.map((cat, idx) => (
            <Link
              key={idx}
              href="/cursos"
              className="relative p-5 sm:p-7 rounded-[2rem] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-cfh-light-green/50 dark:hover:border-cfh-light-green/50 shadow-sm hover:shadow-xl hover:shadow-cfh-light-green/10 transition-all duration-300 group overflow-hidden flex flex-col justify-between"
            >
              {/* Decoración de fondo en hover */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-cfh-light-green/20 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-start h-full">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 group-hover:bg-cfh-dark-green dark:group-hover:bg-cfh-light-green text-slate-500 dark:text-slate-400 group-hover:text-cfh-light-green dark:group-hover:text-slate-950 flex items-center justify-center mb-6 transition-all duration-300 shadow-sm border border-slate-100 dark:border-slate-700 group-hover:border-cfh-dark-green transform group-hover:-translate-y-1">
                  {getCategoryIcon(cat.icon)}
                </div>
                <div className="mt-auto">
                  <h4 className="font-black text-lg sm:text-xl text-gray-900 dark:text-slate-100 group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green transition-colors leading-tight">
                    {translateCategory(cat.name)}
                  </h4>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 group-hover:text-cfh-light-green transition-colors">
                      {cat.coursesCount || t("Home.explore_topics", "Explorar temas")}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-cfh-light-green transition-all duration-300" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA FINAL BANNER */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="relative rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-cfh-dark-green via-[#082238] to-[#04111d] p-6 sm:p-12 lg:p-16 text-white shadow-2xl overflow-hidden text-center">
          
          {/* Decorative Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-cfh-light-green/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-3xl mx-auto">
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-cfh-light-green text-xs sm:text-sm font-black uppercase tracking-wider mb-4 border border-white/10">
              {t("Home.cta_badge") || "Comienza Hoy"}
            </span>

            <h2 className="text-2xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-4 sm:mb-6 leading-tight">
              {t("Home.cta_title") || "¿Listo para alcanzar tu máximo potencial?"}
            </h2>

            <p className="text-sm sm:text-lg lg:text-xl text-gray-200 max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed font-normal">
              {t("Home.cta_desc") || "Únete a cientos de aprendices y coaches que ya están transformando sus habilidades en Coaching From Home."}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
              {isCoach ? (
                <Link
                  href="/coach/dashboard"
                  className="w-full sm:w-auto px-6 sm:px-10 py-3.5 sm:py-4.5 rounded-2xl bg-cfh-light-green hover:bg-white text-cfh-dark-green font-black text-base sm:text-lg shadow-lg transition-all transform hover:scale-105 active:scale-95 text-center"
                >
                  {t("Home.go_to_coach_portal", "Ir a mi Portal Coach")}
                </Link>
              ) : isStudent ? (
                <Link
                  href="/dashboard#agenda"
                  className="w-full sm:w-auto px-6 sm:px-10 py-3.5 sm:py-4.5 rounded-2xl bg-cfh-light-green hover:bg-white text-cfh-dark-green font-black text-base sm:text-lg shadow-lg transition-all transform hover:scale-105 active:scale-95 text-center"
                >
                  {t("Home.go_to_learning", "Ir a Mi Aprendizaje")}
                </Link>
              ) : (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => openRegister()}
                  className="w-full sm:w-auto px-6 sm:px-10 py-3.5 sm:py-4.5 rounded-2xl bg-cfh-light-green hover:bg-white text-cfh-dark-green font-black text-base sm:text-lg shadow-lg transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  {t("Home.cta_create_account") || "Crear mi Cuenta Gratis"}
                </button>
              )}


              <Link
                href="/coaches"
                className="w-full sm:w-auto px-6 sm:px-9 py-3.5 sm:py-4.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-base sm:text-lg border border-white/20 transition-all backdrop-blur-sm text-center"
              >
                {t("Home.cta_explore_mentors") || "Explorar Mentores"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Valeria AI Assistant Widget */}
      <ValeriaAvatarWidget />

    </div>
  );
}
