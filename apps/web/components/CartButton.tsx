"use client";

import React, { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export default function CartButton() {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  const pathname = usePathname();
  const { totalItems, setIsOpen } = useCart();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const cookieRole = isMounted && typeof document !== "undefined"
    ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
    : null;
  const activeRole = cookieRole || (session?.user as any)?.activeRole || (session?.user as any)?.role;

  // Carrito de compras es exclusivo para el flujo de aprendizaje del estudiante
  if (pathname?.includes('/onboarding') || pathname?.startsWith('/coach') || activeRole === 'COACH') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="p-2 text-gray-600 hover:text-cfh-dark-green transition-colors rounded-full hover:bg-gray-100 relative focus:outline-none cursor-pointer"
      title="Carrito de Compras"
      aria-label="Abrir carrito de compras"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      {mounted && totalItems > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-cfh-light-green text-cfh-dark-green text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs">
          {totalItems > 9 ? "9+" : totalItems}
        </span>
      )}
    </button>
  );
}
