import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { locales, defaultLocale } from "@/i18n";
import {
  Users,
  BookOpen,
  DollarSign,
  Calendar,
  Award,
  Star,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  ExternalLink,
  Edit3,
  Video,
  ShieldCheck,
  Layers,
  Globe,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  CreditCard,
  Mail,
  MapPin,
  PlayCircle,
  Briefcase,
} from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CoachEarningsPanel, { EarningsData } from "@/components/coach/CoachEarningsPanel";
import {
  CoachStudentTrackingButton,
  StudentRecord,
} from "@/components/coach/CoachStudentTrackingModal";
import CoachAvatarUploader from "@/components/coach/CoachAvatarUploader";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number, currency: string = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency || "MXN",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

export default async function CoachProfilePage({ params }: { params?: Promise<{ locale?: string }> } = {}) {
  const resolvedParams = params ? await params : undefined;
  const store = await cookies();
  const storedLocale = (store.get("NEXT_LOCALE")?.value || store.get("cfh_language")?.value || "").toLowerCase();
  const locale = resolvedParams?.locale || (locales.includes(storedLocale) ? storedLocale : defaultLocale);

  const t = await getTranslations("CoachProfile");
  const user = await requirePageUser(["COACH"]);

  // 1. Perfil de Coach e información pública
  const coachProfile = await prisma.coachProfile.findUnique({
    where: { userId: user.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          createdAt: true,
          locale: true,
          countryCode: true,
        },
      },
      categories: {
        include: {
          category: true,
        },
      },
      certificates: {
        orderBy: { createdAt: "desc" },
      },
      availabilityRules: {
        where: { isActive: true },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      },
    },
  });

  if (!coachProfile) {
    redirect(`/${locale}/coach/onboarding`);
  }

  // 2. Cursos impartidos por el coach con enrollments y módulos
  const createdCourses = await prisma.course.findMany({
    where: { coachId: user.id },
    include: {
      category: {
        select: { name: true, slug: true },
      },
      modules: {
        select: {
          id: true,
          title: true,
          lessons: {
            select: { id: true, durationMinutes: true },
          },
        },
        orderBy: { position: "asc" },
      },
      enrollments: {
        where: { status: { in: ["ACTIVE", "COMPLETED"] } },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          progress: {
            where: { completedAt: { not: null } },
            select: { id: true },
          },
        },
        orderBy: { enrolledAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // 3. Reservas de sesiones de 60 min
  const bookings = await prisma.booking.findMany({
    where: { coachId: user.id },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { startAt: "asc" },
  });

  // 4. Suscripción Stripe activa
  const activeSubscription = await prisma.coachSubscription.findFirst({
    where: {
      coachId: user.id,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    include: {
      plan: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const defaultBasicPlan = !activeSubscription?.plan
    ? await prisma.subscriptionPlan.findUnique({
        where: { tier: coachProfile.currentTier || "BASIC" },
      })
    : null;

  const plan = activeSubscription?.plan || defaultBasicPlan || {
    name: t("basic_plan_name"),
    tier: "BASIC",
    commissionBps: 2300,
    monthlyPriceCents: 0,
    currency: "USD",
    hasAiCopilot: false,
    hasCourseBuilder: false,
    hasStudentTracking: false,
    monthlyAiCredits: 0,
    description: t("basic_plan_description"),
  };

  // =========================================================================
  // CÁLCULOS Y AGREGACIÓN DE MÉTRICAS GLOBALES REALES (CERO DUMMY DATA)
  // =========================================================================

  // A. Conteo real de cursos creados (JAMÁS estático 8)
  const coursesCreatedCount = createdCourses.length;

  // B. Cursos vendidos e ingresos netos por cursos
  const courseStudentIds = new Set<string>();
  let netCourseEarningsCents = 0;
  let coursesSoldCount = 0;

  for (const c of createdCourses) {
    for (const e of c.enrollments) {
      coursesSoldCount++;
      courseStudentIds.add(e.studentId);
      const net = (e.priceCents || 0) - (e.platformFeeCents || 0);
      netCourseEarningsCents += net;
    }
  }

  // C. Sesiones de 60 min confirmadas o completadas e ingresos netos
  const confirmedBookings = bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "COMPLETED"
  );
  const bookingStudentIds = new Set<string>();
  let netBookingEarningsCents = 0;

  for (const b of confirmedBookings) {
    bookingStudentIds.add(b.studentId);
    const net = (b.priceCents || 0) - (b.platformFeeCents || 0);
    netBookingEarningsCents += net;
  }

  // D. Deduplicación estricta de alumnos únicos entre cursos y reservas
  const allUniqueStudents = new Set<string>([...courseStudentIds, ...bookingStudentIds]);
  const uniqueStudentsCount = allUniqueStudents.size;

  // E. Ingresos netos combinados en centavos y unidades monetarias
  const totalNetEarningsCents = netCourseEarningsCents + netBookingEarningsCents;
  const totalNetEarnings = totalNetEarningsCents / 100;

  // F. Agenda de mentorías próximas (endAt >= now, confirmadas o en progreso)
  const now = new Date();
  const upcomingAgenda = bookings
    .filter(
      (b) =>
        ["CONFIRMED", "REQUESTED", "IN_PROGRESS"].includes(b.status) &&
        new Date(b.endAt).getTime() >= now.getTime()
    )
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  // G. Construcción de registros auténticos de alumnos para el modal de seguimiento
  const studentMap = new Map<string, StudentRecord>();

  for (const b of bookings) {
    if (b.student) {
      if (!studentMap.has(b.studentId)) {
        studentMap.set(b.studentId, {
          id: b.studentId,
          name: b.student.name || t("student_default_name"),
          avatarSeed: b.student.name || "Student",
          avatarUrl: b.student.avatarUrl,
          email: b.student.email,
          topic: b.notes
            ? b.notes.length > 40
              ? b.notes.slice(0, 40) + "..."
              : b.notes
            : t("one_on_one_mentoring"),
          progress: b.status === "COMPLETED" ? 100 : 50,
          sessionsCompleted: b.status === "COMPLETED" ? 1 : 0,
          totalSessions: 1,
          lastSession: b.startAt ? formatDate(b.startAt) : t("scheduled"),
          status: (b.status === "COMPLETED" ? t("excellent") : t("on_track")) as any,
          privateNotes: b.notes || "",
        });
      } else {
        const item = studentMap.get(b.studentId)!;
        item.totalSessions += 1;
        if (b.status === "COMPLETED") item.sessionsCompleted += 1;
      }
    }
  }

  for (const c of createdCourses) {
    for (const e of c.enrollments) {
      if (e.student) {
        if (!studentMap.has(e.studentId)) {
          const completedCount = e.progress.length;
          const totalLessonsCount = c.modules.reduce((sum, m) => sum + m.lessons.length, 0);
          const progressPct =
            e.status === "COMPLETED"
              ? 100
              : totalLessonsCount > 0
              ? Math.min(95, Math.round((completedCount / totalLessonsCount) * 100))
              : 20;

          studentMap.set(e.studentId, {
            id: e.studentId,
            name: e.student.name || t("student_default_name"),
            avatarSeed: e.student.name || "Student",
            avatarUrl: e.student.avatarUrl,
            email: e.student.email,
            topic: c.title,
            progress: progressPct,
            sessionsCompleted: 0,
            totalSessions: 0,
            lastSession: e.enrolledAt ? formatDate(e.enrolledAt) : t("enrolled"),
            status: (progressPct >= 80 ? t("excellent") : progressPct >= 50 ? t("on_track") : t("needs_reinforcement")) as any,
            privateNotes: "",
          });
        } else {
          const item = studentMap.get(e.studentId)!;
          if (item.topic === t("one_on_one_mentoring")) {
            item.topic = `${c.title} & ${t("mentoring")}`;
          }
        }
      }
    }
  }

  const authenticStudentsList = Array.from(studentMap.values());

  // H. Datos iniciales para el panel de ganancias
  const initialEarningsData: EarningsData = {
    sessionEarnings: netBookingEarningsCents / 100,
    courseEarnings: netCourseEarningsCents / 100,
    totalEarnings: totalNetEarnings,
    sessionCount: confirmedBookings.length,
    courseCount: coursesSoldCount,
    commissionPct: plan.commissionBps / 100,
    currency: coachProfile.currency || "MXN",
  };

  const levelBadgeColors: Record<string, string> = {
    NEW: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
    FEATURED: "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/40",
    EXPERT: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
    ELITE: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
  };

  const tierBadgeColors: Record<string, string> = {
    BASIC: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    CURSOS_ONLY: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
    GOLD: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
    ELITE: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
    PLATINUM: "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/40",
  };

  return (
    <div className="min-h-screen bg-cfh-bg dark:bg-slate-950 text-cfh-text dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8 transition-colors font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navegación de migas de pan */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Link href="/coach/dashboard" className="hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors">
              {t("coach_panel")}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-800 dark:text-slate-200 font-bold">{t("teacher_profile")}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/coaches/${coachProfile.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-cfh-light-green shadow-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t("view_public_profile")}</span>
            </Link>
            <Link
              href="/coach/onboarding?edit=true"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cfh-dark-green hover:bg-cfh-dark-green/90 text-white shadow-xs transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t("edit_profile")}</span>
            </Link>
          </div>
        </div>

        {/* Tarjeta Principal de Cabecera (Hero Card) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
            {/* Avatar e Información Principal */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <CoachAvatarUploader
                initialPhotoUrl={coachProfile.photoUrl}
                coachName={user.name}
              />

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                    {user.name}
                  </h1>
                  <span
                    className={`text-xs sm:text-sm font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                      levelBadgeColors[coachProfile.level] || levelBadgeColors.NEW
                    }`}
                  >
                    {t("coach")} {coachProfile.level}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                      tierBadgeColors[plan.tier] || tierBadgeColors.BASIC
                    }`}
                  >
                    {t("level")} {plan.name}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 max-w-2xl break-words [overflow-wrap:anywhere]">
                  {coachProfile.headline || t("default_headline")}
                </p>

                {/* Etiquetas de categorías */}
                {coachProfile.categories && coachProfile.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {coachProfile.categories.map((c) => (
                      <span
                        key={c.categoryId}
                        className="text-xs sm:text-sm font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      >
                        {c.category.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Metadata adicional */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 dark:text-slate-500 pt-1 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cfh-light-green" />
                    {coachProfile.yearsExperience} {coachProfile.yearsExperience === 1 ? t("year") : t("years")} {t("of_experience")}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    {formatCurrency(coachProfile.hourlyRateCents, coachProfile.currency)} {t("per_hour")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    {coachProfile.timezone}
                  </span>
                </div>
              </div>
            </div>

            {/* Acciones rápidas en la cabecera */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 self-stretch sm:self-auto">
              <CoachStudentTrackingButton
                tierName={plan.name}
                students={authenticStudentsList}
                className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>{t("student_tracking")} ({uniqueStudentsCount})</span>
              </CoachStudentTrackingButton>

              <Link
                href="/coach/availability"
                className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                <span>{t("manage_schedules")}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Barra de Métricas Globales Reales (4 Tarjetas Clave) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Métrica 1: Alumnos Únicos */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("unique_students_badge")}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("total_students")}</p>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {uniqueStudentsCount}
              </p>
              <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1">
                {t("deduplicated_students")}
              </p>
            </div>
          </div>

          {/* Métrica 2: Cursos Vendidos */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("sales_badge")}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("courses_sold")}</p>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {coursesSoldCount}
              </p>
              <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1">
                {t("active_or_completed_enrollments")}
              </p>
            </div>
          </div>

          {/* Métrica 3: Ingresos Netos Totales */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t("net_badge")}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("net_earnings")}</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                {formatCurrency(totalNetEarningsCents, coachProfile.currency)}
              </p>
              <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1 truncate">
                {t("courses")}: {formatCurrency(netCourseEarningsCents, coachProfile.currency)} | {t("sessions")}: {formatCurrency(netBookingEarningsCents, coachProfile.currency)}
              </p>
            </div>
          </div>

          {/* Métrica 4: Cursos Creados (Cero estático 8) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t("catalog_badge")}</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("courses_created")}</p>
              <p className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {coursesCreatedCount}
              </p>
              <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1">
                {createdCourses.filter((c) => c.status === "PUBLISHED").length} {t("published")}, {createdCourses.filter((c) => c.status === "DRAFT").length} {t("drafts")}
              </p>
            </div>
          </div>
        </div>

        {/* Cuadrícula Principal (2 Columnas Asimétricas) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Agenda y Cursos Creados (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Agenda de Sesiones de 60 min */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {t("mentoring_agenda")}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {upcomingAgenda.length}{" "}
                      {upcomingAgenda.length === 1
                        ? t("upcoming_session")
                        : t("upcoming_sessions")}
                    </p>
                  </div>
                </div>

                <Link
                  href="/coach/availability"
                  className="text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green hover:underline flex items-center gap-1"
                >
                  <span>{t("schedules")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Lista de Sesiones Próximas */}
              <div className="space-y-3 pt-1">
                {upcomingAgenda.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t("no_upcoming_mentoring")}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                      {t("share_profile_to_receive_bookings")}
                    </p>
                    <Link
                      href="/coach/availability"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cfh-dark-green text-white rounded-lg text-xs font-bold mt-2 shadow-xs transition-colors hover:bg-cfh-dark-green/90"
                    >
                      {t("configure_availability")}
                    </Link>
                  </div>
                ) : (
                  upcomingAgenda.map((session) => (
                    <div
                      key={session.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            session.student?.avatarUrl ||
                            `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(session.student?.name || "Alumno")}`
                          }
                          alt={session.student?.name || "Alumno"}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {session.student?.name || t("cfh_apprentice")}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 truncate">
                            {session.notes || t("custom_one_on_one_mentoring")}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                            <span className="text-blue-600 dark:text-blue-400">
                              {formatDate(session.startAt)}
                            </span>
                            <span>•</span>
                            <span>{formatTime(session.startAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <span
                          className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            session.status === "CONFIRMED"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                              : session.status === "IN_PROGRESS"
                              ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300"
                              : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                          }`}
                        >
                          {session.status === "CONFIRMED"
                            ? t("confirmed")
                            : session.status === "IN_PROGRESS"
                            ? t("in_progress")
                            : t("requested")}
                        </span>
                        <Link
                          href={`/sesion/${session.id}`}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cfh-dark-green hover:bg-cfh-dark-green/90 text-white shadow-xs transition-colors flex items-center gap-1"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>{t("enter")}</span>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Panel de Cursos Creados */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {t("courses_created")}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {coursesCreatedCount}{" "}
                      {coursesCreatedCount === 1 ? t("registered_course") : t("registered_courses")} {t("in_your_catalog")}
                    </p>
                  </div>
                </div>

                <Link
                  href="/coach/cursos"
                  className="text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green hover:underline flex items-center gap-1"
                >
                  <span>{t("manage")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-3 pt-1">
                {createdCourses.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <BookOpen className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t("no_courses_created")}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                      {t("monetize_knowledge")}
                    </p>
                    <Link
                      href="/coach/cursos"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cfh-dark-green text-white rounded-lg text-xs font-bold mt-2 shadow-xs transition-colors hover:bg-cfh-dark-green/90"
                    >
                      {t("create_first_course")}
                    </Link>
                  </div>
                ) : (
                  createdCourses.map((course) => {
                    const totalLessons = course.modules.reduce(
                      (acc, m) => acc + m.lessons.length,
                      0
                    );
                    const isPublished = course.status === "PUBLISHED";

                    return (
                      <div
                        key={course.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <img
                            src={
                              course.thumbnailUrl ||
                              "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&h=200&fit=crop&q=80"
                            }
                            alt={course.title}
                            className="w-14 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {course.title}
                              </h4>
                              <span
                                className={`text-xs font-black uppercase px-2 py-0.5 rounded-md ${
                                  isPublished
                                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                }`}
                              >
                                {isPublished ? t("published_status") : t("draft_status")}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-medium">
                              <span>
                                {course.modules.length}{" "}
                                {course.modules.length === 1 ? t("module") : t("modules")} • {totalLessons}{" "}
                                {totalLessons === 1 ? t("lesson") : t("lessons")}
                              </span>
                              <span>•</span>
                              <span className="text-cfh-dark-green dark:text-cfh-light-green font-bold">
                                {course.enrollments.length}{" "}
                                {course.enrollments.length === 1 ? t("student") : t("students")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                            {formatCurrency(course.priceCents, course.currency)}
                          </span>
                          <Link
                            href="/coach/cursos"
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
                          >
                            {t("edit")}
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Panel de Ganancias y Comisiones Dinámicas */}
            <CoachEarningsPanel
              commissionBps={plan.commissionBps}
              initialData={initialEarningsData}
            />
          </div>

          {/* Columna Derecha: Suscripción, Info Pública y Disponibilidad (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Nivel Actual de Suscripción Stripe */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {t("stripe_subscription")}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {activeSubscription ? t("active_subscription") : t("free_platform_plan")}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${
                    tierBadgeColors[plan.tier] || tierBadgeColors.BASIC
                  }`}
                >
                  {plan.tier}
                </span>
              </div>

              {/* Ficha del Plan */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/20 dark:from-slate-800/60 dark:to-purple-950/20 border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {plan.name}
                  </span>
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                    {plan.monthlyPriceCents > 0
                      ? `${formatCurrency(plan.monthlyPriceCents, plan.currency || "USD")} ${t("per_month")}`
                      : t("no_monthly_cost")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">{t("platform_commission")}</p>
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">
                      {plan.commissionBps / 100}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">{t("your_earnings")}</p>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {(10000 - plan.commissionBps) / 100}%
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{t("monthly_ai_credits")} <strong>{plan.monthlyAiCredits}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{t("course_builder")} <strong>{plan.hasCourseBuilder ? t("active") : t("locked")}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{t("analytics_tracking")} <strong>{plan.hasStudentTracking ? t("active") : t("locked")}</strong></span>
                  </div>
                </div>

                {activeSubscription?.currentPeriodEnd && (
                  <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    {t("next_billing_date")} {formatDate(activeSubscription.currentPeriodEnd)}
                  </p>
                )}
              </div>

              <Link
                href="/coach/billing"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>{t("manage_subscription")}</span>
              </Link>
            </div>

            {/* 2. Información Pública & Biografía */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {t("public_information")}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t("visible_to_students")}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs mb-1">
                    {t("professional_biography")}
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-60 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    {coachProfile.biography || t("no_biography")}
                  </p>
                </div>

                {coachProfile.introVideoUrl && (
                  <div>
                    <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs mb-1">
                      {t("intro_video")}
                    </p>
                    <a
                      href={coachProfile.introVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-blue-600 dark:text-blue-400 hover:underline font-bold"
                    >
                      <PlayCircle className="w-4 h-4 shrink-0" />
                      <span className="truncate">{coachProfile.introVideoUrl}</span>
                    </a>
                  </div>
                )}

                {/* Certificaciones Validadas */}
                <div>
                  <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs mb-1">
                    {t("teaching_certifications")} ({coachProfile.certificates.length})
                  </p>
                  {coachProfile.certificates.length === 0 ? (
                    <p className="text-slate-400 dark:text-slate-500 italic">
                      {t("no_certificates")}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {coachProfile.certificates.map((cert) => (
                        <div
                          key={cert.id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {cert.title}
                            </span>
                          </div>
                          {cert.issuedAt && (
                            <span className="text-xs text-slate-400 shrink-0">
                              {formatDate(cert.issuedAt)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Disponibilidad Semanal */}
                <div>
                  <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-xs mb-1">
                    {t("weekly_schedule_rules")} ({coachProfile.availabilityRules.length})
                  </p>
                  {coachProfile.availabilityRules.length === 0 ? (
                    <p className="text-slate-400 dark:text-slate-500 italic">
                      {t("no_active_schedules")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {coachProfile.availabilityRules.map((rule) => (
                        <span
                          key={rule.id}
                          className="text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {t(WEEKDAY_KEYS[rule.weekday] as string) || `${t("day")} ${rule.weekday}`}:{" "}
                          {formatMinutesToTime(rule.startMinute)} - {formatMinutesToTime(rule.endMinute)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

