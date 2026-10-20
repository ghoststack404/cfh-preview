"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Star, Loader2, ArrowLeft } from "lucide-react";
import { getSubscriptionPlans, getCurrentCoachSubscription } from "@/app/actions/subscriptions";
import { useTranslations } from "next-intl";
import { useTranslation } from "@/components/TranslationProvider";

export default function CoachPlansPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("CoachPlans");
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

  const [plans, setPlans] = useState<any[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fromParam = searchParams.get("from");
  const isFromBilling = fromParam === "billing";

  useEffect(() => {
    async function loadData() {
      const p = await getSubscriptionPlans();
      const s = await getCurrentCoachSubscription();
      setPlans(p);
      setCurrentSub(s);
      setLoading(false);
    }
    loadData();
  }, []);

  const saveTierToDraft = (tier: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("cfh_coach_onboarding_draft");
      const draft = raw ? JSON.parse(raw) : {};
      draft.selectedTier = tier;
      draft.savedAt = new Date().toISOString();
      localStorage.setItem("cfh_coach_onboarding_draft", JSON.stringify(draft));
    } catch {}
  };

  const handleReturnToOnboarding = (tier?: string) => {
    if (tier) {
      saveTierToDraft(tier);
      router.push(makeHref(`/coach/onboarding?edit=true&tier=${tier}`));
    } else {
      router.push(makeHref("/coach/onboarding?edit=true"));
    }
  };

  const handleSelectPlan = (plan: any) => {
    saveTierToDraft(plan.tier);
    if (isFromBilling) {
      router.push(makeHref(`/checkout/plan?planId=${plan.id}`));
    } else {
      // Regresar al llenado de datos (/coach/onboarding) con el plan seleccionado
      router.push(makeHref(`/coach/onboarding?edit=true&tier=${plan.tier}`));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <button
            type="button"
            onClick={() => handleReturnToOnboarding()}
            className="flex items-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 mr-2 text-emerald-500" />
            Volver al llenado de datos
          </button>

          {currentSub && (
            <button
              type="button"
              onClick={() => router.push(makeHref("/coach/billing"))}
              className="flex items-center text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium cursor-pointer"
            >
              Ir a Suscripción y Pagos →
            </button>
          )}
        </div>

        <div className="text-center mb-16">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-5xl tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-5 text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        {searchParams.get("canceled_mock") && (
          <div className="max-w-3xl mx-auto mb-10 p-4 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-xl border border-amber-200 dark:border-amber-500/20 text-center font-medium">
            {t("msg_canceled_mock")}
          </div>
        )}

        {searchParams.get("canceled") && (
          <div className="max-w-3xl mx-auto mb-10 p-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-center font-medium flex justify-center items-center">
            <span className="mr-2">ℹ️</span> {t("msg_canceled")}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-[1580px] mx-auto items-stretch">
          {plans.map((plan) => {
            const isCurrent = isFromBilling && currentSub?.planId === plan.id;
            let rawBenefits: unknown = null;
            try {
              rawBenefits = pt.raw(plan.tier + ".benefits");
            } catch {
              rawBenefits = null;
            }
            const benefits: string[] = Array.isArray(rawBenefits)
              ? rawBenefits
              : Array.isArray(plan.benefits)
                ? plan.benefits.map((b: string) => b.replace(/1 a 1|1-a-1|de 60 min/gi, "en vivo de 60 minutos"))
                : [];
            const isElite = plan.tier === "ELITE";
            const isPlatinum = plan.tier === "PLATINUM";

            return (
              <div 
                key={plan.id} 
                className={`bg-white dark:bg-slate-900 border rounded-3xl p-6 flex flex-col relative transition-all duration-300 hover:-translate-y-1 ${
                  isCurrent 
                  ? "border-emerald-500 ring-2 ring-emerald-500/20" 
                  : isPlatinum
                    ? "border-purple-400 dark:border-purple-700 shadow-lg shadow-purple-500/10"
                    : isElite 
                      ? "border-emerald-500 shadow-xl shadow-emerald-500/10" 
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                }`}
              >
                {isElite && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-widest flex items-center shadow-md whitespace-nowrap">
                      <Star className="w-3 h-3 mr-1 fill-white" /> {t("recommended")}
                    </span>
                  </div>
                )}

                {isPlatinum && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-gradient-to-r from-purple-600 to-indigo-500 text-white text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-widest flex items-center shadow-md whitespace-nowrap">
                      👑 Suite VIP Profesional
                    </span>
                  </div>
                )}
                
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1.5">{pt(plan.tier + ".name")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 min-h-[3rem] leading-relaxed break-words">{pt(plan.tier + ".description")}</p>
                
                <div className="mb-6 flex items-baseline">
                  <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                    ${(plan.monthlyPriceCents / 100).toFixed(0)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 ml-1.5 font-medium text-sm">{t("price_period")}</span>
                </div>

                <div className="mb-6 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-center font-semibold text-slate-700 dark:text-slate-300">
                    {t("commission")} <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">{(plan.commissionBps / 100).toFixed(1)}%</span>
                  </p>
                </div>

                <ul className="flex-1 space-y-3 mb-6">
                  {benefits.map((benefit: string, idx: number) => (
                    <li key={idx} className="flex items-start">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mr-2 mt-0.5" />
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-tight">{benefit}</span>
                    </li>
                  ))}
                  {plan.hasCourseBuilder && (
                    <li className="flex items-start">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mr-2 mt-0.5" />
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-tight">{t("course_builder")}</span>
                    </li>
                  )}
                </ul>

                <div className="mt-auto space-y-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isCurrent}
                    className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-sm text-xs sm:text-sm text-center cursor-pointer ${
                      isCurrent 
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed" 
                      : isElite
                        ? "bg-emerald-500 hover:bg-emerald-400 text-white hover:shadow-md"
                        : isPlatinum
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white hover:shadow-md"
                          : "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-800 dark:hover:border-slate-600 text-slate-900 dark:text-white"
                    }`}
                  >
                    {isCurrent
                      ? t("current_plan")
                      : isFromBilling
                        ? t("select_plan")
                        : `Elegir ${pt(plan.tier + ".name")} y volver al registro`}
                  </button>

                  {!isFromBilling && (
                    <button
                      type="button"
                      onClick={() => router.push(makeHref(`/checkout/plan?planId=${plan.id}&from=onboarding`))}
                      className="w-full py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-center cursor-pointer"
                    >
                      Ver resumen de pago de {pt(plan.tier + ".name")} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}