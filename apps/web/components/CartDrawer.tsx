"use client";

import React, { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { useAuthModal } from "../context/AuthModalContext";
import { useSession } from "next-auth/react";
import { useTranslation } from "./TranslationProvider";
import { translateCoachName, translateCourseTitle } from "@/lib/i18n-helpers";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CoachSwitchToStudentModal from "./CoachSwitchToStudentModal";
import { useScrollLock } from "@/lib/scroll-lock";

export default function CartDrawer() {
  const pathname = usePathname();
  const isCheckoutRoute = pathname === "/checkout" || pathname?.startsWith("/checkout");
  const { t, locale } = useTranslation();
  const { items, isOpen, setIsOpen, removeItem, totalCents, totalItems, toastMessage, clearToast } = useCart();
  const { openLogin } = useAuthModal();
  const { data: session } = useSession();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"cart" | "history">("cart");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);

  // Bloquear el scroll de fondo cuando el carrito esté abierto
  useScrollLock(isOpen && !isCheckoutRoute);

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

  useEffect(() => {
    if (isOpen && activeTab === "history" && purchases.length === 0) {
      fetchPurchases();
    }
  }, [isOpen, activeTab]);

  const fetchPurchases = async () => {
    setLoadingPurchases(true);
    try {
      const res = await fetch("/api/purchases");
      if (res.ok) {
        const data = await res.json();
        setPurchases(data.purchases || []);
      }
    } catch (e) {
      console.error("Error fetching purchases", e);
    } finally {
      setLoadingPurchases(false);
    }
  };

  return (
    <>
      {/* Toast Animado al Agregar al Carrito */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border border-emerald-500/40 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div className="flex-1 text-xs font-semibold">
            {toastMessage}
          </div>
          <button
            onClick={() => {
              clearToast();
              setIsOpen(true);
            }}
            className="text-xs font-bold text-cfh-light-green hover:underline cursor-pointer ml-1"
          >
            {t("Cart.view_cart", "Ver Carrito")}
          </button>
          <button
            onClick={clearToast}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {isOpen && !isCheckoutRoute && (
        <>
          <div 
            className="fixed inset-0 bg-cfh-dark-green/30 dark:bg-black/60 z-50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
      <div className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-[#F8FAFC] dark:bg-slate-950 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 rounded-l-none sm:rounded-l-3xl overflow-hidden overscroll-contain border-l border-transparent dark:border-slate-800">
        
        {/* Header */}
        <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-2xl text-cfh-dark-green dark:text-cfh-light-green flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cfh-light-green"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
              {t("Cart.my_cart", "Mi Carrito")}
            </h2>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 text-gray-400 dark:text-slate-400 hover:text-cfh-dark-green dark:hover:text-cfh-light-green hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-full transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
            <button 
              onClick={() => setActiveTab("cart")}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'cart' ? 'bg-white dark:bg-slate-700 text-cfh-dark-green dark:text-cfh-light-green shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              {t("Cart.pending", "Pendientes")} ({totalItems})
            </button>
            <button 
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-cfh-dark-green dark:text-cfh-light-green shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              {t("Cart.history", "Historial de Compras")}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "cart" ? (
            items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-slate-400 animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-white dark:bg-slate-900 shadow-sm rounded-full flex items-center justify-center mb-6 text-emerald-100 dark:text-emerald-900/40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                </div>
                <h3 className="font-extrabold text-gray-900 dark:text-slate-100 text-xl mb-2">{t("Cart.empty_title", "Tu carrito está vacío")}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 max-w-[250px]">{t("Cart.empty_desc", "Descubre nuevos cursos y comienza a transformar tu futuro hoy mismo.")}</p>
                <Link 
                  href={`/${locale}/cursos`} 
                  onClick={() => setIsOpen(false)} 
                  className="mt-8 px-8 py-3.5 bg-cfh-dark-green hover:bg-cfh-light-green text-white rounded-2xl font-bold text-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                >
                  {t("Cart.explore_courses", "Explorar cursos")}
                </Link>
              </div>
            ) : (
              <ul className="space-y-3.5">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3.5 p-3.5 sm:p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-950/60 transition-all group">
                    <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-50 dark:bg-slate-800 relative border border-gray-100 dark:border-slate-700/80">
                      {item.course.thumbnailUrl ? (
                        <img src={item.course.thumbnailUrl} alt={item.course.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-600 bg-gray-100/50 dark:bg-slate-800">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green transition-colors">
                          {translateCourseTitle(item.course.id, item.course.title, t)}
                        </h4>
                        <p className="text-xs font-medium text-gray-400 dark:text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          <span className="truncate">{translateCoachName(item.course.coach?.name || "Coach", t)}</span>
                        </p>
                      </div>
                      <div className="flex items-baseline justify-between mt-2">
                        <p className="font-extrabold text-cfh-light-green text-sm sm:text-base">
                          {(item.course.priceCents / 100).toLocaleString(locale.toLowerCase(), { style: "currency", currency: item.course.currency })}
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="shrink-0 p-2 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all cursor-pointer self-center"
                      title={t("Cart.remove", "Eliminar del carrito")}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            /* HISTORY TAB */
            loadingPurchases ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cfh-light-green"></div>
              </div>
            ) : purchases.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-slate-400 animate-in fade-in duration-300">
                <div className="w-24 h-24 bg-white dark:bg-slate-900 shadow-sm rounded-full flex items-center justify-center mb-6 text-gray-200 dark:text-slate-800">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                </div>
                <h3 className="font-extrabold text-gray-900 dark:text-slate-100 text-xl mb-2">{t("Cart.no_purchases_title", "Aún no hay compras")}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">{t("Cart.no_purchases_desc", "Los cursos que adquieras aparecerán aquí.")}</p>
              </div>
            ) : (
              <ul className="space-y-4 animate-in fade-in duration-300">
                {purchases.map((purchase) => (
                  <Link href={`/${locale}/cursos/${purchase.course.id}`} onClick={() => setIsOpen(false)} key={purchase.id} className="block">
                    <li className="flex gap-4 p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[1.5rem] shadow-sm hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-900 transition-all group">
                      <div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-800 relative">
                        {purchase.course.thumbnailUrl ? (
                          <img src={purchase.course.thumbnailUrl} alt={translateCourseTitle(purchase.course.id, purchase.course.title, t)} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path></svg>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <span className="text-xs uppercase font-bold text-cfh-light-green tracking-wider mb-1">
                          {t("Cart.acquired_on", "Adquirido el")} {new Date(purchase.enrolledAt || purchase.createdAt).toLocaleDateString(locale.toLowerCase())}
                        </span>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-slate-100 leading-tight mb-1 line-clamp-2 group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green transition-colors">
                          {translateCourseTitle(purchase.course.id, purchase.course.title, t)}
                        </h4>
                        <p className="text-xs font-medium text-gray-400 dark:text-slate-500">
                          {t("CoursesDirectory.by", "Por")} {translateCoachName(purchase.course.coach.name, t)}
                        </p>
                      </div>
                    </li>
                  </Link>
                ))}
              </ul>
            )
          )}
        </div>

        {/* Footer Checkout (Only on Cart Tab) */}
        {activeTab === "cart" && items.length > 0 && (
          <div className="p-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shadow-[0_-10px_40px_rgb(0,0,0,0.03)]">
            <div className="flex justify-between items-end mb-6 px-2">
              <span className="font-bold text-gray-500 dark:text-slate-400 text-sm uppercase tracking-wide">{t("Cart.total_to_pay", "Total a Pagar")}</span>
              <span className="font-black text-3xl text-cfh-dark-green dark:text-cfh-light-green leading-none">
                {(totalCents / 100).toLocaleString(locale.toLowerCase(), { style: "currency", currency: items[0]?.course?.currency || "USD" })}
              </span>
            </div>
            <Link 
              href="/checkout"
              onClick={(e) => {
                const isAuthed = Boolean(session?.user || currentUser);
                if (!isAuthed) {
                  e.preventDefault();
                  setIsOpen(false);
                  openLogin();
                  return;
                }
                const cookieRole = typeof document !== "undefined"
                  ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
                  : null;
                const activeRole = cookieRole || currentUser?.activeRole || currentUser?.role || (session?.user as any)?.activeRole || (session?.user as any)?.role;
                if (activeRole === "COACH") {
                  e.preventDefault();
                  setIsOpen(false);
                  setShowCoachModal(true);
                  return;
                }
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-center gap-3 py-4 bg-cfh-dark-green text-white rounded-2xl font-bold text-base hover:bg-cfh-light-green hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer"
            >
              {t("Cart.complete_purchase", "Completar Compra")}
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </Link>
          </div>
        )}
      </div>
        </>
      )}

      <CoachSwitchToStudentModal
        isOpen={showCoachModal}
        onClose={() => setShowCoachModal(false)}
      />
    </>
  );
}
