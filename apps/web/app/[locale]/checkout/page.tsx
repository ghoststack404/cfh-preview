"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useSession } from 'next-auth/react';
import { useAuthModal } from '@/context/AuthModalContext';
import { useTranslation } from '@/components/TranslationProvider';
import { translateCoachName, translateCourseTitle } from '@/lib/i18n-helpers';
import { ShoppingBag, BookOpen, Lock, ShieldCheck, ShieldAlert, ArrowLeft, Loader2, AlertCircle, CheckCircle2, ExternalLink, CreditCard } from 'lucide-react';

function CheckoutContent() {
  const { t, locale } = useTranslation();
  const { items, totalCents, clearCart, addItem, isLoading, setIsOpen } = useCart();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { openLogin } = useAuthModal();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  interface SavedCard {
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  }
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('');

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetch('/api/wallet/payment-methods')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.paymentMethods && data.paymentMethods.length > 0) {
            setSavedCards(data.paymentMethods);
            const def = data.paymentMethods.find((c: SavedCard) => c.isDefault) || data.paymentMethods[0];
            setSelectedCardId(def.id);
          }
        })
        .catch(() => {});
    }
  }, [sessionStatus]);

  const isDirect = searchParams.get('direct') === 'true';
  const directCourseId = searchParams.get('courseId');
  const [directCourse, setDirectCourse] = useState<any>(null);
  const [directLoading, setDirectLoading] = useState(isDirect && Boolean(directCourseId));

  // Ocultar siempre el drawer del carrito cuando estemos en la página de checkout
  useEffect(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  // Redirigir si el usuario no está autenticado
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      const returnPath = window.location.pathname + window.location.search;
      router.replace(`/?auth=login&callbackUrl=${encodeURIComponent(returnPath)}`);
    }
  }, [sessionStatus, router]);

  // Si no es compra directa pero viene courseId en la URL, agregarlo al carrito
  useEffect(() => {
    if (!isDirect && sessionStatus === 'authenticated' && directCourseId && !items.some(i => i.courseId === directCourseId)) {
      addItem(directCourseId);
    }
  }, [isDirect, sessionStatus, directCourseId, items, addItem]);

  // Bloquear a usuarios con rol Coach
  useEffect(() => {
    const cookieRole = document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1];
    const effectiveRole = cookieRole || (session?.user as any)?.activeRole || (session?.user as any)?.role;
    if (effectiveRole === "COACH") {
      router.replace("/coach/dashboard");
    }
  }, [session, router]);

  // Cargar info del curso si es compra directa
  useEffect(() => {
    if (isDirect && directCourseId) {
      setDirectLoading(true);
      fetch(`/api/courses/${directCourseId}/checkout`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.course) {
            setDirectCourse(data.course);
          } else {
            return fetch(`/api/courses/${directCourseId}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => {
                if (d?.course) setDirectCourse(d.course);
              });
          }
        })
        .catch((err) => console.error("Error fetching direct course details:", err))
        .finally(() => setDirectLoading(false));
    }
  }, [isDirect, directCourseId]);

  // Determinar los ítems y totales del checkout
  const checkoutItems = isDirect
    ? directCourse
      ? [
          {
            id: `direct-${directCourse.id}`,
            courseId: directCourse.id,
            course: directCourse,
          },
        ]
      : []
    : items;

  const activeTotalCents = isDirect
    ? directCourse
      ? directCourse.priceCents || Math.round((directCourse.price || 0) * 100)
      : 0
    : totalCents;

  const activeCurrency = isDirect ? directCourse?.currency || 'USD' : (items[0]?.course?.currency || 'USD');

  const formattedTotal = (activeTotalCents / 100).toLocaleString(locale.toLowerCase(), {
    style: 'currency',
    currency: activeCurrency,
  });

  const handleProceedToStripe = async (useSavedCard: boolean = false) => {
    setError(null);

    if (sessionStatus === 'unauthenticated') {
      openLogin();
      return;
    }

    if (checkoutItems.length === 0) {
      setError('No hay cursos seleccionados para procesar.');
      return;
    }

    setIsProcessing(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const bodyData: any = {};
    if (useSavedCard && selectedCardId) {
      bodyData.paymentMethodId = selectedCardId;
    }

    try {
      if (isDirect && directCourseId) {
        const res = await fetch(`/api/courses/${directCourseId}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyData),
          signal: controller.signal,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Error al procesar la sesión de pago.');
          setIsProcessing(false);
          return;
        }

        if (data.url) {
          window.location.href = data.url;
        } else if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          window.location.href = `/classroom/${directCourseId}?payment=success`;
        }
        return;
      }

      // Flujo estándar de carrito
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al conectar con la pasarela de pagos.');
        setIsProcessing(false);
        return;
      }

      clearCart();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        window.location.href = '/dashboard?payment=success';
      }
    } catch (err: any) {
      console.error('Error durante el checkout:', err);
      if (err.name === 'AbortError') {
        setError("La conexión segura tardó demasiado. Intenta de nuevo.");
      } else if (!navigator.onLine) {
        setError("Verifica tu conexión a internet e intenta de nuevo.");
      } else {
        setError(t("Checkout.error_generic", "Ocurrió un error al generar la sesión de pago."));
      }
      setIsProcessing(false);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (sessionStatus === 'loading' || sessionStatus === 'unauthenticated' || (!isDirect && isLoading) || (isDirect && directLoading)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-cfh-light-green mb-4" />
        <p className="text-gray-500 font-medium">
          {sessionStatus === 'unauthenticated'
            ? t("Checkout.redirecting_login", "Redirigiendo a inicio de sesión...")
            : t("Checkout.loading", "Cargando detalles de tu compra...")}
        </p>
      </div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-400 mb-6">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-cfh-text dark:text-slate-100 mb-2">
          {isDirect ? t("Checkout.course_not_available", "Curso no disponible") : t("Checkout.empty_cart", "Tu carrito está vacío")}
        </h2>
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-6 text-center max-w-sm">
          {isDirect
            ? t("Checkout.course_not_available_desc", "No se pudo encontrar el curso seleccionado para compra directa. Por favor regresa al catálogo.")
            : t("Checkout.empty_cart_desc", "No tienes cursos seleccionados para realizar el pago. Explora nuestro catálogo y agrega tus cursos favoritos.")}
        </p>
        <Link
          href="/cursos"
          className="inline-flex items-center gap-2 px-6 py-3 bg-cfh-dark-green text-white font-bold rounded-2xl hover:bg-cfh-light-green transition-colors shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("Checkout.explore_courses", "Explorar cursos")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Toast emergente de error */}
      {error && (
        <div className="fixed bottom-4 right-4 sm:top-24 sm:bottom-auto sm:right-6 z-50 flex items-center gap-3 px-5 py-4 bg-rose-500 text-white rounded-2xl shadow-2xl max-w-md">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
          <button onClick={() => setError(null)} className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors shrink-0">
            ✕
          </button>
        </div>
      )}

      {/* Ticket Central de Compra */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 overflow-hidden">
        
        {/* Cabecera del Ticket */}
        <div className="bg-gradient-to-r from-cfh-dark-green to-emerald-800 p-8 text-white relative">
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold tracking-wide uppercase text-emerald-200 border border-white/10">
              <Lock className="w-3.5 h-3.5" />
              {t("Checkout.badge_secure_payment", "Pago 100% Seguro")}
            </span>
            <span className="text-xs font-medium text-emerald-100/80">
              {checkoutItems.length === 1 ? t("Checkout.one_course", "1 curso") : t("Checkout.courses_count", { count: checkoutItems.length }, `${checkoutItems.length} cursos`)}
            </span>
          </div>

          <h1 className="text-2xl font-black mb-1">{t("Checkout.order_summary", "Resumen de tu Orden")}</h1>
          <p className="text-xs text-emerald-100/80">
            {t("Checkout.order_summary_desc", "Revisa tus cursos seleccionados antes de completar tu inscripción en la pasarela oficial de Stripe.")}
          </p>
        </div>

        {/* Lista de Cursos incluidos en la compra */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
            {t("Checkout.courses_to_acquire", "Cursos a adquirir")}
          </h3>

          <div className="space-y-3">
            {checkoutItems.map((item) => {
              const courseTitle = translateCourseTitle(item.course.id, item.course.title, t);
              const coachName = translateCoachName(item.course.coach?.name || (item.course as any).author || 'Coach CFH', t);
              const formattedPrice = ((item.course.priceCents || 0) / 100).toLocaleString(locale.toLowerCase(), {
                style: 'currency',
                currency: item.course.currency || activeCurrency,
              });

              return (
                <div key={item.id} className="flex items-center gap-4 bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 dark:bg-slate-700 shrink-0">
                    {item.course.thumbnailUrl ? (
                      <img src={item.course.thumbnailUrl} alt={courseTitle} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-slate-100 line-clamp-1" title={courseTitle}>
                      {courseTitle}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      {t("Checkout.taught_by", "Impartido por")} <span className="font-semibold text-gray-700 dark:text-slate-300">{coachName}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-sm text-cfh-dark-green dark:text-cfh-light-green">
                      {formattedPrice}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desglose de Precios */}
        <div className="p-6 bg-gray-50/50 dark:bg-slate-900/50 space-y-3 text-sm border-b border-gray-100 dark:border-slate-800">
          <div className="flex justify-between text-gray-600 dark:text-slate-400">
            <span>{t("Checkout.subtotal", "Subtotal")}</span>
            <span className="font-semibold text-gray-800 dark:text-slate-200">{formattedTotal}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-slate-400">
            <span>{t("Checkout.taxes_included", "Impuestos (Incluidos)")}</span>
            <span className="font-semibold text-gray-800 dark:text-slate-200">
              {(0).toLocaleString(locale.toLowerCase(), { style: 'currency', currency: activeCurrency })}
            </span>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-slate-800 flex justify-between items-baseline">
            <span className="font-bold text-gray-900 dark:text-slate-100 text-base">{t("Checkout.total_to_pay", "Total a Pagar")}</span>
            <span className="font-black text-2xl text-cfh-dark-green dark:text-cfh-light-green">{formattedTotal}</span>
          </div>
        </div>

        {/* Aviso de Política de Reembolso */}
        <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold">Aviso sobre reembolsos</p>
            <p className="leading-relaxed text-[11px] text-amber-800 dark:text-amber-300">
              Los cursos digitales cuentan con acceso inmediato e irrevocable y <strong>no admiten reembolsos</strong> bajo ninguna circunstancia. Los reembolsos aplican única y exclusivamente para sesiones en vivo de 60 minutos conforme a nuestros Términos y Condiciones.
            </p>
          </div>
        </div>

        {/* Métodos de Pago: Tarjetas Guardadas o Stripe Directo */}
        <div className="p-6 space-y-4">
          {savedCards.length > 0 && (
            <div className="mb-4 space-y-2.5">
              <span className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                {t("Checkout.one_click_title", "Paga con 1 Clic usando una tarjeta guardada")}
              </span>
              <div className="space-y-2">
                {savedCards.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      onClick={() => setSelectedCardId(card.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-xs ring-2 ring-emerald-500/20'
                          : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-cfh-dark-green dark:border-cfh-light-green' : 'border-gray-300 dark:border-slate-600'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-cfh-dark-green dark:bg-cfh-light-green" />}
                        </div>
                        <span className="text-xs font-black uppercase text-gray-700 dark:text-slate-200">
                          {card.brand.toUpperCase()} •••• {card.last4}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          ({t("Checkout.card_expires", "Vence")} {String(card.expMonth).padStart(2, '0')}/{card.expYear})
                        </span>
                      </div>
                      {card.isDefault && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {t("Checkout.default_card", "Predeterminada")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => handleProceedToStripe(true)}
                disabled={isProcessing || !selectedCardId}
                className="w-full mt-2 py-3.5 px-6 rounded-2xl text-white font-black text-sm bg-cfh-dark-green hover:bg-cfh-light-green transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>{t("Checkout.pay_one_click", { total: formattedTotal }, `Pagar con 1 Clic (${formattedTotal})`)}</span>
                  </>
                )}
              </button>
            </div>
          )}

          <button
            onClick={() => handleProceedToStripe(false)}
            disabled={isProcessing}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              savedCards.length > 0
                ? 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200'
                : 'bg-cfh-dark-green hover:bg-cfh-light-green text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t("Checkout.generating_session", "Generando sesión de pago en Stripe...")}</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>{savedCards.length > 0 ? t("Checkout.pay_stripe_other", "+ Pagar con Stripe / Otra tarjeta") : t("Checkout.proceed_secure_payment", { total: formattedTotal }, `Proceder al Pago Seguro (${formattedTotal})`)}</span>
                <ExternalLink className="w-4 h-4 opacity-70" />
              </>
            )}
          </button>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/cursos"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-cfh-dark-green transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("Checkout.back_to_catalog", "Volver al catálogo")}
            </Link>

            <span className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              {t("Checkout.stripe_disclaimer", "Procesado por Stripe. Serás redirigido a Stripe si no usas una tarjeta guardada.")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-cfh-bg dark:bg-slate-950 transition-colors py-12 px-4 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="min-h-[50vh] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-cfh-light-green" />
          </div>
        }
      >
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
