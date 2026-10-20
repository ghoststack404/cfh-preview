"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  BookOpen,
  ArrowRight,
  GraduationCap,
  CheckCircle,
  Video,
  Clock,
  Star,
  Sparkles,
  Compass,
  User,
  X,
  Loader2
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/components/TranslationProvider";
import { translateCoachName, translateCourseTitle } from "@/lib/i18n-helpers";
import { getStudentBookings, submitBookingReview } from "@/app/actions/bookings";
import { submitCourseReview } from "@/app/actions/courseReviews";
import { getSuspensionInfo } from "@/app/actions/community";
import FullScreenSuspensionScreen from "@/components/FullScreenSuspensionScreen";
import type { SuspensionDetails } from "@/lib/communityStrikes";

export default function StudentDashboard() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { data: session, status } = useSession();
  const userName = session?.user?.name || "Aprendiz";
  const userAvatar = session?.user?.image;
  const [realBookings, setRealBookings] = useState<any[]>([]);
  const [pastBookings, setPastBookings] = useState<any[]>([]);
  const [bookingTab, setBookingTab] = useState<"upcoming" | "past">("upcoming");
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [realCourses, setRealCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [suspensionDetails, setSuspensionDetails] = useState<SuspensionDetails | null>(null);
  const searchParams = useSearchParams();
  const [showHeldBanner, setShowHeldBanner] = useState(false);

  useEffect(() => {
    if (searchParams?.get("booking_held") === "1" || searchParams?.get("paid") === "1") {
      setShowHeldBanner(true);
    }
  }, [searchParams]);

  // Guard de hidratación: evita errores de SSR con useSession / useTranslation
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Review modal state
  const [reviewModalBooking, setReviewModalBooking] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewHoverRating, setReviewHoverRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);
  // Course Review modal state
  const [courseReviewModalId, setCourseReviewModalId] = useState<string | null>(null);
  const [courseReviewRating, setCourseReviewRating] = useState<number>(0);
  const [courseReviewHoverRating, setCourseReviewHoverRating] = useState<number>(0);
  const [courseReviewComment, setCourseReviewComment] = useState<string>("");
  const [isSubmittingCourseReview, setIsSubmittingCourseReview] = useState<boolean>(false);
  const [courseReviewSuccessMsg, setCourseReviewSuccessMsg] = useState<string | null>(null);

  const handleOpenCourseReviewModal = (courseId: string) => {
    setCourseReviewModalId(courseId);
    setCourseReviewRating(0);
    setCourseReviewHoverRating(0);
    setCourseReviewComment("");
    setCourseReviewSuccessMsg(null);
  };

  const handleSubmitCourseReview = async () => {
    if (!courseReviewModalId || isSubmittingCourseReview) return;
    setIsSubmittingCourseReview(true);
    try {
      const res = await submitCourseReview(courseReviewModalId, courseReviewRating, courseReviewComment);
      if (res.success) {
        setCourseReviewSuccessMsg("¡Gracias por calificar el curso!");
        setRealCourses((prev) =>
          prev.map((c) =>
            c.course.id === courseReviewModalId
              ? { ...c, course: { ...c.course, review: { rating: courseReviewRating, comment: courseReviewComment } } }
              : c
          )
        );
        setTimeout(() => {
          setCourseReviewModalId(null);
          setCourseReviewSuccessMsg(null);
        }, 2500);
      } else {
        alert(res.error || "Error al calificar");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmittingCourseReview(false);
    }
  };


  // Si el usuario autenticado tiene rol activo COACH, su panel es /coach/dashboard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/?auth=login");
      return;
    }
    const activeRole = typeof document !== "undefined"
      ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
      : null;
    const effectiveRole = activeRole || (session?.user as any)?.role;
    if (status === "authenticated" && effectiveRole === "COACH") {
      router.replace("/coach/dashboard");
    }
  }, [session, status, router]);


  useEffect(() => {
    async function loadData() {
      try {
        const [bookingsRes, coursesRes, suspensionRes] = await Promise.all([
          getStudentBookings().catch(() => ({ success: false, bookings: [], pastBookings: [] })),
          fetch("/api/purchases").then((r) => (r.ok ? r.json() : { purchases: [] })).catch(() => ({ purchases: [] })),
          getSuspensionInfo().catch(() => ({ isSuspended: false })),
        ]);

        if (suspensionRes?.isSuspended) {
          setSuspensionDetails(suspensionRes);
        }

        if (bookingsRes.success) {
          if (bookingsRes.bookings) setRealBookings(bookingsRes.bookings);
          if (bookingsRes.pastBookings) setPastBookings(bookingsRes.pastBookings);
        }
        if (coursesRes.purchases) {
          setRealCourses(coursesRes.purchases);
        }
      } catch (err) {
        console.error("Error al cargar datos del alumno:", err);
      } finally {
        setLoadingBookings(false);
        setLoadingCourses(false);
      }
    }
    loadData();

    // Auto-refresco en segundo plano para sincronizar en tiempo real cuando el coach acepte o ingrese a la sala
    const interval = setInterval(() => {
      getStudentBookings()
        .then((res) => {
          if (res.success) {
            if (res.bookings) setRealBookings(res.bookings);
            if (res.pastBookings) setPastBookings(res.pastBookings);
          }
        })
        .catch(() => {});
    }, 6000);

    const handleFocus = () => {
      getStudentBookings()
        .then((res) => {
          if (res.success) {
            if (res.bookings) setRealBookings(res.bookings);
            if (res.pastBookings) setPastBookings(res.pastBookings);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return realBookings.filter(
      (b) =>
        b.status !== "COMPLETED" &&
        !b.completedAt &&
        b.status !== "CANCELED" &&
        new Date(b.endAt).getTime() > now
    );
  }, [realBookings]);

  const nextSessionInfo = useMemo(() => {
    const now = new Date().getTime();
    // Sesiones CONFIRMADAS o EN PROGRESO activan la cuenta regresiva viva y el acceso a la sala
    const activeUpcoming = upcomingBookings.filter(
      (b) => (b.status === "CONFIRMED" || b.status === "IN_PROGRESS") && new Date(b.endAt).getTime() > now
    );
    if (activeUpcoming.length === 0) return null;
    const closest = activeUpcoming[0];
    const startMs = new Date(closest.startAt).getTime();
    const endMs = new Date(closest.endAt).getTime();
    const diffMs = startMs - now;
    const isInProgress = closest.status === "IN_PROGRESS";
    const isHappeningNow = isInProgress || (diffMs <= 0 && endMs > now);
    const isWithin24Hours = diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;

    const totalMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const hoursUntil = Math.floor(totalMinutes / 60);
    const minutesUntil = totalMinutes % 60;

    return {
      booking: closest,
      isInProgress,
      isHappeningNow,
      isWithin24Hours,
      hoursUntil,
      minutesUntil,
    };
  }, [upcomingBookings]);

  const handleOpenReviewModal = (booking: any) => {
    setReviewModalBooking(booking);
    setReviewRating(0);
    setReviewHoverRating(0);
    setReviewComment("");
    setReviewSuccessMsg(null);
  };

  const handleSubmitReview = async () => {
    if (!reviewModalBooking || isSubmittingReview) return;
    setIsSubmittingReview(true);
    try {
      const res = await submitBookingReview(reviewModalBooking.id, reviewRating, reviewComment);
      if (res.success) {
        setReviewSuccessMsg("¡Gracias por calificar a tu coach!");
        setPastBookings((prev) =>
          prev.map((b) =>
            b.id === reviewModalBooking.id
              ? { ...b, review: { rating: reviewRating, comment: reviewComment } }
              : b
          )
        );
        setTimeout(() => {
          setReviewModalBooking(null);
          setReviewSuccessMsg(null);
        }, 1400);
      } else {
        alert(res.error || "No se pudo registrar la reseña");
      }
    } catch (err) {
      console.error(err);
      alert("Error al enviar la reseña");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  };

  if (suspensionDetails?.isSuspended) {
    return <FullScreenSuspensionScreen details={suspensionDetails} />;
  }

  // SSR guard: no renderizar hasta que el cliente haya hidratado los providers
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cfh-dark-green dark:text-cfh-light-green" />
      </div>
    );
  }

  return (
    <div className="bg-transparent min-h-screen py-10">
      <motion.div 
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="max-w-7xl mx-auto px-4 md:px-8"
      >
        {/* Hero Card Premium del Dashboard de Aprendizaje (Diseño Armónico en Modo Claro y Oscuro) */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 dark:from-[#0b1322] dark:via-[#0e1933] dark:to-[#060c18] border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 md:p-9 shadow-sm dark:shadow-2xl mb-8"
        >
          {/* Luces de ambiente decorativas con desenfoque */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-teal-500/10 dark:bg-teal-500/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Contenido Principal */}
            <div className="flex-1">
              <div className="flex items-center gap-2.5 flex-wrap mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300 text-xs font-black tracking-wide uppercase shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />{t("StudentDashboard.learning_panel", "Panel de Aprendizaje")}</span>
                <span className="text-xs text-slate-400 hidden sm:inline">•</span>
                <span className="text-xs text-slate-500 dark:text-slate-300/80 font-semibold hidden sm:inline">Coaching From Home</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 flex-wrap">
                <span>{t("StudentDashboard.hello", { name: "{name}" }, "¡Hola, {name}!").split("{name}")[0]} <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400">{userName}</span>{t("StudentDashboard.hello", { name: "{name}" }, "¡Hola, {name}!").split("{name}")[1]}</span>
                <motion.span
                  className="inline-block origin-[70%_70%] select-none cursor-default text-2xl sm:text-3xl lg:text-4xl"
                  animate={{
                    rotate: [0, 16, -10, 16, -6, 12, 0],
                    scale: [1, 1.15, 1, 1.12, 1, 1.05, 1],
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    repeatDelay: 2,
                    ease: "easeInOut",
                  }}
                  role="img"
                  aria-label="saludo"
                >
                  👋
                </motion.span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300/90 mt-2 max-w-2xl leading-relaxed font-medium">
                {t('StudentDashboard.subtitle', "Gestiona tus sesiones en vivo y continúa con tus cursos comprados.")}
              </p>

              {/* Botones de acción rápida */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mt-5">
                <Link
                  href="/coaches"
                  className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-cfh-dark-green hover:bg-[#061528] text-white dark:bg-gradient-to-r dark:from-emerald-500 dark:to-teal-500 dark:hover:from-emerald-400 dark:hover:to-teal-400 dark:text-slate-950 font-black text-xs sm:text-sm transition-all shadow-md shadow-emerald-700/20 hover:scale-105 cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>{t("StudentDashboard.explore_coaches", "Explorar Coaches")}</span>
                </Link>
                <Link
                  href="/cursos"
                  className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300/80 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white dark:border-white/10 font-bold text-xs sm:text-sm transition-all hover:scale-105 cursor-pointer shadow-xs backdrop-blur-md"
                >
                  <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("StudentDashboard.course_catalog", "Catálogo de Cursos")}</span>
                </Link>
                <a
                  href="#agenda"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 dark:hover:text-white dark:border-white/5 font-bold text-xs sm:text-sm transition-all cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>{t("StudentDashboard.view_agenda", "Ver Mi Agenda")}</span>
                </a>
              </div>
            </div>

            {/* Avatar / Tarjeta de Perfil en la esquina */}
            <div className="hidden lg:flex flex-col items-center justify-center p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shrink-0 text-center min-w-[170px] shadow-xs">
              <div className="relative mb-2">
                <img
                  src={
                    userAvatar && !userAvatar.startsWith("/avatars/")
                      ? userAvatar
                      : `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(userName || "Student")}`
                  }
                  alt={userName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/80 dark:border-emerald-400/80 shadow-md ring-4 ring-emerald-500/10"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(userName || "Student")}`;
                  }}
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-white rounded-full" />
                </span>
              </div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate max-w-[140px]">{userName}</p>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">{t("StudentDashboard.active_student", "Aprendiz Activo")}</span>
            </div>
          </div>

          {/* Estadísticas de Progreso Integradas en el Hero */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-200/80 dark:border-slate-800">
            {/* KPI 1: {t("StudentDashboard.active_courses", "Cursos Activos")} */}
            <div className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-500/40 dark:hover:border-emerald-500/40 hover:shadow-md transition-all group">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none mb-1">{realCourses.length}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{t("StudentDashboard.active_courses", "Cursos Activos")}</p>
              </div>
            </div>

            {/* KPI 2: Sesiones Próximas */}
            <div className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-teal-500/40 dark:hover:border-teal-500/40 hover:shadow-md transition-all group">
              <div className="w-11 h-11 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none mb-1">{upcomingBookings.length}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{t("StudentDashboard.upcoming_sessions", "Sesiones Próximas")}</p>
              </div>
            </div>

            {/* KPI 3: Sesiones Completadas */}
            <div className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-cyan-500/40 dark:hover:border-cyan-500/40 hover:shadow-md transition-all group">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none mb-1">{pastBookings.length}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{t("StudentDashboard.completed", "Sesiones Completadas")}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Banner Hero: Próxima Sesión con Cuenta Regresiva Viva */}
        {nextSessionInfo && (nextSessionInfo.isHappeningNow || nextSessionInfo.isWithin24Hours) && (
          <motion.div
            variants={itemVariants}
            className={`mb-8 p-5 sm:p-6 rounded-3xl border shadow-md relative overflow-hidden transition-all ${
              nextSessionInfo.isHappeningNow
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-emerald-400 ring-4 ring-emerald-500/20"
                : "bg-gradient-to-r from-cfh-dark-green via-[#0c2f21] to-[#061528] text-white border-emerald-500/40"
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start sm:items-center gap-4">
                <div className="relative shrink-0">
                  <img
                    src={nextSessionInfo.booking.coach?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop"}
                    alt={nextSessionInfo.booking.coach?.name || "Coach"}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-white/80 shadow-md"
                  />
                  {nextSessionInfo.isHappeningNow && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-white"></span>
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                      {nextSessionInfo.isInProgress ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                          ¡En llamada en vivo ahora!
                        </>
                      ) : nextSessionInfo.isHappeningNow ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          ¡Sesión en curso ahora!
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" />
                          Próxima Sesión
                        </>
                      )}
                    </span>
                    <span className="text-xs text-white/80 font-medium">
                      {new Date(nextSessionInfo.booking.startAt).toLocaleDateString(locale.toLowerCase(), {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {nextSessionInfo.isInProgress
                      ? `Estás en llamada con Coach ${nextSessionInfo.booking.coach?.name}`
                      : nextSessionInfo.isHappeningNow
                      ? `Tu sesión con Coach ${nextSessionInfo.booking.coach?.name} está lista`
                      : `Comienza en ${nextSessionInfo.hoursUntil > 0 ? `${nextSessionInfo.hoursUntil}h ` : ""}${nextSessionInfo.minutesUntil}min con ${nextSessionInfo.booking.coach?.name}`}
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5 line-clamp-1">
                    {nextSessionInfo.booking.notes || nextSessionInfo.booking.coach?.headline || "Sesión de 60 min"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
                <Link
                  href={`/sesion/${nextSessionInfo.booking.id}?role=student`}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg cursor-pointer ${
                    nextSessionInfo.isInProgress || nextSessionInfo.isHappeningNow
                      ? "bg-white text-emerald-800 hover:bg-emerald-50 hover:scale-105"
                      : "bg-cfh-light-green text-cfh-dark-green hover:bg-emerald-400 hover:scale-105"
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>{nextSessionInfo.isInProgress ? t("StudentDashboard.join_call", "Unirme a la llamada") : t("StudentDashboard.enter_room", "Entrar a la Sala")}</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Column - Cursos */}
          <div className="flex-1">
            {/* Encabezado Estilizado de {t("StudentDashboard.active_courses", "Cursos Activos")} */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/50 text-cfh-dark-green dark:text-cfh-light-green border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-inner">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-cfh-text dark:text-slate-100">
                      {t("StudentDashboard.active_courses", "Cursos Activos")}
                    </h2>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-cfh-dark-green dark:text-cfh-light-green border border-emerald-200 dark:border-emerald-800/60">
                      {realCourses.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {t("StudentDashboard.access_lessons", "Accede a tus lecciones inscritas y continúa aprendiendo a tu propio ritmo.")}
                  </p>
                </div>
              </div>

              <Link
                href="/cursos"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold text-cfh-dark-green dark:text-cfh-light-green bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 transition-all shrink-0 self-start sm:self-auto group cursor-pointer"
              >
                <span>{t('StudentDashboard.explore_more') || "Explorar catálogo"}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            {loadingCourses ? (
              <div className="py-12 text-center text-sm text-gray-400 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
                {t('StudentDashboard.loading_courses', "Cargando tus cursos...")}
              </div>
            ) : realCourses.length === 0 ? (
              <motion.div
                variants={itemVariants}
                className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 border border-gray-100 dark:border-slate-800 text-center shadow-xs"
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-50 dark:bg-emerald-950/40 text-cfh-dark-green dark:text-cfh-light-green rounded-2xl flex items-center justify-center">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
                  {t('StudentDashboard.no_courses_title', "Aún no estás inscrito en ningún curso")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                  {t('StudentDashboard.no_courses_desc', "Descubre nuestra variedad de cursos prácticos creados por coaches expertos y aprende a tu propio ritmo.")}
                </p>
                <Link
                  href="/cursos"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-cfh-dark-green text-white font-bold text-sm rounded-2xl hover:bg-[#061528] transition-all shadow-md shadow-cfh-dark-green/20"
                >
                  <span>{t('StudentDashboard.explore_courses_btn', "Explorar Cursos")}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {realCourses.map((item: any) => {
                  const course = item.course;
                  if (!course) return null;
                  const translatedCourseTitle = translateCourseTitle(course.id, course.title, t);
                  const translatedCoachName = course.coach?.name ? translateCoachName(course.coach.name, t) : "";
                  return (
                    <motion.div
                      variants={itemVariants}
                      key={item.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-all flex flex-col"
                    >
                      <div className="h-36 relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {course.thumbnailUrl ? (
                          <img src={course.thumbnailUrl} alt={translatedCourseTitle} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cfh-dark-green/20 to-cfh-light-green/20 text-cfh-dark-green dark:text-cfh-light-green">
                            <BookOpen className="w-10 h-10 opacity-60" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                        <div className="absolute bottom-3 left-4 right-4">
                          <span className="text-[11px] font-extrabold text-white/80 uppercase tracking-wider block mb-0.5">
                            {translatedCoachName ? `Coach: ${translatedCoachName}` : "Curso"}
                          </span>
                          <h3 className="text-white font-bold text-sm line-clamp-1">{translatedCourseTitle}</h3>
                        </div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-2">
                            <span>{t('StudentDashboard.status_label', "Estado")}</span>
                            <span className="font-bold text-cfh-dark-green dark:text-cfh-light-green">
                              {item.status === "COMPLETED" ? t('StudentDashboard.completed', "Completado") : t('StudentDashboard.in_progress', "En curso")}
                            </span>
                          </div>

                          {/* Barra de progreso real de lecciones */}
                          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800">
                            <div className="flex justify-between items-center text-[11px] mb-1.5">
                              <span className="text-gray-500 dark:text-slate-400 font-semibold">
                                {item.totalLessons > 0
                                  ? `${item.completedLessons || 0} de ${item.totalLessons} lecciones`
                                  : "Progreso de lecciones"}
                              </span>
                              <span className="font-extrabold text-cfh-dark-green dark:text-emerald-400">
                                {item.percentage ?? 0}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(item.percentage ?? 0, 4)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {item.status === "COMPLETED" && !course.review ? (
                          <div className="mt-4 flex gap-2">
                            <Link
                              href={`/classroom/${course.id}`}
                              className="flex-1 text-center bg-cfh-dark-green text-white font-bold py-2.5 rounded-xl hover:bg-[#061528] transition-colors text-sm shadow-xs"
                            >
                              Repasar
                            </Link>
                            <button
                              onClick={() => handleOpenCourseReviewModal(course.id)}
                              className="flex-1 text-center bg-yellow-400 text-yellow-900 font-bold py-2.5 rounded-xl hover:bg-yellow-500 transition-colors text-sm shadow-xs flex items-center justify-center gap-1.5"
                            >
                              <Star className="w-4 h-4 fill-yellow-900" />
                              Calificar
                            </button>
                          </div>
                        ) : item.status === "COMPLETED" && course.review ? (
                          <div className="mt-4 flex flex-col gap-2">
                            <Link
                              href={`/classroom/${course.id}`}
                              className="w-full text-center border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-bold py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-sm shadow-xs"
                            >
                              Repasar
                            </Link>
                            <div className="w-full bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-2.5 flex items-center justify-between cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-500/20 transition-colors" onClick={() => handleOpenCourseReviewModal(course.id)}>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star key={star} className={`w-3.5 h-3.5 ${star <= course.review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 dark:text-gray-600"}`} />
                                ))}
                              </div>
                              <span className="text-xs font-bold text-yellow-700 dark:text-yellow-500">Mi reseña</span>
                            </div>
                          </div>
                        ) : (
                          <Link
                            href={`/classroom/${course.id}`}
                            className="mt-4 block w-full text-center bg-cfh-dark-green text-white font-bold py-2.5 rounded-xl hover:bg-[#061528] transition-colors text-sm shadow-xs"
                          >
                            {t("StudentDashboard.continue_learning") || "Continuar Aprendiendo"}
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
            
            {/* Estadísticas reales */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("StudentDashboard.active_courses", "Cursos Activos")}
                  </p>
                  <p className="text-2xl font-black text-cfh-text dark:text-slate-100 mt-0.5">{realCourses.length}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('StudentDashboard.stat_scheduled_sessions', "Sesiones Agendadas")}
                  </p>
                  <p className="text-2xl font-black text-cfh-text dark:text-slate-100 mt-0.5">{upcomingBookings.length}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('StudentDashboard.stat_confirmed_sessions', "Sesiones Confirmadas")}
                  </p>
                  <p className="text-2xl font-black text-cfh-text dark:text-slate-100 mt-0.5">
                    {upcomingBookings.filter((b) => b.status === "CONFIRMED").length}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Sidebar - Próximas Sesiones */}
          <motion.div variants={itemVariants} className="w-full lg:w-80 flex flex-col gap-6">
            <div id="agenda" className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm scroll-mt-24">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-cfh-text dark:text-slate-100 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green" />
                  <span>{t('StudentDashboard.schedule_title', "Horarios & Agenda")}</span>
                </h2>
              </div>

              {/* Selector de Pestañas: Próximas vs Historial */}
              <div className="flex bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl mb-4 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBookingTab("upcoming")}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                    bookingTab === "upcoming"
                      ? "bg-white dark:bg-slate-900 text-cfh-dark-green dark:text-cfh-light-green shadow-xs"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                  }`}
                >
                  {t("StudentDashboard.upcoming", "Próximas")} ({upcomingBookings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBookingTab("past")}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                    bookingTab === "past"
                      ? "bg-white dark:bg-slate-900 text-cfh-dark-green dark:text-cfh-light-green shadow-xs"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                  }`}
                >
                  {t("StudentDashboard.history", "Historial")} ({pastBookings.length})
                </button>
              </div>
              
              <div className="flex flex-col gap-4">
                {loadingBookings ? (
                  <div className="py-6 text-center text-xs text-gray-400">
                    {t('StudentDashboard.loading_bookings', "Cargando citas...")}
                  </div>
                ) : bookingTab === "upcoming" ? (
                  /* Pestaña: Próximas Sesiones */
                  upcomingBookings.length > 0 ? (
                    upcomingBookings.map((b) => {
                      const d = new Date(b.startAt);
                      const formattedDate = d.toLocaleDateString(locale.toLowerCase(), {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const isRequested = b.status === "REQUESTED";
                      const isConfirmed = b.status === "CONFIRMED";
                      const isInProgress = b.status === "IN_PROGRESS";
                      const isCanceled = b.status === "CANCELED";
                      const rescheduleLink = `/coaches/${b.coach?.slug || b.coach?.profileId || b.coach?.id}?book=1${b.isFreeIntro ? "&type=free" : "&type=regular"}`;
                      const translatedCoachName = translateCoachName(b.coach?.name || "Coach", t);

                      return (
                        <div key={b.id} className="flex gap-3.5 items-start pb-4 border-b border-gray-100 dark:border-slate-800 last:border-0 last:pb-0">
                          <img
                            src={b.coach?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop"}
                            alt={translatedCoachName}
                            className="w-11 h-11 rounded-full object-cover border-2 border-cfh-light-green shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <h4 className="font-bold text-sm text-cfh-text dark:text-slate-100 truncate">{translatedCoachName}</h4>
                              {isInProgress && (
                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500 text-white shadow-xs shrink-0 flex items-center gap-1 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                  En llamada
                                </span>
                              )}
                              {isRequested && (
                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                                  {t('StudentDashboard.pending_status', "Pendiente")}
                                </span>
                              )}
                              {isConfirmed && (
                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                  {t('StudentDashboard.confirmed_status', "Confirmada")}
                                </span>
                              )}
                              {isCanceled && (
                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shrink-0">
                                  {t('StudentDashboard.rejected_status', "Rechazada")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1 truncate">{b.notes || b.coach?.headline || t("StudentDashboard.session_default_title", "Sesión de 60 min")}</p>
                            <div className="flex items-center gap-1 text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green mb-2">
                              <Clock className="w-3.5 h-3.5" />
                              {formattedDate}
                            </div>

                            {(isConfirmed || isInProgress) && (
                              <Link href={`/sesion/${b.id}?role=student`} className={`inline-block text-xs font-bold text-white px-3 py-1.5 rounded-lg transition-all ${
                                isInProgress ? "bg-emerald-600 hover:bg-emerald-500 animate-pulse shadow-md" : "bg-cfh-dark-green hover:bg-cfh-text"
                              }`}>
                                {isInProgress ? t("StudentDashboard.join_call", "Unirme a la llamada") : (t('StudentDashboard.join_room') || "Entrar a Sala")}
                              </Link>
                            )}

                            {isRequested && (
                              <span className="inline-block text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-800/60">
                                {t('StudentDashboard.waiting_confirmation', "Esperando confirmación")}
                              </span>
                            )}

                            {isCanceled && (
                              <Link
                                href={rescheduleLink}
                                className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <span>{t('StudentDashboard.reschedule', "Reagendar a otra hora")}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 px-4 text-center bg-gray-50/70 dark:bg-slate-800/60 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                        {t('StudentDashboard.no_sessions_desc', "No tienes sesiones agendadas por el momento.")}
                      </p>
                      <Link href="/coaches" className="text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green hover:underline">
                        {t('StudentDashboard.explore_coaches_cta', "Explorar Coaches y agendar una clase →")}
                      </Link>
                    </div>
                  )
                ) : (
                  /* Pestaña: Historial de Sesiones Pasadas */
                  pastBookings.length > 0 ? (
                    pastBookings.map((b) => {
                      const d = new Date(b.startAt);
                      const formattedDate = d.toLocaleDateString(locale.toLowerCase(), {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      });
                      const translatedCoachName = translateCoachName(b.coach?.name || "Coach", t);

                      return (
                        <div key={b.id} className="flex gap-3.5 items-start pb-4 border-b border-gray-100 dark:border-slate-800 last:border-0 last:pb-0">
                          <img
                            src={b.coach?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop"}
                            alt={translatedCoachName}
                            className="w-11 h-11 rounded-full object-cover border border-gray-200 dark:border-slate-700 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <h4 className="font-bold text-sm text-cfh-text dark:text-slate-100 truncate">{translatedCoachName}</h4>
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
                                Completada
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mb-2 truncate">
                              {formattedDate} · {b.isFreeIntro ? "Prueba gratuita" : "Sesión de 60 min"}
                            </p>

                            {/* Reseña o Botón de Calificación */}
                            {b.review ? (
                              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/60 dark:border-amber-800/60">
                                <div className="flex items-center">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`w-3 h-3 ${
                                        star <= b.review.rating
                                          ? "fill-amber-400 text-amber-400"
                                          : "text-gray-300 dark:text-slate-600"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span>{b.review.rating}/5</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenReviewModal(b)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-700 px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
                              >
                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                <span>{t("StudentDashboard.rate_coach", "Calificar al Coach")}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 px-4 text-center bg-gray-50/70 dark:bg-slate-800/60 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Aún no tienes sesiones pasadas en tu historial.
                      </p>
                    </div>
                  )
                )}
              </div>

              <Link href="/coaches" className="block w-full text-center mt-6 text-sm font-bold text-cfh-dark-green dark:text-cfh-light-green border border-cfh-dark-green dark:border-cfh-light-green py-2 rounded-xl hover:bg-cfh-dark-green hover:text-white transition-colors">
                {t('StudentDashboard.book_new')}
              </Link>
            </div>
          </motion.div>

        </div>
      </motion.div>

      
      {/* Modal Interactivo de Calificación de CURSO */}
      <AnimatePresence>
        {courseReviewModalId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative"
            >
              <button
                onClick={() => setCourseReviewModalId(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white bg-gray-100/50 dark:bg-slate-800/50 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8 pb-6 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-500/20 rounded-full flex items-center justify-center mb-5 border-4 border-white dark:border-slate-900 shadow-md">
                  <Star className="w-10 h-10 text-yellow-500 fill-yellow-500" />
                </div>
                
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                  Califica este Curso
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-8 max-w-[260px]">
                  Tu opinión ayuda a otros aprendices y nos permite mejorar.
                </p>

                {courseReviewSuccessMsg ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center justify-center py-4"
                  >
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1">{courseReviewSuccessMsg}</h4>
                  </motion.div>
                ) : (
                  <div className="w-full">
                    {/* Stars interact */}
                    <div className="flex justify-center gap-2 mb-6" onMouseLeave={() => setCourseReviewHoverRating(0)}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const currentRating = courseReviewHoverRating || courseReviewRating;
                        return (
                          <button
                            key={star}
                            className="transition-transform hover:scale-110 focus:outline-none"
                            onMouseEnter={() => setCourseReviewHoverRating(star)}
                            onClick={() => setCourseReviewRating(star)}
                          >
                            <Star
                              className={`w-10 h-10 transition-colors ${
                                star <= currentRating
                                  ? "text-yellow-400 fill-yellow-400 drop-shadow-sm"
                                  : "text-gray-200 dark:text-slate-700"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="h-6 mb-6">
                      <p className="text-sm font-bold text-cfh-dark-green dark:text-cfh-light-green transition-opacity">
                        {(courseReviewHoverRating || courseReviewRating) === 0 && (
                          <span className="text-gray-400 font-normal">Selecciona una calificación</span>
                        )}
                        {(courseReviewHoverRating || courseReviewRating) === 5 && "¡Excelente curso! (5/5)"}
                        {(courseReviewHoverRating || courseReviewRating) === 4 && "Muy buen curso (4/5)"}
                        {(courseReviewHoverRating || courseReviewRating) === 3 && "Buen curso (3/5)"}
                        {(courseReviewHoverRating || courseReviewRating) === 2 && "Pudo ser mejor (2/5)"}
                        {(courseReviewHoverRating || courseReviewRating) === 1 && "No cumplió mis expectativas (1/5)"}
                      </p>
                    </div>

                    <div className="mb-6 text-left">
                      <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2 pl-1">
                        Comentario (Opcional)
                      </label>
                      <textarea
                        className="w-full border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 text-sm outline-none focus:border-cfh-dark-green dark:focus:border-cfh-light-green transition-all resize-none dark:text-white placeholder:text-gray-400"
                        rows={3}
                        placeholder="¿Qué te pareció el curso? ¿Qué aprendiste?"
                        value={courseReviewComment}
                        onChange={(e) => setCourseReviewComment(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        className="flex-1 py-3.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => setCourseReviewModalId(null)}
                        disabled={isSubmittingCourseReview}
                      >
                        Cancelar
                      </button>
                      <button
                        className="flex-[2] bg-cfh-dark-green text-white font-bold py-3.5 rounded-xl hover:bg-[#061528] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-cfh-dark-green/20"
                        onClick={handleSubmitCourseReview}
                        disabled={isSubmittingCourseReview || courseReviewRating === 0}
                      >
                        {isSubmittingCourseReview ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          "Enviar Reseña"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Interactivo de Calificación / Reseña */}
      <AnimatePresence>
        {reviewModalBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border border-gray-100 dark:border-slate-800 relative"
            >
              <button
                type="button"
                onClick={() => setReviewModalBooking(null)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3.5 mb-5">
                <img
                  src={reviewModalBooking.coach?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop"}
                  alt={reviewModalBooking.coach?.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500"
                />
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    Califica tu sesión con {reviewModalBooking.coach?.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Tu opinión ayuda a mejorar la comunidad y apoya al coach.
                  </p>
                </div>
              </div>

              {reviewSuccessMsg ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1">{reviewSuccessMsg}</h4>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Selector de 5 estrellas */}
                  <div className="text-center py-2">
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      ¿Cómo calificarías tu experiencia?
                    </label>
                    <div className="flex items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const currentRating = reviewHoverRating || reviewRating;
                        const isFilled = currentRating >= star && currentRating > 0;
                        return (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setReviewHoverRating(star)}
                            onMouseLeave={() => setReviewHoverRating(0)}
                            onClick={() => setReviewRating(star)}
                            className="p-1 cursor-pointer transition-transform hover:scale-115"
                          >
                            <Star
                              className={`w-8 h-8 transition-colors ${
                                isFilled
                                  ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                                  : "text-gray-300 dark:text-slate-700"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 block mt-1.5">
                      {(reviewHoverRating || reviewRating) === 0 && (
                        <span className="text-gray-400 font-normal">{t("StudentDashboard.tap_stars_to_rate", "Toca las estrellas para calificar")}</span>
                      )}
                      {(reviewHoverRating || reviewRating) === 5 && "¡Excelente experiencia! (5/5)"}
                      {(reviewHoverRating || reviewRating) === 4 && "Muy buena sesión (4/5)"}
                      {(reviewHoverRating || reviewRating) === 3 && "Buena sesión (3/5)"}
                      {(reviewHoverRating || reviewRating) === 2 && "Pudo ser mejor (2/5)"}
                      {(reviewHoverRating || reviewRating) === 1 && "No cumplió expectativas (1/5)"}
                    </span>
                  </div>

                  {/* Comentario opcional */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      Comentario u observaciones (opcional):
                    </label>
                    <textarea
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Escribe lo que más te sirvió de la sesión o recomendaciones para el coach..."
                      className="w-full p-3 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400 dark:placeholder-slate-500"
                    />
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setReviewModalBooking(null)}
                      disabled={isSubmittingReview}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitReview}
                      disabled={isSubmittingReview || reviewRating === 0}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cfh-dark-green text-white hover:bg-[#061528] shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSubmittingReview ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{t("StudentDashboard.saving", "Guardando...")}</span>
                        </>
                      ) : (
                        <span>{t("StudentDashboard.submit_rating", "Enviar calificación")}</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}





