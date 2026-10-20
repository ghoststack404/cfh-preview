"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  Video,
  BookOpen,
  TrendingUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useTranslation } from "@/components/TranslationProvider";
import { getCoachEarnings } from "@/app/actions/dashboard";

export interface EarningsData {
  sessionEarnings: number;      // Ganancias netas por sesiones (después de comisión)
  courseEarnings: number;       // Ganancias netas por cursos (después de comisión)
  totalEarnings: number;        // Total combinado
  sessionCount: number;         // Número de sesiones completadas
  courseCount: number;          // Número de cursos vendidos
  commissionPct: number;        // % de comisión de la plataforma
  currency: string;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>
      </div>
    </motion.div>
  );
}

export default function CoachEarningsPanel({
  commissionBps = 2000,
  initialData,
}: {
  commissionBps?: number;
  initialData?: EarningsData | null;
}) {
  const { t, locale } = useTranslation();
  const [period, setPeriod] = useState("30");
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [loading, setLoading] = useState(initialData ? false : true);
  const [earnings, setEarnings] = useState<EarningsData | null>(initialData || null);

  const periodLabels: Record<string, string> = {
    "30": t("CoachDashboard.period_30_days", "Últimos 30 días"),
    "90": t("CoachDashboard.period_3_months", "Últimos 3 meses"),
    "180": t("CoachDashboard.period_6_months", "Últimos 6 meses"),
    "365": t("CoachDashboard.period_this_year", "Este año"),
    "all": t("CoachDashboard.period_all_time", "Todo el tiempo"),
  };

  const commissionPct = commissionBps / 100; // e.g. 2000 → 20%
  const coachPct = 100 - commissionPct;      // e.g. 80%

  useEffect(() => {
    async function fetchEarnings() {
      if (initialData && period === "30" && earnings === initialData) {
        return;
      }

      setLoading(true);
      try {
        const periodParam = period === "all" ? "all" : `${period}d`;
        const data = await getCoachEarnings(periodParam);
        if (data && data.success) {
          setEarnings({
            sessionEarnings: data.sessionEarnings ?? 0,
            courseEarnings: data.courseEarnings ?? 0,
            totalEarnings: data.totalEarnings ?? 0,
            sessionCount: data.sessionCount ?? 0,
            courseCount: data.courseCount ?? 0,
            commissionPct: data.commissionPct ?? 0,
            currency: data.currency ?? "USD"
          });
        } else {
          // Zero dummy data: genuine 0 metrics when no earnings exist
          setEarnings({
            sessionEarnings: 0,
            courseEarnings: 0,
            totalEarnings: 0,
            sessionCount: 0,
            courseCount: 0,
            commissionPct,
            currency: "MXN",
          });
        }
      } catch {
        // Zero dummy data: genuine 0 metrics on error
        setEarnings({
          sessionEarnings: 0,
          courseEarnings: 0,
          totalEarnings: 0,
          sessionCount: 0,
          courseCount: 0,
          commissionPct,
          currency: "MXN",
        });
      } finally {
        setLoading(false);
      }
    }
    fetchEarnings();
  }, [period, coachPct, initialData]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale.toLowerCase(), { style: "currency", currency: earnings?.currency || "USD", maximumFractionDigits: 2 }).format(n);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green" />
            {t("CoachDashboard.my_earnings", "Mis Ganancias")}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {t("CoachDashboard.commission_desc", { commissionPct, coachPct })}
          </p>
        </div>

        {/* Period Selector */}
        <div className="relative">
          <button
            onClick={() => setIsPeriodOpen(p => !p)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl shadow-sm hover:border-cfh-light-green dark:hover:border-cfh-light-green transition-colors cursor-pointer"
          >
            {periodLabels[period] || periodLabels["30"]}
            <ChevronDown className={`w-4 h-4 transition-transform ${isPeriodOpen ? "rotate-180" : ""}`} />
          </button>
          {isPeriodOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsPeriodOpen(false)} />
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden min-w-[180px]">
                {["30", "90", "180", "365", "all"].map(val => (
                  <button
                    key={val}
                    onClick={() => { setPeriod(val); setIsPeriodOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                      period === val
                        ? "bg-cfh-dark-green/10 text-cfh-dark-green dark:text-cfh-light-green font-bold"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {periodLabels[val]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="w-8 h-8 text-cfh-light-green animate-spin" />
        </div>
      ) : earnings ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              icon={<Video className="w-5 h-5 text-blue-600" />}
              label={t("CoachDashboard.by_sessions", "Por Sesiones")}
              value={fmt(earnings.sessionEarnings)}
              sub={t("CoachDashboard.sessions_completed_count", { count: earnings.sessionCount })}
              color="bg-blue-50 dark:bg-blue-950/50"
              delay={0}
            />
            <StatCard
              icon={<BookOpen className="w-5 h-5 text-violet-600" />}
              label={t("CoachDashboard.by_courses", "Por Cursos")}
              value={fmt(earnings.courseEarnings)}
              sub={t("CoachDashboard.courses_sold_count", { count: earnings.courseCount })}
              color="bg-violet-50 dark:bg-violet-950/50"
              delay={0.06}
            />
            <StatCard
              icon={<DollarSign className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green" />}
              label={t("CoachDashboard.total_net", "Total Neto")}
              value={fmt(earnings.totalEarnings)}
              sub={t("CoachDashboard.earnings_in_period", { period: (periodLabels[period] || "").toLowerCase() })}
              color="bg-cfh-dark-green/10 dark:bg-cfh-light-green/10"
              delay={0.12}
            />
          </div>

          {/* Progress bar visual */}
          <div className="bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-4">
            <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span>{t("CoachDashboard.sessions_vs_courses", "Sesiones vs. Cursos")}</span>
              <span>{t("CoachDashboard.total_amount", { total: fmt(earnings.totalEarnings) })}</span>
            </div>
            <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
              {earnings.totalEarnings > 0 && (
                <>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(earnings.sessionEarnings / earnings.totalEarnings) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full bg-blue-500 rounded-l-full"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(earnings.courseEarnings / earnings.totalEarnings) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                    className="h-full bg-violet-500 rounded-r-full"
                  />
                </>
              )}
              {earnings.totalEarnings === 0 && (
                <div className="h-full w-full bg-slate-300 dark:bg-slate-600 rounded-full" />
              )}
            </div>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                {t("CoachDashboard.sessions_pct", { pct: earnings.totalEarnings > 0 ? Math.round((earnings.sessionEarnings / earnings.totalEarnings) * 100) : 0 })}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                {t("CoachDashboard.courses_pct", { pct: earnings.totalEarnings > 0 ? Math.round((earnings.courseEarnings / earnings.totalEarnings) * 100) : 0 })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400 text-center py-8">{t("CoachDashboard.could_not_load_earnings", "No se pudieron cargar las ganancias.")}</p>
      )}
    </div>
  );
}

// DEPRECATED / PURGED: Previously used getDemoData mock calculations. Replaced with authentic Prisma earnings data.


