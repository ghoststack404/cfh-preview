"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "@/components/TranslationProvider";
import { getCoachOnboardingStatus } from "@/app/actions/onboarding";
import { getCoachBookings, respondToBooking } from "@/app/actions/bookings";
import {
  Sparkles,
  PenTool,
  Users,
  FolderOpen,
  Bell,
  Lock,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Calendar,
  Clock,
  Video,
  ChevronRight,
  Percent,
  Coins,
  Check,
  X,
  AlertCircle,
  Loader2,
  Pencil
} from "lucide-react";

import { CoachWhiteboardModal } from "@/components/coach/CoachWhiteboardModal";
import { CoachStudentTrackingModal, StudentRecord } from "@/components/coach/CoachStudentTrackingModal";
import { CoachResourcesModal } from "@/components/coach/CoachResourcesModal";
import { CoachAiCopilotModal } from "@/components/coach/CoachAiCopilotModal";
import { CoachRemindersModal } from "@/components/coach/CoachRemindersModal";
import CoachEarningsPanel, { EarningsData } from "@/components/coach/CoachEarningsPanel";
import { getCoachCourses, CoachCourseDTO } from "@/app/actions/courses";
import { getCoachEarnings } from "@/app/actions/dashboard";

export type CoachTier = "BASIC" | "CURSOS_ONLY" | "ELITE" | "GOLD" | "PLATINUM";

interface TierConfig {
  name: string;
  badgeBg: string;
  badgeText: string;
  accent: string;
  border: string;
  commission: string;
  perks: string[];
  tools: {
    whiteboard: boolean;
    tracking: boolean;
    resources: boolean;
    reminders: boolean;
    courseBuilder: boolean;
  };
}

const TIER_CONFIGS: Record<CoachTier, TierConfig> = {
  BASIC: {
    name: "Básico",
    badgeBg: "bg-slate-100 dark:bg-slate-800/80",
    badgeText: "text-slate-700 dark:text-slate-300",
    accent: "text-slate-900 dark:text-slate-100",
    border: "border-slate-200 dark:border-slate-700",
    commission: "23%",
    perks: [
      "Sesiones en vivo de 60 minutos",
      "Chat interno seguro",
      "Calendario y seguimiento",
      "Intro gratuita de 15 minutos"
    ],
    tools: {
      whiteboard: false,
      tracking: false,
      resources: false,
      reminders: false,
      courseBuilder: false
    }
  },
  CURSOS_ONLY: {
    name: "Solo Cursos",
    badgeBg: "bg-teal-50 dark:bg-teal-950/60",
    badgeText: "text-teal-700 dark:text-teal-300",
    accent: "text-teal-600 dark:text-teal-400",
    border: "border-teal-200 dark:border-teal-800/60",
    commission: "25%",
    perks: [
      "Creador de Cursos Ilimitado",
      "Seguimiento a aprendices",
      "Biblioteca de Recursos y PDFs",
      "Chat interno con alumnos"
    ],
    tools: {
      whiteboard: false,
      tracking: true,
      resources: true,
      reminders: false,
      courseBuilder: true
    }
  },
  ELITE: {
    name: "Élite",
    badgeBg: "bg-blue-50 dark:bg-blue-950/60",
    badgeText: "text-blue-700 dark:text-blue-300",
    accent: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800/60",
    commission: "20%",
    perks: [
      "Sesiones en vivo de 60 minutos",
      "Pizarra virtual interactiva",
      "Bloc de Notas y Recordatorios"
    ],
    tools: {
      whiteboard: true,
      tracking: false,
      resources: false,
      reminders: true,
      courseBuilder: false
    }
  },
  GOLD: {
    name: "Gold",
    badgeBg: "bg-amber-50 dark:bg-amber-950/60",
    badgeText: "text-amber-700 dark:text-amber-300",
    accent: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800/60",
    commission: "18%",
    perks: [
      "Sesiones en vivo de 60 minutos",
      "Pizarra virtual interactiva",
      "Seguimiento analítico de aprendices",
      "Biblioteca de Recursos y PDFs",
      "Recordatorios por Correo y Plataforma"
    ],
    tools: {
      whiteboard: true,
      tracking: true,
      resources: true,
      reminders: true,
      courseBuilder: false
    }
  },
  PLATINUM: {
    name: "Platinum",
    badgeBg: "bg-purple-50 dark:bg-purple-950/60",
    badgeText: "text-purple-700 dark:text-purple-300",
    accent: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800/60",
    commission: "15%",
    perks: [
      "Creador de Cursos Completo",
      "Pizarra Interactiva HD",
      "Seguimiento Analítico de Alumnos",
      "Biblioteca de Recursos y PDFs",
      "Recordatorios Prioritarios"
    ],
    tools: {
      whiteboard: true,
      tracking: true,
      resources: true,
      reminders: true,
      courseBuilder: true
    }
  }
};

export default function CoachDashboard() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const locPrefix = locale ? '/' + locale : '';
  const makeHref = (p: string): string => {
    if (!p) return locPrefix || '/';
    if (p === '/') return locPrefix || '/';
    if (locPrefix && (p === locPrefix || p.startsWith(locPrefix + '/'))) return p;
    const match = p.match(/^\/([a-z]{2})(?:\/|$)/);
    if (match) return p;
    return `${locPrefix}${p.startsWith('/') ? p : `/${p}`}`;
  };

  const [tier, setTier] = useState<CoachTier>("GOLD");
  const [profileData, setProfileData] = useState<any>(null);
  const [clientUser, setClientUser] = useState<any>(null);
  const [coachBookings, setCoachBookings] = useState<any[]>([]);
  const [courses, setCourses] = useState<CoachCourseDTO[]>([]);
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const activeCoachBookings = useMemo(() => {
    const now = Date.now();
    return coachBookings.filter(
      (s) =>
        s.status !== "COMPLETED" &&
        !s.completedAt &&
        s.status !== "CANCELED" &&
        (!s.endAt || new Date(s.endAt).getTime() > now)
    );
  }, [coachBookings]);

  // Authentic students built from actual bookings and deduplicated by student id
  const initialStudents: StudentRecord[] = useMemo(() => {
    const studentMap = new Map<string, StudentRecord>();
    coachBookings.forEach((b) => {
      if (b.student && b.student.id) {
        const sId = b.student.id;
        if (!studentMap.has(sId)) {
          studentMap.set(sId, {
            id: sId,
            name: b.student.name || "Aprendiz",
            avatarSeed: b.student.name || sId,
            avatarUrl: b.student.avatarUrl || null,
            email: null,
            topic: b.notes || (t("CoachDashboard.live_1on1_session") || "Sesión de 60 min en vivo"),
            progress: b.status === "COMPLETED" ? 100 : 50,
            sessionsCompleted: b.status === "COMPLETED" ? 1 : 0,
            totalSessions: 1,
            lastSession: new Date(b.startAt).toLocaleDateString(locale.toLowerCase(), { month: "short", day: "numeric" }),
            status: b.status === "COMPLETED" ? "Excelente" : "Al día",
            privateNotes: "",
          });
        } else {
          const rec = studentMap.get(sId)!;
          rec.totalSessions += 1;
          if (b.status === "COMPLETED") {
            rec.sessionsCompleted += 1;
          }
          rec.progress = Math.min(100, Math.round((rec.sessionsCompleted / rec.totalSessions) * 100));
        }
      }
    });
    return Array.from(studentMap.values());
  }, [coachBookings, locale, t]);

  // Genuine student count from unique booking students + course enrollment counts (no fake multipliers)
  const totalStudents = useMemo(() => {
    const bookingStudentIds = new Set(coachBookings.map((b) => b.student?.id).filter(Boolean));
    const courseEnrollmentTotal = courses.reduce((acc, c) => acc + (c.enrollmentCount || 0), 0);
    return bookingStudentIds.size + courseEnrollmentTotal;
  }, [coachBookings, courses]);

  // Genuine rating: never fallback to fake "5.0"
  const reviewCount = profileData?.profile?.reviewCount ?? 0;
  const rawRating = profileData?.profile?.averageRating ?? 0;
  const ratingDisplay = reviewCount > 0 && rawRating > 0
    ? rawRating.toFixed(1)
    : "Sin valoraciones";

  // Modals state
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);

  // Booking response states
  const [respondingBookingId, setRespondingBookingId] = useState<string | null>(null);
  const [rejectingBooking, setRejectingBooking] = useState<{ id: string; studentName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleRespondBooking = async (bookingId: string, action: "CONFIRM" | "REJECT", reason?: string) => {
    setRespondingBookingId(bookingId);
    try {
      const res = await respondToBooking(bookingId, action, reason);
      if (res.success) {
        setCoachBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: res.status } : b))
        );
        if (action === "REJECT") {
          setRejectingBooking(null);
          setRejectReason("");
        }
      } else {
        alert(res.error || "No se pudo actualizar la cita");
      }
    } catch (err) {
      console.error("Error respondiendo a la reserva:", err);
      alert("Error al procesar la respuesta.");
    } finally {
      setRespondingBookingId(null);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        const u = data.user || data.data?.user;
        if (u) setClientUser(u);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      const newUrl = e.detail;
      setProfileData((prev: any) => (prev ? { ...prev, coachPhotoUrl: newUrl, profile: prev.profile ? { ...prev.profile, photoUrl: newUrl } : prev.profile } : prev));
      setClientUser((prev: any) => (prev ? { ...prev, coachPhotoUrl: newUrl } : prev));
    };
    window.addEventListener("cfh:coach-avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("cfh:coach-avatar-updated", handleAvatarUpdate);
  }, []);

  useEffect(() => {
    async function checkStatus() {
      try {
        const [status, bookingsRes, coursesRes, earningsRes] = await Promise.all([
          getCoachOnboardingStatus(),
          getCoachBookings().catch(() => ({ success: false, bookings: [] })),
          getCoachCourses().catch(() => ({ success: false, courses: [] })),
          getCoachEarnings("30d").catch(() => null),
        ]);

        if (status.authenticated) {
          if (status.activeRole === "STUDENT") {
            router.replace(makeHref("/dashboard"));
            return;
          }
          if (!status.hasProfile) {
            router.push(makeHref("/coach/onboarding"));
            return;
          }
          setProfileData(status);
          if (status.profile?.currentTier) {
            const rawTier = String(status.profile.currentTier).toUpperCase();
            if (["BASIC", "CURSOS_ONLY", "ELITE", "GOLD", "PLATINUM"].includes(rawTier)) {
              setTier(rawTier as CoachTier);
            }
          }
          setClientUser({
            name: status.userName || "Coach",
            role: "COACH",
          });
        } else {
          router.replace(makeHref("/?auth=login"));
          return;
        }

        if (bookingsRes.success && bookingsRes.bookings) {
          setCoachBookings(bookingsRes.bookings);
        }

        if (coursesRes && coursesRes.success && coursesRes.courses) {
          setCourses(coursesRes.courses);
        }

        if (earningsRes && earningsRes.success) {
          setEarningsData(earningsRes as any);
        }
      } catch (err) {
        console.error("Error verificando estado de coach:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    checkStatus();

    // Auto-refresco en segundo plano para ver nuevas solicitudes y llamadas en tiempo real
    const interval = setInterval(() => {
      getCoachBookings().then((res) => {
        if (res.success && res.bookings) {
          setCoachBookings(res.bookings);
        }
      }).catch(() => {});
    }, 6000);

    const handleFocus = () => {
      getCoachBookings().then((res) => {
        if (res.success && res.bookings) {
          setCoachBookings(res.bookings);
        }
      }).catch(() => {});
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [router]);

  const getTierName = (tVal: CoachTier): string => {
    switch (tVal) {
      case "BASIC": return t("CoachDashboard.tier_basic", "Básico");
      case "CURSOS_ONLY": return t("CoachDashboard.tier_cursos_only", "Solo Cursos");
      case "ELITE": return t("CoachDashboard.tier_elite", "Élite");
      case "GOLD": return t("CoachDashboard.tier_gold", "Gold");
      case "PLATINUM": return t("CoachDashboard.tier_platinum", "Platinum");
      default: return tVal;
    }
  };

  const getTierPerks = (tVal: CoachTier): string[] => {
    switch (tVal) {
      case "BASIC":
        return [
          t("CoachDashboard.perk_live_sessions", "Sesiones en vivo de 60 minutos"),
          t("CoachDashboard.perk_secure_chat", "Chat seguro y protegido"),
          t("CoachDashboard.perk_certifications", "Certificaciones Profesionales"),
          t("CoachDashboard.perk_free_intro_15m", "Intro gratuita de 15 minutos"),
        ];
      case "CURSOS_ONLY":
        return [
          t("CoachDashboard.perk_course_creator_full", "Creador de Cursos Completo"),
          t("CoachDashboard.perk_unlimited_courses", "Publicación de cursos ilimitados"),
          t("CoachDashboard.perk_automated_payouts", "Cobros automatizados con Stripe"),
          t("CoachDashboard.perk_digital_students", "Gestión de alumnos inscritos a cursos"),
        ];
      case "ELITE":
        return [
          t("CoachDashboard.perk_live_sessions", "Sesiones en vivo de 60 minutos"),
          t("CoachDashboard.perk_interactive_whiteboard", "Pizarra Interactiva en Vivo"),
          t("CoachDashboard.perk_email_reminders", "Bloc de Notas y Recordatorios por Correo"),
        ];
      case "GOLD":
        return [
          t("CoachDashboard.perk_live_sessions", "Sesiones en vivo de 60 minutos"),
          t("CoachDashboard.perk_whiteboard", "Pizarra Interactiva"),
          t("CoachDashboard.perk_student_tracking", "Seguimiento Analítico de Alumnos"),
          t("CoachDashboard.perk_resources_library", "Biblioteca de Recursos y PDFs"),
          t("CoachDashboard.perk_email_platform_reminders", "Recordatorios Correo + Plataforma"),
        ];
      case "PLATINUM":
        return [
          t("CoachDashboard.perk_course_creator_full", "Creador de Cursos Completo"),
          t("CoachDashboard.perk_whiteboard_hd", "Pizarra Interactiva HD"),
          t("CoachDashboard.perk_student_tracking", "Seguimiento Analítico de Alumnos"),
          t("CoachDashboard.perk_resources_library", "Biblioteca de Recursos y PDFs"),
          t("CoachDashboard.perk_priority_reminders", "Recordatorios Prioritarios"),
        ];
    }
  };

  const config = TIER_CONFIGS[tier];
  const localizedTierName = getTierName(tier);
  const localizedPerks = getTierPerks(tier);
  const coachName = profileData?.userName || clientUser?.name || "Coach";
  const coachPhoto = profileData?.coachPhotoUrl || profileData?.profile?.photoUrl || clientUser?.coachPhotoUrl || null;
  const coachHeadline = profileData?.profile?.headline || "Coach Profesional en Coaching From Home";
  const liveSession = coachBookings.find((b) => b.status === "IN_PROGRESS");
  const upcomingConfirmed = coachBookings.find((b) => b.status === "CONFIRMED");
  const targetBooking = liveSession || upcomingConfirmed || coachBookings[0];
  const activeSessionUrl = targetBooking
    ? makeHref(`/sesion/${targetBooking.id}?role=coach&tier=${tier}`)
    : makeHref(`/sesion/demo?role=coach&tier=${tier}`);


  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Stripe Connect Callout Banner */}
      {profileData?.profile && !profileData.profile.stripeChargesEnabled && (
        <div className="p-5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-xl shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {t('CoachDashboard.stripe_alert_title', 'Configuración de cobros pendiente (Stripe Connect)')}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {t('CoachDashboard.stripe_alert_desc', 'Para recibir automáticamente los pagos de tus sesiones de 60 min y cursos en tu cuenta bancaria, vincula tu cuenta Stripe Connect.')}
              </p>
            </div>
          </div>
          <Link href={makeHref("/coach/billing")} className="shrink-0">
            <button className="px-4 py-2.5 bg-cfh-dark-green hover:bg-[#061528] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer">
              <span>{t("CoachDashboard.connect_stripe", "Conectar Stripe")}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      )}

      {/* Dev Toggle (Simulate Plan) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span>{t("CoachDashboard.simulate_tier", "Simular Nivel de Coach (Demo QA):")}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
          {(["BASIC", "CURSOS_ONLY", "ELITE", "GOLD", "PLATINUM"] as CoachTier[]).map((tVal) => (
            <button
              key={tVal}
              onClick={() => setTier(tVal)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tier === tVal
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-850"
              }`}
            >
              {getTierName(tVal)}
            </button>
          ))}
        </div>
      </div>

      {/* Banner de Sesión en Vivo / En Llamada Activa */}
      {liveSession && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 rounded-3xl shadow-xl border-2 border-emerald-400/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <Video className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white text-emerald-800 tracking-wider shadow-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  {t("CoachDashboard.in_call_live", "¡Llamada en Vivo Activa!")}
                </span>
                <span className="text-xs text-emerald-100 font-medium hidden sm:inline">
                  {t("CoachDashboard.student_waiting_hint", "El alumno ya se unió a la sala privada")}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {liveSession.student?.name || t("CoachDashboard.student_alt", "Tu alumno")} {t("CoachDashboard.is_in_call_now", "está en la sala esperándote.")}
              </h3>
            </div>
          </div>
          <Link href={`/sesion/${liveSession.id}?role=coach&tier=${tier}`} className="shrink-0 w-full sm:w-auto">
            <button className="w-full sm:w-auto px-6 py-3 bg-white text-emerald-800 hover:bg-emerald-50 rounded-2xl text-xs sm:text-sm font-black shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2 cursor-pointer">
              <Video className="w-4 h-4 text-emerald-700" />
              <span>{t("CoachDashboard.join_call_now", "Unirme a la llamada ahora")}</span>
            </button>
          </Link>
        </div>
      )}

      {/* Header Profile */}
      <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-slate-50/50 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/40 dark:shadow-black/20 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Glows ambientales sutiles */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-teal-500/10 dark:bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-5 relative z-10">
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-md ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
            <img
              src={
                coachPhoto && !coachPhoto.startsWith("/avatars/")
                  ? coachPhoto
                  : `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(coachName || "Coach")}&backgroundColor=04101e&textColor=ffffff`
              }
              alt="Coach Profile"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(coachName || "Coach")}&backgroundColor=04101e&textColor=ffffff`;
              }}
            />
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-sm flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {t("CoachDashboard.greeting_prefix") || "¡Hola,"} {coachName}!
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-xs border ${config.badgeBg} ${config.badgeText} ${config.border}`}>
                {t("CoachDashboard.plan") || "Plan"} {localizedTierName}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl line-clamp-1">{coachHeadline || "Sin titular definido"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-xs font-semibold shadow-2xs">
                <Percent className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t("CoachDashboard.commission") || "Comisión:"} <strong className="font-extrabold text-emerald-900 dark:text-emerald-200">{config.commission}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 w-full lg:w-auto">
          <Link href={makeHref("/coach/availability")} className="flex-1 sm:flex-initial">
            <button className="w-full px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t("CoachDashboard.my_schedule") || "Mis Horarios"}</span>
            </button>
          </Link>
          <Link href={makeHref("/coach/profile")} className="flex-1 sm:flex-initial">
            <button className="w-full px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>{t("Header.my_profile") || "Mi Perfil"}</span>
            </button>
          </Link>
          <Link href={makeHref("/coach/onboarding?edit=true")} className="flex-1 sm:flex-initial">
            <button className="w-full px-4 py-2.5 rounded-xl text-xs font-bold border border-emerald-300/80 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <Pencil className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t("CoachDashboard.edit_coach_data", "Editar Datos de Coach")}</span>
            </button>
          </Link>
          <Link href={activeSessionUrl} className="w-full sm:w-auto flex-shrink-0">
            <button className={`w-full px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer ${
              liveSession
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/40 ring-4 ring-emerald-400/30 animate-pulse"
                : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/20 hover:shadow-lg hover:shadow-emerald-900/30"
            }`}>
              <Video className="w-4 h-4" />
              <span>
                {liveSession
                  ? (t("CoachDashboard.join_active_call", "¡En llamada ahora!"))
                  : (t("CoachDashboard.go_to_session_room") || "Ir a Sala de Sesión")}
              </span>
            </button>
          </Link>
        </div>
      </div>

      {/* Toolbox & Tier Specific Capabilities */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Suite de Herramientas</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t("CoachDashboard.membership_tools") || "Herramientas de tu Membresía Coach"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t("CoachDashboard.available_per_plan") || "Disponibles acorde a tu plan activo"} <span className="font-bold text-slate-700 dark:text-slate-200">({localizedTierName})</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Interactive Whiteboard */}
          <div className={`relative group rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden border ${
            config.tools.whiteboard
              ? "bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-950/15 hover:-translate-y-1"
              : "bg-slate-50/70 dark:bg-slate-900/40 backdrop-blur-xs border-slate-200/50 dark:border-slate-800/50 opacity-75 hover:opacity-90"
          }`}>
            {config.tools.whiteboard && (
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all duration-500 pointer-events-none" />
            )}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-2xs">
                  <PenTool className="w-5 h-5" />
                </div>
                {config.tools.whiteboard ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-[11px] font-extrabold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t("CoachDashboard.active_badge") || "Activo"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                    <Lock className="w-3 h-3" /> {t("CoachDashboard.requires_tier", "Requiere")} {getTierName("ELITE")}+
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {t("CoachDashboard.whiteboard_title") || "Pizarra Interactiva HD"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t("CoachDashboard.whiteboard_desc") || "Lienzo en tiempo real para diagramar ideas, trazar bocetos y descargar notas visuales con tus alumnos."}
              </p>
            </div>
            <button
              onClick={() => {
                if (config.tools.whiteboard) setIsWhiteboardOpen(true);
              }}
              disabled={!config.tools.whiteboard}
              className={`mt-5 w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all duration-200 flex items-center justify-center gap-2 ${
                config.tools.whiteboard
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/20 hover:shadow-lg hover:shadow-emerald-900/30 hover:-translate-y-0.5 cursor-pointer"
                  : "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 border border-slate-200/60 dark:border-slate-800/80 cursor-not-allowed"
              }`}
            >
              {config.tools.whiteboard ? (
                <>
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{t("CoachDashboard.whiteboard_btn") || "Abrir Pizarra"}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t("CoachDashboard.locked_in_plan") || "Bloqueado en tu Plan"}</span>
                </>
              )}
            </button>
          </div>

          {/* 2. Student Tracking */}
          <div className={`relative group rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden border ${
            config.tools.tracking
              ? "bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-950/15 hover:-translate-y-1"
              : "bg-slate-50/70 dark:bg-slate-900/40 backdrop-blur-xs border-slate-200/50 dark:border-slate-800/50 opacity-75 hover:opacity-90"
          }`}>
            {config.tools.tracking && (
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all duration-500 pointer-events-none" />
            )}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-2xs">
                  <Users className="w-5 h-5" />
                </div>
                {config.tools.tracking ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-[11px] font-extrabold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t("CoachDashboard.active_badge") || "Activo"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                    <Lock className="w-3 h-3" /> {t("CoachDashboard.requires_tier", "Requiere")} {getTierName("GOLD")}+
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {t("CoachDashboard.tracking_title") || "Seguimiento de Aprendices"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t("CoachDashboard.tracking_desc") || "Bitácora analítica de progreso, notas privadas por alumno, asistencia y evolución entre sesiones."}
              </p>
            </div>
            <button
              onClick={() => {
                if (config.tools.tracking) setIsTrackingOpen(true);
              }}
              disabled={!config.tools.tracking}
              className={`mt-5 w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all duration-200 flex items-center justify-center gap-2 ${
                config.tools.tracking
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/20 hover:shadow-lg hover:shadow-emerald-900/30 hover:-translate-y-0.5 cursor-pointer"
                  : "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 border border-slate-200/60 dark:border-slate-800/80 cursor-not-allowed"
              }`}
            >
              {config.tools.tracking ? (
                <>
                  <Users className="w-3.5 h-3.5" />
                  <span>{t("CoachDashboard.tracking_btn") || "Ver Progreso Alumnos"}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t("CoachDashboard.locked_in_plan") || "Bloqueado en tu Plan"}</span>
                </>
              )}
            </button>
          </div>

          {/* 3. Materials & PDF Resources */}
          <div className="relative group rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden border bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-950/15 hover:-translate-y-1">
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500 pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-2xs">
                  <FolderOpen className="w-5 h-5" />
                </div>
                {config.tools.resources ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                    {t("CoachDashboard.active_badge") || "Activo"} ({getTierName("GOLD")}+)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> {t("CoachDashboard.requires_tier", "Requiere")} {getTierName("GOLD")}+
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {t("CoachDashboard.resources_title") || "Biblioteca de Recursos y PDFs"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t("CoachDashboard.resources_desc") || "Comparte guías de trabajo, plantillas descargables y documentos exclusivos para tus aprendices."}
              </p>
            </div>
            <button
              onClick={() => {
                if (config.tools.resources) setIsResourcesOpen(true);
                else router.push(makeHref("/coach/plans"));
              }}
              className={`mt-4 w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                config.tools.resources
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {config.tools.resources
                ? (t("CoachDashboard.resources_btn") || "Gestionar Recursos")
                : (t("CoachDashboard.locked_in_plan") || "Bloqueado en tu Plan")}
            </button>
          </div>

          {/* 4. Reminders & In-App Alerts */}
          <div className={`relative group rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden border ${
            config.tools.reminders
              ? "bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-950/15 hover:-translate-y-1"
              : "bg-slate-50/70 dark:bg-slate-900/40 backdrop-blur-xs border-slate-200/50 dark:border-slate-800/50 opacity-75 hover:opacity-90"
          }`}>
            {config.tools.reminders && (
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-500 pointer-events-none" />
            )}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-2xs">
                  <Bell className="w-5 h-5" />
                </div>
                {config.tools.reminders ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-[11px] font-extrabold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t("CoachDashboard.active_badge") || "Activo"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                    <Lock className="w-3 h-3" /> {t("CoachDashboard.requires_tier", "Requiere")} {getTierName("ELITE")}+
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {t("CoachDashboard.reminders_title") || "Recordatorios por Correo y Plataforma"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t("CoachDashboard.reminders_desc") || "Avisos automáticos 24h y 1h antes para tus aprendices. Comunicación 100% oficial y privada."}
              </p>
            </div>
            <button
              onClick={() => {
                if (config.tools.reminders) setIsRemindersOpen(true);
              }}
              disabled={!config.tools.reminders}
              className={`mt-5 w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all duration-200 flex items-center justify-center gap-2 ${
                config.tools.reminders
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/20 hover:shadow-lg hover:shadow-emerald-900/30 hover:-translate-y-0.5 cursor-pointer"
                  : "bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 border border-slate-200/60 dark:border-slate-800/80 cursor-not-allowed"
              }`}
            >
              {config.tools.reminders ? (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>{t("CoachDashboard.reminders_btn") || "Configurar Recordatorios"}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t("CoachDashboard.locked_in_plan") || "Bloqueado en tu Plan"}</span>
                </>
              )}
            </button>
          </div>

          {/* 6. Course Builder */}
          <div className={`relative group rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between overflow-hidden border ${
            config.tools.courseBuilder
              ? "bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-950/15 hover:-translate-y-1"
              : "bg-slate-50/70 dark:bg-slate-900/40 backdrop-blur-xs border-slate-200/50 dark:border-slate-800/50 opacity-80 hover:opacity-95"
          }`}>
            {config.tools.courseBuilder && (
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500 pointer-events-none" />
            )}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-2xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                {config.tools.courseBuilder ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-[11px] font-extrabold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t("CoachDashboard.active_badge") || "Activo"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                    <Lock className="w-3 h-3" /> {t("CoachDashboard.locked_in_plan") || "Bloqueado en tu Plan"}
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-1.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {t("CoachDashboard.course_builder") || "Creador de Cursos Online"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {config.tools.courseBuilder
                  ? (t("CoachDashboard.course_builder_desc") || "Publica cursos en video, estructura lecciones y genera ingresos pasivos las 24 horas del día.")
                  : "Tu plan actual está optimizado para sesiones de 60 min en vivo. Actualiza a Cursos Starter o Élite para publicar y vender cursos pregrabados."}
              </p>
            </div>
            {config.tools.courseBuilder ? (
              <Link href={makeHref("/coach/cursos")} className="mt-5 block">
                <button className="w-full py-2.5 px-4 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/20 hover:shadow-lg hover:shadow-emerald-900/30 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{t("CoachDashboard.create_course") || "Ir al Creador de Cursos"}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                </button>
              </Link>
            ) : (
              <Link href={makeHref("/coach/billing")} className="mt-5 block">
                <button className="w-full py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ver Planes para Cursos</span>
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Agenda and Benefits Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
        {/* Left Column (Upcoming Schedule & Stats) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: t("CoachDashboard.classes_today") || "Sesiones Hoy",
                value: coachBookings.filter(b => {
                  const bDate = new Date(b.startAt);
                  const today = new Date();
                  return bDate.getDate() === today.getDate() &&
                         bDate.getMonth() === today.getMonth() &&
                         bDate.getFullYear() === today.getFullYear() &&
                         b.status !== "CANCELED";
                }).length.toString(),
                icon: "video"
              },
              {
                label: t("CoachDashboard.students") || "Aprendices",
                value: totalStudents.toString(),
                icon: "users"
              },
              {
                label: t("CoachDashboard.hours_mentored") || "Horas Impartidas",
                value: (profileData?.profile?.completedSessionCount || 0).toString(),
                icon: "clock"
              },
              {
                label: t("CoachDashboard.rating") || "Calificación",
                value: ratingDisplay,
                icon: "star"
              }
            ].map((stat, i) => {
              const isLongText = String(stat.value).length > 5;
              return (
                <div
                  key={stat.label}
                  className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center text-center group hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all overflow-hidden min-w-0"
                >
                  <div
                    className={`font-black mb-1 max-w-full break-words leading-tight ${
                      isLongText ? "text-xs sm:text-sm py-1" : "text-2xl sm:text-3xl"
                    } ${config.accent}`}
                  >
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider max-w-full truncate">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State: 0 Students */}
          {totalStudents === 0 && (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-7 shadow-xs border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                {t("CoachDashboard.no_students_title", "Aún no tienes aprendices registrados")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4 leading-relaxed">
                {t("CoachDashboard.no_students_desc", "Cuando los alumnos reserven sesiones de 60 min o se inscriban a tus cursos, aparecerán automáticamente en tu bitácora de seguimiento.")}
              </p>
              <button
                onClick={() => {
                  const slug = profileData?.profile?.slug || profileData?.userId || "";
                  const url = typeof window !== "undefined" ? `${window.location.origin}/coaches/${slug}` : `/coaches/${slug}`;
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(url);
                    alert("¡Enlace de tu perfil público copiado al portapapeles!");
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-cfh-dark-green hover:bg-[#061528] text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t("CoachDashboard.share_profile_btn", "Compartir mi perfil público")}</span>
              </button>
            </div>
          )}

          {/* Upcoming Schedule */}
          <div id="agenda" className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800/80 relative overflow-hidden scroll-mt-24">
            <h2 className="text-xl font-bold text-cfh-dark-green dark:text-cfh-light-green mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{t("CoachDashboard.schedule_today") || "Agenda de Sesiones de Hoy"}</span>
            </h2>

            <div className="space-y-4 relative z-10">
              {activeCoachBookings.length > 0 ? (
                activeCoachBookings.map((session, index) => {
                  const startTime = new Date(session.startAt).toLocaleTimeString(locale.toLowerCase(), { hour: '2-digit', minute: '2-digit' });
                  const startDate = new Date(session.startAt).toLocaleDateString(locale.toLowerCase(), { weekday: 'short', day: 'numeric', month: 'short' });
                  const isRequested = session.status === "REQUESTED";
                  const isConfirmed = session.status === "CONFIRMED";
                  const isInProgress = session.status === "IN_PROGRESS";
                  const isCanceled = session.status === "CANCELED";
                  const isResponding = respondingBookingId === session.id;

                  return (
                    <div
                      key={session.id}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                        isInProgress
                          ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-md"
                          : isRequested
                          ? "border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/30 shadow-sm"
                          : isConfirmed
                          ? "border-cfh-dark-green dark:border-cfh-light-green/40 bg-cfh-bg/40 dark:bg-slate-850 shadow-sm"
                          : "border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-20 text-center font-bold text-cfh-dark-green dark:text-cfh-light-green text-xs shrink-0">
                          <div>{startTime}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">{startDate}</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 border-2 border-white dark:border-slate-700 shadow-sm">
                          <img
                            src={session.student?.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${session.student?.name || 'Alumno'}`}
                            alt={session.student?.name || t("CoachDashboard.student_alt", "Alumno")}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{session.student?.name || t("Profile.student_role", "Aprendiz")}</p>
                            {isInProgress && (
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs flex items-center gap-1.5 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                {t("CoachDashboard.in_call_live", "¡En llamada en vivo!")}
                              </span>
                            )}
                            {isRequested && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
                                {t("CoachDashboard.pending_request", "Solicitud Pendiente")}
                              </span>
                            )}
                            {isConfirmed && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {t("CoachDashboard.confirmed_badge", "Confirmada")}
                              </span>
                            )}
                            {isCanceled && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {t("CoachDashboard.rejected_canceled_badge", "Rechazada / Cancelada")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{session.notes || t("CoachDashboard.live_1on1_session", "Sesión de 60 min en vivo")}</p>
                          {isRequested && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">
                              <span>💡</span>
                              <span>Pulsa <strong>Aceptar</strong> para confirmar la cita y habilitar la sala de videollamada.</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botones de acción del Coach */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {isRequested && (
                          <>
                            <button
                              onClick={() => handleRespondBooking(session.id, "CONFIRM")}
                              disabled={isResponding}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                              title={t("CoachDashboard.accept_booking_title", "Aceptar solicitud de sesión")}
                            >
                              {isResponding ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>{t("CoachDashboard.accept_booking", "Aceptar")}</span>
                            </button>
                            <button
                              onClick={() => setRejectingBooking({ id: session.id, studentName: session.student?.name || 'el aprendiz' })}
                              disabled={isResponding}
                              className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                              title={t("CoachDashboard.reject_booking_title", "Rechazar solicitud")}
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>{t("CoachDashboard.reject_booking", "Rechazar")}</span>
                            </button>
                          </>
                        )}

                        {(isConfirmed || isInProgress) && (
                          <Link href={`/sesion/${session.id}?role=coach&tier=${tier}`}>
                            <button className={`px-4 py-2 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5 ${
                              isInProgress
                                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 animate-pulse"
                                : "bg-cfh-dark-green hover:bg-cfh-light-green"
                            }`}>
                              <Video className="w-3.5 h-3.5" />
                              <span>
                                {isInProgress
                                  ? (t("CoachDashboard.join_active_call_btn", "Unirme a la llamada"))
                                  : (t("CoachDashboard.start") || "Iniciar Sala")}
                              </span>
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-850 border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs text-slate-400 dark:text-slate-500">
                    <Calendar className="w-6 h-6 text-cfh-dark-green dark:text-cfh-light-green" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {t("CoachDashboard.no_scheduled_sessions", "No tienes sesiones programadas")}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    {t("CoachDashboard.no_scheduled_sessions_desc", "Las llamadas finalizadas se archivan automáticamente. Cuando un aprendiz agende una nueva clase contigo, aparecerá aquí.")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Courses Section with Empty State */}
          {config.tools.courseBuilder && (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cfh-dark-green dark:text-cfh-light-green flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <span>{t("CoachDashboard.my_courses_title", "Mis Cursos Online")}</span>
                </h3>
                <Link href={makeHref("/coach/cursos")}>
                  <span className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-bold flex items-center gap-1 cursor-pointer">
                    Ver todos <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>

              {courses.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-850 border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs text-slate-400 dark:text-slate-500">
                    <BookOpen className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {t("CoachDashboard.no_courses_title", "Aún no has creado ningún curso")}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                    {t("CoachDashboard.no_courses_desc", "Tu plan incluye el creador de cursos. Publica cursos en video, estructura módulos y genera ingresos pasivos.")}
                  </p>
                  <Link href={makeHref("/coach/courses/new")}>
                    <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{t("CoachDashboard.create_first_course", "Crear mi primer curso")}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {courses.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{c.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {c.enrollmentCount} {t("CoachDashboard.enrolled_students", "alumnos")} • ${(c.priceCents / 100).toFixed(2)} {c.currency}
                        </p>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shrink-0 ${
                        c.status === "PUBLISHED"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}>
                        {c.status === "PUBLISHED" ? "Publicado" : "Borrador"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Active Perks Summary & Upgrade info */}
        <div className="space-y-6">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                {t("CoachDashboard.plan_benefits", { plan: localizedTierName })}
              </h3>
              <span className={`text-[10px] uppercase font-black tracking-widest ${config.badgeText} px-2.5 py-1 rounded-full ${config.badgeBg}`}>
                {t("CoachDashboard.active_level", "Nivel Activo")}
              </span>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              {localizedPerks.map((perk, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>

            {tier !== "PLATINUM" && (
              <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-100 dark:border-purple-900/40">
                <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-bold text-xs mb-1">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>{t("CoachDashboard.want_more_tools", "¿Deseas más herramientas?")}</span>
                </div>
                <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 leading-relaxed mb-3">
                  Pasa al plan Platinum para desbloquear el Creador de Cursos, todas las herramientas profesionales y la menor comisión (15%).
                </p>
                <button
                  onClick={() => setTier("PLATINUM")}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-950/20 cursor-pointer hover:-translate-y-0.5"
                >
                  {t("CoachDashboard.simulate_platinum", "Simular Plan Platinum")}
                </button>
              </div>
            )}
          </div>

          {/* Empty State: 0 Reviews */}
          {reviewCount === 0 && (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-5 shadow-xs border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/60 rounded-xl flex items-center justify-center mx-auto mb-2 text-amber-500 border border-amber-200/60 dark:border-amber-800/60">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                {t("CoachDashboard.no_reviews_title", "Sin valoraciones públicas")}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {t("CoachDashboard.no_reviews_desc", "Cuando tus aprendices completen sus sesiones, calificarán su experiencia y sus opiniones aparecerán aquí.")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 🚀🚀🚀 Sección de Ganancias 🚀🚀🚀 */}
      <div className="mt-8">
        <CoachEarningsPanel
          commissionBps={profileData?.profile?.commissionBps ?? 2300}
          initialData={earningsData}
        />
      </div>

      {/* Interactive Tool Modals */}
      <CoachWhiteboardModal
        isOpen={isWhiteboardOpen}
        onClose={() => setIsWhiteboardOpen(false)}
        tierName={config.name}
      />

      <CoachStudentTrackingModal
        isOpen={isTrackingOpen}
        onClose={() => setIsTrackingOpen(false)}
        tierName={config.name}
        initialStudents={initialStudents}
      />

      <CoachResourcesModal
        isOpen={isResourcesOpen}
        onClose={() => setIsResourcesOpen(false)}
        tierName={config.name}
      />

      <CoachRemindersModal
        isOpen={isRemindersOpen}
        onClose={() => setIsRemindersOpen(false)}
        tier={tier}
      />

      {/* Modal para Rechazar / Negar Solicitud de Cita con Motivo */}
      {rejectingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{t("CoachDashboard.reject_booking_modal_title", "Rechazar Solicitud de Cita")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("CoachDashboard.student_label", { student: rejectingBooking.studentName })}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
              {t("CoachDashboard.reject_booking_info", "El alumno recibirá una notificación inmediata y podrá elegir otro horario disponible con tu perfil.")}
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t("CoachDashboard.reject_reason_label", "Motivo del rechazo (opcional):")}
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("CoachDashboard.reject_reason_placeholder", "Ej: Tengo un compromiso imprevisto a esa hora, por favor selecciona el horario siguiente...")}
                className="w-full text-xs p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-cfh-light-green resize-none h-20"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setRejectingBooking(null);
                  setRejectReason("");
                }}
                disabled={respondingBookingId === rejectingBooking.id}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                {t("CoachDashboard.cancel", "Cancelar")}
              </button>
              <button
                onClick={() => handleRespondBooking(rejectingBooking.id, "REJECT", rejectReason)}
                disabled={respondingBookingId === rejectingBooking.id}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {respondingBookingId === rejectingBooking.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                <span>{t("CoachDashboard.confirm_rejection", "Confirmar Rechazo")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


