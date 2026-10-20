"use client";
import React from "react";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import AddToCartButton from "@/components/AddToCartButton";
import { useAuthModal } from "@/context/AuthModalContext";
import { useSession } from "next-auth/react";
import { useCart } from "@/context/CartContext";
import { useTranslation } from "@/components/TranslationProvider";
import { translateCategory, translateCourseTitle, translateCoachName, translateCoachHeadline } from "@/lib/i18n-helpers";
import AutoTranslate from "@/components/AutoTranslate";
import {
  CheckCircle,
  Check,
  BookOpen,
  ChevronDown,
  PlayCircle,
  Clock,
  Video,
  FileText,
  Smartphone,
  Star,
  Sparkles,
  X,
  Play,
  UserCheck,
  Award,
  ShieldAlert,
  ArrowLeft
} from "lucide-react";

export interface CourseDetailData {
  id: string;
  title: string;
  summary: string;
  description: string;
  cleanDescription: string;
  whatYouWillLearn: string[];
  thumbnailUrl: string;
  introVideoUrl: string | null;
  price: number;
  originalPrice: number;
  averageRating: number;
  enrollmentCount: number;
  categoryName: string;
  coachName: string;
  coachAvatar: string | null;
  coachHeadline: string | null;
  isBestseller?: boolean;
  isEnrolled?: boolean;
  modules: Array<{
    id: string;
    title: string;
    description?: string | null;
    lessons: Array<{
      id: string;
      title: string;
      durationMinutes: number;
      kind: string;
      videoUrl?: string | null;
    }>;
  }>;
}

function getEmbedVideoUrl(url: string | null): string | null {
  if (!url) return null;
  const youtubeMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
  );
  if (youtubeMatch && youtubeMatch[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
  }
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  }
  return url;
}

export default function CourseDetailClient({ course }: { course: CourseDetailData }) {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  const { t, locale } = useTranslation();
  const translatedTitle = translateCourseTitle(course.id, course.title, t);
  const translatedCategory = translateCategory(course.categoryName, t);
  const translatedCoachName = translateCoachName(course.coachName, t);
  const translatedCoachHeadline = course.coachHeadline ? translateCoachHeadline(course.coachHeadline, t) : null;

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const { openLogin } = useAuthModal();
  const { data: session } = useSession();
  const { addItem, isInCart, setIsOpen } = useCart();
  const [currentUser, setCurrentUser] = useState<any>(null);
  useEffect(() => {
    if (session?.user) {
      setCurrentUser(session.user);
      return;
    }
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const u = data?.user || data?.data?.user;
        setCurrentUser(u || null);
      })
      .catch(() => setCurrentUser(null));
  }, [session]);

  const cookieRole = isMounted && typeof document !== "undefined"
    ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
    : null;
  const activeRole = cookieRole || currentUser?.activeRole || currentUser?.role || (session?.user as any)?.activeRole || (session?.user as any)?.role;
  const isCoach = activeRole === "COACH";

  const handleBuyNow = (e: React.MouseEvent) => {
    const isAuthed = Boolean(session?.user || currentUser);
    if (!isAuthed) {
      e.preventDefault();
      openLogin();
      return;
    }

    // Direct single-item checkout: keep cart drawer strictly closed and preserve existing cart intact
    setIsOpen(false);
  };

  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() => {
    // Open the first module by default
    const initial: Record<string, boolean> = {};
    if (course.modules.length > 0 && course.modules[0]) {
      initial[course.modules[0].id] = true;
    }
    return initial;
  });

  const toggleModule = (id: string) => {
    setOpenModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalDurationMinutes = course.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((lAcc, l) => lAcc + (l.durationMinutes || 10), 0),
    0
  );
  const totalHours = Math.floor(totalDurationMinutes / 60);
  const remainingMins = totalDurationMinutes % 60;
  const durationText = totalHours > 0 ? `${totalHours}h ${remainingMins}m` : `${totalDurationMinutes} min`;

  const embedUrl = getEmbedVideoUrl(course.introVideoUrl);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="w-full min-h-screen bg-slate-50/60 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors pb-24"
    >
      {/* Header Banner (Estilo Premium CFH) */}
      <div className="w-full bg-gradient-to-br from-slate-900 via-[#0d1a29] to-[#07111d] dark:from-slate-950 dark:via-[#08121f] dark:to-slate-950 text-white py-12 sm:py-16 border-b border-slate-800/80 relative overflow-hidden transition-colors">
        {/* Orbes decorativos de ambiente */}
        <div className="absolute -top-20 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col-reverse lg:flex-row gap-8 relative z-10">
          <motion.div variants={itemVariants} className="flex-1 lg:pr-[400px]">
            {/* Return / Navigation to courses catalog */}
            <div className="mb-6">
              <Link
                href={`/${locale}/cursos`}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 px-3.5 py-2 rounded-xl transition-all group backdrop-blur-md shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 text-cfh-light-green" />
                <span>{t("CourseDetail.back_to_catalog", "Volver al catálogo de cursos")}</span>
              </Link>
            </div>

            {/* Category Pill */}
            {course.categoryName && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{translatedCategory}</span>
              </div>
            )}

            {/* Course Title */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-4 leading-tight tracking-tight text-white">
              <AutoTranslate text={course.title} fallback={translatedTitle} as="span" />
            </h1>

            {/* Summary */}
            <p className="text-sm sm:text-base mb-6 text-slate-300 leading-relaxed max-w-2xl">
              <AutoTranslate text={course.summary} />
            </p>

            {/* Ratings & Badges */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="inline-flex items-center gap-1 bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {t("CourseDetail.featured_badge")}
              </span>
              {course.isBestseller && (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg">
                  🏆 Bestseller
                </span>
              )}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg backdrop-blur-xs">
                <span className="text-amber-400 font-black text-sm">
                  {course.averageRating > 0 ? course.averageRating.toFixed(1) : "4.9"}
                </span>
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <span className="text-xs text-slate-400 ml-1">
                  ({course.enrollmentCount > 0 ? `${course.enrollmentCount} alumnos` : "Nuevos alumnos"})
                </span>
              </div>
            </div>

            {/* Coach info */}
            <div className="flex items-center gap-3 pt-2">
              {course.coachAvatar ? (
                <img
                  src={course.coachAvatar}
                  alt={translatedCoachName}
                  className="w-11 h-11 rounded-2xl object-cover border-2 border-emerald-400/80 shadow-md"
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-lg flex items-center justify-center">
                  {translatedCoachName.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 font-medium">{t("CourseDetail.created_by", "Creado por")}</p>
                <p className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                  {translatedCoachName}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 flex flex-col lg:flex-row gap-12 relative">
        {/* Left Side */}
        <motion.div variants={itemVariants} className="flex-1 lg:pr-[380px]">
          {/* Lo que aprenderás */}
          {course.whatYouWillLearn.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 mb-10 shadow-sm transition-colors">
              <h2 className="text-xl sm:text-2xl font-black mb-5 text-gray-900 dark:text-white flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span>{t("CourseDetail.what_you_will_learn")}</span>
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm text-gray-700 dark:text-slate-300">
                {course.whatYouWillLearn.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-3.5 rounded-2xl transition-colors"
                  >
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contenido del curso (Syllabus) */}
          <div className="mb-10">
            <h2 className="text-xl sm:text-2xl font-black mb-2 text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <span>{t("CourseDetail.course_content")}</span>
            </h2>
            <div className="flex justify-between items-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4 px-1">
              <span>
                {t("CourseDetail.content_stats")
                  .replace("{modules}", String(course.modules.length))
                  .replace("{lessons}", String(totalLessons))
                  .replace("{duration}", durationText)}
              </span>
            </div>

            {course.modules.length === 0 ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
                El instructor aún no ha agregado módulos a este curso.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden text-sm divide-y divide-slate-200 dark:divide-slate-800 shadow-sm bg-white dark:bg-slate-900 transition-colors">
                {course.modules.map((mod, i) => {
                  const isOpen = !!openModules[mod.id];
                  const modDurationMins = mod.lessons.reduce((acc, l) => acc + (l.durationMinutes || 10), 0);
                  const cleanModTitle = mod.title.replace(/^Módulo\s*\d+\s*:\s*/i, "");

                  return (
                    <div key={mod.id} className="bg-white dark:bg-slate-900">
                      <button
                        onClick={() => toggleModule(mod.id)}
                        className="w-full bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between p-4 sm:p-5 font-bold text-gray-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 dark:text-slate-400 transform transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
                          />
                          <span className="truncate">
                            Módulo {i + 1}: <AutoTranslate text={cleanModTitle} as="span" />
                          </span>
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-normal shrink-0 ml-2">
                          {mod.lessons.length} {mod.lessons.length === 1 ? "clase" : "clases"} • {modDurationMins} min
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-5 sm:px-6 py-3 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/60">
                          {mod.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">{mod.description}</p>
                          )}
                          {mod.lessons.length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">
                              {t("CourseDetail.no_lessons")}
                            </p>
                          ) : (
                            mod.lessons.map((lesson, lIdx) => (
                              <div
                                key={lesson.id}
                                className="py-3 flex items-center justify-between text-gray-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <PlayCircle className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                                  <span className="text-xs sm:text-sm truncate">
                                    {lIdx + 1}. <AutoTranslate text={lesson.title} as="span" />
                                  </span>
                                </div>
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono shrink-0 ml-3">
                                  {lesson.durationMinutes || 10} min
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Descripción Detallada */}
          {course.cleanDescription && (
            <div className="mb-10 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm transition-colors overflow-hidden">
              <h2 className="text-xl sm:text-2xl font-black mb-4 text-gray-900 dark:text-white flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <span>{t("CourseDetail.course_description")}</span>
              </h2>
              <div className="text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line text-sm sm:text-base break-words [overflow-wrap:anywhere] max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                <AutoTranslate text={course.cleanDescription} />
              </div>
            </div>
          )}

          {/* Coach Bio */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 bg-white dark:bg-slate-900 shadow-sm transition-colors overflow-hidden">
            <h2 className="text-xl font-black mb-5 text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <span>{t("CourseDetail.instructor_title")}</span>
            </h2>
            <div className="flex items-start gap-4">
              {course.coachAvatar ? (
                <img
                  src={course.coachAvatar}
                  alt={translatedCoachName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400/80 shrink-0 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-2xl flex items-center justify-center shrink-0">
                  {translatedCoachName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-lg text-gray-900 dark:text-white break-words [overflow-wrap:anywhere]">{translatedCoachName}</h3>
                {course.coachHeadline && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 break-words [overflow-wrap:anywhere]">
                    <AutoTranslate text={course.coachHeadline} fallback={translatedCoachHeadline ?? ""} />
                  </p>
                )}
                <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed break-words [overflow-wrap:anywhere] max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {t("CourseDetail.coach_bio_default")}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Side (Floating Card) */}
        <motion.div
          variants={itemVariants}
          className="lg:absolute lg:top-[-320px] lg:right-8 lg:w-[360px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-20 transition-colors"
        >
          {/* Cover / Video Preview */}
          <div
            onClick={() => embedUrl && setIsVideoModalOpen(true)}
            className={`relative pt-[56.25%] bg-black overflow-hidden ${embedUrl ? "cursor-pointer group" : ""}`}
          >
            <img
              src={
                course.thumbnailUrl ||
                "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop"
              }
              className={`absolute inset-0 w-full h-full object-cover opacity-90 ${embedUrl ? "group-hover:scale-105 transition-transform duration-500" : ""}`}
              alt={translatedTitle}
            />
            {embedUrl && (
              <>
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="w-16 h-16 bg-white/25 backdrop-blur-md rounded-full flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-white/40 transition-all shadow-xl">
                    <Play className="w-7 h-7 fill-white ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-3 left-0 w-full text-center font-black text-white text-xs tracking-wider uppercase drop-shadow">
                  {t("CourseDetail.preview_cta")}
                </div>
              </>
            )}
          </div>

          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-end gap-2.5">
              <span className="text-3xl font-black text-gray-900 dark:text-white">${course.price.toFixed(2)} USD</span>
              {course.originalPrice > course.price && (
                <span className="text-base text-gray-400 dark:text-slate-500 line-through mb-1">
                  ${course.originalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {embedUrl && (
              <button
                onClick={() => setIsVideoModalOpen(true)}
                className="w-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer shadow-xs"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{t("CourseDetail.preview_cta")}</span>
              </button>
            )}

            {course.isEnrolled ? (
              <div className="space-y-3">
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200 font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{t("CourseDetail.already_enrolled", "Ya cuentas con acceso completo a este curso")}</span>
                </div>
                <Link
                  href={`/classroom/${course.id}`}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base py-3.5 rounded-xl text-center transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-5 h-5" />
                  <span>{t("CourseDetail.go_to_classroom", "Ir al Aula Virtual")}</span>
                </Link>
              </div>
            ) : !isCoach ? (
              <>
                <AddToCartButton
                  courseId={course.id}
                  courseTitle={translatedTitle}
                  price={course.price}
                  author={translatedCoachName}
                  thumbnailUrl={course.thumbnailUrl}
                  variant="full"
                  className="w-full py-3.5 text-sm"
                />

            <Link
              href={`/checkout?courseId=${course.id}&direct=true`}
              onClick={handleBuyNow}
              className="w-full bg-cfh-dark-green text-white font-bold text-base py-3.5 rounded-xl hover:bg-cfh-text text-center transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              {t("CourseDetail.buy_now")}
            </Link>

            <div className="flex items-center justify-center gap-1.5 text-center text-xs text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-xl py-2 px-3">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{t("CourseDetail.no_refund_notice", "Acceso digital inmediato • Compra final sin reembolso")}</span>
            </div>

              </>
            ) : null}

            <div className="mt-2 text-xs sm:text-sm text-gray-700 dark:text-slate-300 flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="font-bold text-gray-900 dark:text-white">{t("CourseDetail.includes", "Este curso incluye:")}</p>
              <p className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{durationText} {t("CourseDetail.on_demand_video", "de video bajo demanda")}</span>
              </p>
              <p className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{totalLessons} {t("CourseDetail.structured_lessons", "clases estructuradas")}</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{t("CourseDetail.lifetime_access")}</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{t("CourseDetail.certificate")}</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Video Modal Overlay */}
      <AnimatePresence>
        {isVideoModalOpen && embedUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsVideoModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden w-full max-w-4xl shadow-2xl relative text-white"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-900/90 text-white">
                <h3 className="font-bold text-sm sm:text-base truncate pr-4 flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400 fill-current" />
                  <span>{t("CourseDetail.preview", "Vista Previa:")} {translatedTitle}</span>
                </h3>
                <button
                  onClick={() => setIsVideoModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video Player */}
              <div className="relative pt-[56.25%] bg-black">
                {embedUrl.startsWith("http") && (embedUrl.includes("youtube.com") || embedUrl.includes("vimeo.com")) ? (
                  <iframe
                    src={embedUrl}
                    title={`Preview ${course.title}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full border-0"
                  />
                ) : (
                  <video
                    src={embedUrl}
                    controls
                    autoPlay
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

