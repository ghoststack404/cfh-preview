"use client";

import React, { useState, useEffect } from "react";
import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useSession } from "next-auth/react";
import { useAuthModal } from "../context/AuthModalContext";
import { useTranslation } from "./TranslationProvider";
import CoachSwitchToStudentModal from "./CoachSwitchToStudentModal";

export interface AddToCartButtonProps {
  courseId: string;
  courseTitle: string;
  price: number; // en dólares/moneda principal (ej. 69)
  author?: string;
  thumbnailUrl?: string | null;
  currency?: string;
  variant?: "icon" | "compact" | "full";
  className?: string;
}

export default function AddToCartButton({
  courseId,
  courseTitle,
  price,
  author = "Coach CFH",
  thumbnailUrl = null,
  currency = "USD",
  variant = "compact",
  className = "",
}: AddToCartButtonProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  const { t } = useTranslation();
  const { addItem, isInCart, setIsOpen } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const { data: session } = useSession();
  const { openLogin } = useAuthModal();
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const alreadyInCart = isInCart(courseId);
  const [showCoachModal, setShowCoachModal] = useState(false);

  const cookieRole = isMounted && typeof document !== "undefined"
    ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
    : null;
  const activeRole = cookieRole || currentUser?.activeRole || currentUser?.role || (session?.user as any)?.activeRole || (session?.user as any)?.role;
  const isCoach = activeRole === "COACH";

  const handleAction = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Evitar navegación si el botón se encuentra dentro de un <Link> de la tarjeta
    e.preventDefault();
    e.stopPropagation();

    // Si el usuario no ha iniciado sesión, interceptar y abrir modal de login/registro
    if (!currentUser && !session?.user) {
      openLogin();
      return;
    }

    // Si el usuario es Coach, requerir cambiar o loguearse como Aprendiz
    if (isCoach) {
      setShowCoachModal(true);
      return;
    }

    if (alreadyInCart) {
      // Si ya está en el carrito, abrimos el drawer directamente
      setIsOpen(true);
      return;
    }

    setIsAdding(true);
    try {
      await addItem(courseId, {
        id: courseId,
        title: courseTitle,
        priceCents: Math.round(price * 100),
        currency,
        thumbnailUrl,
        author,
        coach: { name: author },
      });
    } catch (err) {
      console.error("[AddToCartButton] Error agregando al carrito:", err);
    } finally {
      setIsAdding(false);
    }
  };

  // Estado: Ya está en el carrito
  if (alreadyInCart) {
    return (
      <>
        <button
          type="button"
          onClick={handleAction}
          aria-label={`${t("Cart.in_cart", "En carrito")}: ${courseTitle}`}
          title={t("Cart.already_in_cart_desc", "Curso en el carrito. Haz clic para abrirlo.")}
          className={`group/btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-cfh-dark-green dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 transition-all cursor-pointer ${className}`}
        >
          <Check className="w-3.5 h-3.5 text-cfh-light-green dark:text-emerald-400 shrink-0 stroke-[2.5]" />
          <span className="hidden sm:inline">{t("Cart.in_cart", "En carrito")}</span>
        </button>
        <CoachSwitchToStudentModal
          isOpen={showCoachModal}
          onClose={() => setShowCoachModal(false)}
        />
      </>
    );
  }

  // Estado: Botón de agregar (Idle o Loading)
  return (
    <>
      <button
        type="button"
        onClick={handleAction}
        disabled={isAdding}
        aria-label={`${t("Cart.add_to_cart", "Agregar al carrito")}: ${courseTitle}`}
        title={`${t("Cart.add_to_cart", "Agregar al carrito")} ($${price})`}
        className={`group/btn relative inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-cfh-dark-green hover:bg-cfh-light-green dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-sm shadow-cfh-dark-green/15 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-75 ${className}`}
      >
        {isAdding ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-white" />
            <span className="hidden sm:inline">{t("Cart.adding", "Agregando...")}</span>
          </>
        ) : (
          <>
            <ShoppingCart className="w-3.5 h-3.5 text-white/90 group-hover/btn:scale-110 group-hover/btn:text-white transition-transform shrink-0 stroke-[2.2]" />
            <span className={variant === "icon" ? "sr-only" : "inline"}>
              {variant === "full" ? t("Cart.add_to_cart", "Agregar al carrito") : t("Cart.add", "Agregar")}
            </span>
          </>
        )}
      </button>
      <CoachSwitchToStudentModal
        isOpen={showCoachModal}
        onClose={() => setShowCoachModal(false)}
      />
    </>
  );
}
