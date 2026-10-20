"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Zap,
  Star,
  AlertTriangle,
  X,
} from "lucide-react";
import { getSubscriptionPlanById } from "@/app/actions/subscriptions";
import { cancelPendingPlanSelection } from "@/app/actions/onboarding";
import { useTranslation } from "@/components/TranslationProvider";

function CheckoutPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("CheckoutPlan");
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

  const planId = searchParams.get("planId");
  const isCanceledParam = searchParams.get("canceled") === "true";
  
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // useEffect corre solo en el cliente, no necesita isMounted ni typeof document
    const cookieRole = document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1];
    if (cookieRole === "STUDENT") {
      router.replace(makeHref("/dashboard"));
      return;
    }

    if (!planId) {
      router.push(makeHref("/coach/plans"));
      return;
    }
    async function loadData() {
      const data = await getSubscriptionPlanById(planId as string);
      if (!data) {
        router.push(makeHref("/coach/plans"));
      } else {
        setPlan(data);
      }
      setLoading(false);
    }
    loadData();
  }, [planId, router, locale]);

  // Si retornó de Stripe habiendo cancelado, abrir modal de confirmación de Plan Básico
  useEffect(() => {
    if (isCanceledParam) {
      setShowCancelModal(true);
    }
  }, [isCanceledParam]);

  const fromParam = searchParams.get("from");

  const handleReturnToOnboarding = () => {
    if (fromParam === "billing") {
      router.push(makeHref("/coach/billing"));
      return;
    }
    if (typeof window !== "undefined" && plan?.tier) {
      try {
        const raw = localStorage.getItem("cfh_coach_onboarding_draft");
        const draft = raw ? JSON.parse(raw) : {};
        draft.selectedTier = plan.tier;
        draft.savedAt = new Date().toISOString();
        localStorage.setItem("cfh_coach_onboarding_draft", JSON.stringify(draft));
      } catch {}
    }
    const tierQuery = plan?.tier ? `&tier=${plan.tier}` : "";
    router.push(makeHref(`/coach/onboarding?edit=true${tierQuery}`));
  };

  const handleProceedToStripe = async () => {
    setProcessing(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout

    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
        signal: controller.signal,
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || t("error_generic"));
        setProcessing(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError(t("error_timeout"));
      } else if (!navigator.onLine) {
        setError(t("error_offline"));
      } else {
        setError(t("error_connection"));
      }
      setProcessing(false);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      // Ejecutar Server Action y fallback a endpoint de API cancel-pending
      let targetUrl = "/coach/dashboard";
      try {
        const actionResult = await cancelPendingPlanSelection();
        if (actionResult && actionResult.redirectUrl) {
          targetUrl = actionResult.redirectUrl;
        }
      } catch (actionErr) {
        const apiRes = await fetch("/api/subscriptions/cancel-pending", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const apiData = await apiRes.json();
        if (apiData?.redirectUrl) {
          targetUrl = apiData.redirectUrl;
        }
      }

      window.location.href = makeHref(targetUrl);
    } catch (err) {
      console.error("Error al cancelar compra pendiente:", err);
      window.location.href = makeHref("/coach/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a]">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!plan) return null;

  let rawBenefits: unknown = null;
  try {
    rawBenefits = pt.raw(plan.tier + ".benefits");
  } catch {
    rawBenefits = null;
  }
  const benefits: string[] = Array.isArray(rawBenefits)
    ? rawBenefits
    : Array.isArray(plan.benefits)
      ? plan.benefits.map((b: string) => b.replace(/1 a 1|1-a-1/gi, "de 60 min"))
      : [];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] py-12 px-4 sm:px-6 lg:px-8 selection:bg-emerald-500 selection:text-white flex items-center">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <button
            type="button"
            onClick={handleReturnToOnboarding}
            className="group flex items-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 mr-2 text-emerald-500 group-hover:-translate-x-1 transition-transform" />
            Volver al llenado de datos
          </button>

          <button
            type="button"
            onClick={() => router.push(makeHref("/coach/plans?from=onboarding"))}
            className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium cursor-pointer"
          >
            Ver comparativa de planes →
          </button>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 flex items-center shadow-sm">
            <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col lg:flex-row">
          
          {/* Left Column: Plan Showcase */}
          <div className="lg:w-5/12 bg-slate-900 dark:bg-slate-950 p-10 text-white relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-emerald-500/20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl"></div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center space-x-2 bg-white/10 rounded-full px-3 py-1 mb-8 border border-white/10 backdrop-blur-sm">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">{t("upgrade_badge")}</span>
              </div>

              <h2 className="text-4xl font-extrabold mb-4">{pt(plan.tier + ".name")}</h2>
              <p className="text-slate-400 text-sm mb-10 leading-relaxed">
                {plan.description}
              </p>

              <div className="space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">{t("whats_included")}</h3>
                {benefits.map((b: string, i: number) => (
                  <div key={i} className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mr-3" />
                    <span className="text-slate-200 text-sm font-medium">{b}</span>
                  </div>
                ))}
                {plan.hasCourseBuilder && (
                  <div className="flex items-start">
                    <Zap className="w-5 h-5 text-amber-400 shrink-0 mr-3 fill-amber-400/20" />
                    <span className="text-white font-bold text-sm">{t("course_builder")}</span>
                  </div>
                )}
                {plan.hasAiCopilot && (
                  <div className="flex items-start">
                    <Zap className="w-5 h-5 text-amber-400 shrink-0 mr-3 fill-amber-400/20" />
                    <span className="text-white font-bold text-sm">{t("ai_copilot", { credits: plan.monthlyAiCredits })}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="relative z-10 mt-12 pt-8 border-t border-white/10">
               <p className="text-xs text-slate-500 text-center">{t("immediate_access")}</p>
            </div>
          </div>

          {/* Right Column: Checkout Details */}
          <div className="lg:w-7/12 p-10 flex flex-col justify-center bg-white dark:bg-slate-900">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">{t("billing_details")}</h2>
            
            <div className="space-y-5 mb-10">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span className="font-medium">{t("subtotal")}</span>
                <span className="font-semibold text-slate-900 dark:text-white">${(plan.monthlyPriceCents / 100).toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span className="font-medium">{t("taxes")}</span>
                <span className="text-sm italic">{t("taxes_calc")}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span className="font-medium">{t("renewal_cycle")}</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-md text-slate-700 dark:text-slate-300">{t("monthly")}</span>
              </div>
              
              <div className="pt-8 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-end">
                <div>
                  <span className="block text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">{t("total_today")}</span>
                  <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                    ${(plan.monthlyPriceCents / 100).toFixed(2)}
                  </span>
                </div>
                <span className="text-xl font-bold text-slate-400 mb-1.5">USD</span>
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-5 mb-8 border border-emerald-100 dark:border-emerald-500/20 flex">
              <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0 mr-4" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                {t("secure_stripe_note")}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleProceedToStripe}
                disabled={processing || cancelling}
                className="w-full relative group overflow-hidden flex items-center justify-center py-5 px-6 rounded-2xl text-white font-bold text-lg transition-all disabled:opacity-70 shadow-xl shadow-slate-200 dark:shadow-none cursor-pointer"
                style={{ backgroundColor: "#061528" }}
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-emerald-600 to-[#061528] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative flex items-center">
                  {processing ? (
                    <><Loader2 className="w-6 h-6 animate-spin mr-3" /> {t("processing")}</>
                  ) : (
                    <><CreditCard className="w-6 h-6 mr-3" /> {t("pay_btn")}</>
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={handleReturnToOnboarding}
                disabled={processing || cancelling}
                className="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold text-sm transition-all border border-emerald-200 dark:border-emerald-800/60 disabled:opacity-50 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al llenado de datos con este plan seleccionado
              </button>

              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={processing || cancelling}
                className="w-full flex items-center justify-center py-3 px-6 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm transition-all border border-slate-200 dark:border-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {t("cancel_btn")}
              </button>
            </div>
            
            <div className="mt-8 flex items-center justify-center space-x-2 text-slate-400 dark:text-slate-500">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">{t("secure_badge")}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Modal de Advertencia al Retroceder o Cancelar Compra */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              disabled={cancelling}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
              aria-label={t("close_modal")}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("cancel_modal_title")}
                </h3>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  {t("cancel_modal_subtitle")}
                </span>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6"><span dangerouslySetInnerHTML={{ __html: t.raw("cancel_modal_desc").replace("{planName}", pt(plan.tier + ".name")) }} /></p>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 mb-6 text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
              <div className="flex items-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                <span>{t("cancel_modal_benefit1")}</span>
              </div>
              <div className="flex items-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                <span>{t("cancel_modal_benefit2")}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleReturnToOnboarding}
                disabled={cancelling}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm transition-all text-center order-2 sm:order-1 cursor-pointer"
              >
                Volver al llenado de datos
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center order-1 sm:order-2 disabled:opacity-70 cursor-pointer"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t("cancel_modal_assigning")}
                  </>
                ) : (
                  t("cancel_modal_confirm")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPlanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>}>
      <CheckoutPlanContent />
    </Suspense>
  );
}

