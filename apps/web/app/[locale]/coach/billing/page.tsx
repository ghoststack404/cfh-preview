"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CreditCard,
  Calendar,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Star,
  ArrowLeft,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { getCurrentCoachSubscription } from "@/app/actions/subscriptions";
import { getCoachOnboardingStatus } from "@/app/actions/onboarding";
import { useTranslation } from "@/components/TranslationProvider";

interface PayoutAccountData {
  connected: boolean;
  isMock: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  externalAccounts: Array<{
    id: string;
    object: string;
    bankName: string;
    last4: string;
    currency: string;
    routingNumber?: string | null;
    status?: string;
    defaultForCurrency?: boolean;
  }>;
  requirementsDue: string[];
  payoutSchedule?: {
    interval: string;
    delayDays: number;
  } | null;
  dashboardUrl?: string | null;
}

export default function CoachBillingDashboard() {
  const { data: session } = useSession();
  const t = useTranslations("Billing");
  const pt = useTranslations("PlansData");
  const { locale } = useTranslation();
  const locPrefix = locale ? '/' + locale : '';
  const makeHref = (p: string): string => {
    if (!p) return locPrefix || '/';
    if (p === '/') return locPrefix || '/';
    if (locPrefix && (p === locPrefix || p.startsWith(locPrefix + '/'))) return p;
    const match = p.match(/^\/([a-z]{2})(?:\/|$)/);
    if (match) return p;
    return `${locPrefix}${p.startsWith('/') ? p : `/${p}`}`;
  };

  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [coachProfile, setCoachProfile] = useState<any>(null);
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [connectError, setConnectError] = useState("");

  const [showSuccess, setShowSuccess] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);
  const [stripeAlert, setStripeAlert] = useState<{
    type: "success" | "warning" | "error" | "info";
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    const msgParam = searchParams.get("msg");

    if (stripeParam === "return") {
      setStripeAlert({
        type: "success",
        title: t("alert_connected_title"),
        message: t("alert_connected_msg")
      });
    } else if (stripeParam === "refresh") {
      setStripeAlert({
        type: "warning",
        title: t("alert_refresh_title"),
        message: t("alert_refresh_msg")
      });
    } else if (stripeParam === "mock") {
      setStripeAlert({
        type: "success",
        title: t("alert_mock_title"),
        message: t("alert_mock_msg")
      });
    } else if (stripeParam === "not-connected") {
      setStripeAlert({
        type: "warning",
        title: t("alert_not_connected_title"),
        message: t("alert_not_connected_msg")
      });
    } else if (stripeParam === "error") {
      setStripeAlert({
        type: "error",
        title: t("alert_error_title"),
        message: msgParam
          ? `No se pudo completar la vinculación: ${decodeURIComponent(msgParam)}`
          : "Ocurrió un error al procesar la vinculación con Stripe Connect. Por favor intenta de nuevo."
      });
    } else if (stripeParam === "mock-dashboard") {
      setStripeAlert({
        type: "info",
        title: t("alert_mock_dashboard_title"),
        message: t("alert_mock_dashboard_msg")
      });
    }

    if (searchParams.get("success")) setShowSuccess(true);
    if (searchParams.get("canceled_mock")) setShowCanceled(true);

    if (stripeParam || searchParams.get("success") || searchParams.get("canceled_mock")) {
      const timer = setTimeout(() => {
        router.replace("/coach/billing", { scroll: false });
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  useEffect(() => {
    async function loadData() {
      try {
        const [s, status, payout] = await Promise.all([
          getCurrentCoachSubscription(),
          getCoachOnboardingStatus().catch(() => null),
          fetch("/api/coach/payout-account").then((r) => (r.ok ? r.json() : null)).catch(() => null)
        ]);
        if (status && !status.authenticated) {
          router.replace("/?auth=login");
          return;
        }
        if (status && status.activeRole === "STUDENT") {
          router.replace("/dashboard");
          return;
        }
        if (status && !status.hasProfile) {
          router.replace("/coach/onboarding");
          return;
        }
        setCurrentSub(s);
        if (status?.profile) {
          setCoachProfile(status.profile);
        }
        if (payout) {
          setPayoutAccount(payout);
        }
      } catch (err) {
        console.error("Error cargando facturación de coach:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleConnectOnboard = async () => {
    setConnectLoading(true);
    setConnectError("");
    try {
      const res = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setConnectError(data.error || t("alert_error_msg"));
        setConnectLoading(false);
      }
    } catch (err: any) {
      setConnectError(err?.message || t("alert_error_title"));
      setConnectLoading(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    if (payoutAccount?.dashboardUrl) {
      if (payoutAccount.dashboardUrl.startsWith("http")) {
        window.open(payoutAccount.dashboardUrl, "_blank");
        return;
      } else {
        router.push(payoutAccount.dashboardUrl);
        return;
      }
    }

    setDashboardLoading(true);
    try {
      const res = await fetch("/api/coach/payout-account");
      if (res.ok) {
        const data = await res.json();
        if (data.dashboardUrl) {
          if (data.dashboardUrl.startsWith("http")) {
            window.open(data.dashboardUrl, "_blank");
          } else {
            router.push(data.dashboardUrl);
          }
          setDashboardLoading(false);
          return;
        }
      }
      window.location.href = "/api/stripe/connect/dashboard";
    } catch (err) {
      console.error("Error abriendo dashboard de Stripe:", err);
      window.location.href = "/api/stripe/connect/dashboard";
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/subscriptions/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setStripeAlert({
          type: "error",
          title: t("billing_portal_loading"),
          message: data.error || t("billing_portal_error"),
        });
        setPortalLoading(false);
      }
    } catch (error) {
      setStripeAlert({
        type: "error",
        title: t("alert_error_title"),
        message: t("billing_portal_conn_error"),
      });
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const effectiveTier = currentSub?.plan?.tier || coachProfile?.currentTier || "BASIC";
  const isBasic = effectiveTier === "BASIC";
  const isElite = effectiveTier === "ELITE" || effectiveTier === "PLATINUM";
  const planName = currentSub?.plan ? pt(currentSub.plan.tier + ".name") : pt(effectiveTier + ".name");
  const commission = currentSub?.plan
    ? (currentSub.plan.commissionBps / 100).toFixed(0)
    : coachProfile?.commissionBps
      ? (coachProfile.commissionBps / 100).toFixed(0)
      : "23";
  const price = currentSub?.plan ? (currentSub.plan.monthlyPriceCents / 100).toFixed(2) : "0.00";
  const status = currentSub?.status || "ACTIVE";
  
  // Format Date safely
  const formatDate = (dateString?: Date) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-MX", {
      year: "numeric", month: "long", day: "numeric"
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(makeHref("/coach/onboarding?edit=true"))}
              className="group flex items-center text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-all font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 mr-2 text-emerald-500 group-hover:-translate-x-1 transition-transform" />
              Volver al llenado de datos
            </button>

            <button
              type="button"
              onClick={() => router.push(makeHref("/coach/dashboard"))}
              className="group flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-white px-3 py-2 transition-all font-medium cursor-pointer"
            >
              {t("back")} →
            </button>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {t("subtitle")}
          </p>
        </div>

        {stripeAlert && (
          <div
            className={`mb-8 p-4 rounded-xl border flex items-center justify-between shadow-sm transition-opacity duration-500 ${
              stripeAlert.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20"
                : stripeAlert.type === "warning"
                ? "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/20"
                : stripeAlert.type === "error"
                ? "bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-500/20"
                : "bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/20"
            }`}
          >
            <div className="flex items-center gap-3">
              {stripeAlert.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <div>
                <p className="font-bold text-sm">{stripeAlert.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed">{stripeAlert.message}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setStripeAlert(null);
                router.replace(makeHref("/coach/billing"), { scroll: false });
              }}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors ml-4 shrink-0"
              aria-label="Cerrar notificación"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        )}

        {showSuccess && (
          <div className="mb-8 p-4 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-500/20 flex flex-wrap items-center justify-between gap-3 shadow-sm transition-opacity duration-500">
            <div className="flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" />
              <p className="font-medium">{t("payment_success")}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push(makeHref("/coach/onboarding?edit=true"))}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Volver al llenado de datos
              </button>
              <button onClick={() => { setShowSuccess(false); router.replace(makeHref("/coach/billing"), { scroll: false }); }} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>
        )}

        {showCanceled && (
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 rounded-xl border border-amber-200 dark:border-amber-500/20 flex items-center justify-between shadow-sm transition-opacity duration-500">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
              <p className="font-medium">{t("payment_canceled")}</p>
            </div>
            <button onClick={() => { setShowCanceled(false); router.replace("/coach/billing", { scroll: false }); }} className="p-1 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        )}

        {/* Panel de Cobros y Transferencias (Stripe Connect) */}
        {coachProfile && (coachProfile.stripeChargesEnabled || payoutAccount?.connected) ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-8">
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-2xl shrink-0 mt-0.5">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-xl font-black text-slate-900 dark:text-white">
                        {t("payout_title")}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                        {t("payout_charges_enabled")}
                      </span>
                      {payoutAccount?.payoutsEnabled && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                          {t("payout_transfers_active")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      {t("payout_subtitle")}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleOpenStripeDashboard}
                  disabled={dashboardLoading}
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-sm transition-all hover:shadow transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer self-start sm:self-auto"
                >
                  {dashboardLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>{t("payout_open_dashboard_loading")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("payout_open_dashboard")}</span>
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Cuentas bancarias y detalles de transferencias */}
            <div className="p-6 sm:p-8 bg-slate-50/70 dark:bg-slate-800/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" />
                    {t("payout_bank_account")}
                  </h3>

                  {payoutAccount?.externalAccounts && payoutAccount.externalAccounts.length > 0 ? (
                    <div className="space-y-3">
                      {payoutAccount.externalAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-xs">
                              {acc.currency}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {acc.bankName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                •••• {acc.last4}
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            {acc.status === "verified" ? t("payout_bank_verified") : t("payout_bank_active")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>{t("payout_bank_linked")}</span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t("payout_bank_configured")}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                    {t("payout_schedule")}
                  </h3>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">{t("payout_frequency")}</span>
                      <span className="font-bold text-slate-900 dark:text-white text-xs uppercase">
                        {payoutAccount?.payoutSchedule?.interval === "daily" ? t("freq_daily") : (payoutAccount?.payoutSchedule?.interval || t("freq_daily"))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">{t("payout_delay")}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        {t("payout_delay_days", { days: payoutAccount?.payoutSchedule?.delayDays ?? 2 })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {t("payout_schedule_note")}
                    </p>
                  </div>
                </div>
              </div>

              {payoutAccount?.requirementsDue && payoutAccount.requirementsDue.length > 0 && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                      {t("payout_requirements")}
                    </p>
                  </div>
                  <button
                    onClick={handleConnectOnboard}
                    className="text-xs font-bold text-amber-900 dark:text-amber-200 underline hover:no-underline"
                  >
                    Completar datos
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          coachProfile && (
            <div className="mb-8 p-6 bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 rounded-3xl shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-2xl shrink-0 mt-0.5">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {t("connect_title")}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200/80 dark:bg-amber-800/80 text-amber-900 dark:text-amber-100">
                        {t("connect_required")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {t("connect_subtitle")}
                    </p>
                    {connectError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-2">
                        {connectError}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleConnectOnboard}
                  disabled={connectLoading}
                  className="shrink-0 inline-flex items-center justify-center px-6 py-3.5 bg-cfh-dark-green hover:bg-[#061528] text-white font-bold text-sm rounded-2xl shadow-md transition-all hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
                >
                  {connectLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>{t("connect_loading")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("connect_btn")}</span>
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-8">
          <div className="p-8 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">{planName}</h2>
                  {status === "ACTIVE" && (
                    <span className="px-3 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                      Activo
                    </span>
                  )}
                  {status === "CANCELED" && (
                    <span className="px-3 py-1 rounded-md bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 text-[10px] font-black uppercase tracking-widest">
                      Cancelado
                    </span>
                  )}
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-2">
                  {t("plan_commission")} <strong className="text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{commission}%</strong>
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">${price}</p>
                <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">{t("plan_price_period")}</p>
              </div>
            </div>
          </div>

          {!isBasic && (
            <div className="p-8 bg-slate-50 dark:bg-slate-800/30 flex flex-col sm:flex-row gap-10">
              <div className="flex-1">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-5 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {t("billing_cycle")}
                </h3>
                <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{t("billing_period_start")}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">{formatDate(currentSub?.currentPeriodStart)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{t("billing_next_charge")}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">{formatDate(currentSub?.currentPeriodEnd)}</span>
                  </div>
                </div>
              </div>

              <div className="w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

              <div className="flex-1">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-5 flex items-center">
                  <CreditCard className="w-4 h-4 mr-2" />
                  {t("billing_manage")}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                  {t("billing_manage_desc")}
                </p>
                <button
                  onClick={handleOpenPortal}
                  disabled={portalLoading}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl shadow-sm text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
                  {t("billing_manage_btn")}
                </button>
              </div>
            </div>
          )}
        </div>

        {!isElite && (
          <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-10 text-white flex flex-col md:flex-row items-center justify-between shadow-2xl">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-emerald-500/20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl"></div>
            
            <div className="relative z-10 mb-6 md:mb-0 md:mr-8 max-w-lg">
              <div className="inline-flex items-center space-x-2 bg-white/10 rounded-full px-3 py-1 mb-4 border border-white/10 backdrop-blur-sm">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">{t("upsell_badge")}</span>
              </div>
              <h3 className="text-2xl font-black mb-3">{t("upsell_title")}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t("upsell_subtitle")}
              </p>
            </div>
            <button
              onClick={() => router.push("/coach/plans")}
              className="relative z-10 w-full md:w-auto whitespace-nowrap inline-flex items-center justify-center px-8 py-4 rounded-xl shadow-xl text-sm font-black text-slate-900 bg-white hover:bg-slate-50 transition-all hover:-translate-y-0.5"
            >
              {t("upsell_btn")} <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
