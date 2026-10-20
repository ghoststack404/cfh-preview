"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export interface CartItemType {
  id: string; // The cart item ID in DB, or local unique ID
  courseId: string;
  course: {
    id: string;
    title: string;
    priceCents: number;
    currency: string;
    thumbnailUrl: string | null;
    coach: { name: string };
  };
}

export interface CartCourseData {
  id: string;
  title: string;
  priceCents: number;
  currency?: string;
  thumbnailUrl?: string | null;
  coach?: { name: string };
  author?: string;
}

interface CartContextProps {
  items: CartItemType[];
  isLoading: boolean;
  addItem: (
    courseId: string, 
    courseData?: Partial<CartCourseData>, 
    options?: { openDrawer?: boolean }
  ) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => void;
  isInCart: (courseId: string) => boolean;
  totalItems: number;
  totalCents: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toastMessage: string | null;
  clearToast: () => void;
}

const CartContext = createContext<CartContextProps | undefined>(undefined);

export const GUEST_STORAGE_KEY = "cfh_cart_guest";
export const LEGACY_STORAGE_KEY = "cfh_cart_items";

export function getCartStorageKey(userId?: string | null): string {
  if (userId && typeof userId === "string" && userId.trim() !== "" && userId !== "undefined" && userId !== "null") {
    return `cfh_cart_${userId.trim()}`;
  }
  return GUEST_STORAGE_KEY;
}

function readStorageCart(key: string): CartItemType[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn(`[CartContext] Error leyendo carrito de ${key}:`, err);
  }
  return [];
}

function writeStorageCart(key: string, items: CartItemType[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`[CartContext] Error guardando carrito en ${key}:`, err);
  }
}

export function cleanAllCartStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(GUEST_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    sessionStorage.removeItem(GUEST_STORAGE_KEY);

    const removeMatching = (storage: Storage) => {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && (k.startsWith("cfh_cart") || k.startsWith("cart_"))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k));
    };

    removeMatching(localStorage);
    removeMatching(sessionStorage);
  } catch (e) {
    console.warn("[CartContext] No se pudo limpiar almacenamiento del carrito:", e);
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const pathname = usePathname();
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(null);

  const clearToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToastMessage(null);
  }, []);

  // Auto-cerrar drawer al estar en la ruta de checkout
  useEffect(() => {
    if (pathname === "/checkout" || pathname?.startsWith("/checkout")) {
      setIsOpen(false);
    }
  }, [pathname]);

  // 1. Inicializar en el cliente
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Limpiar claves obsoletas o remanentes de invitados en localStorage
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}

    setItems([]);
    setIsLoading(false);
  }, []);

  // 2. Sincronizar el ID de usuario activo de forma infalible (tanto NextAuth como cookies personalizadas)
  useEffect(() => {
    let isMounted = true;

    const resolveActiveUser = async () => {
      // Intentar obtener de NextAuth si está disponible
      const sessionUserId = (session?.user as any)?.id;
      if (sessionUserId) {
        if (isMounted) setActiveUserId(String(sessionUserId));
        return;
      }

      // Siempre consultar /api/auth/me para obtener el usuario activo por cookie de sesión
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" }
        });
        if (res.ok) {
          const data = await res.json();
          const u = data?.user || data?.data?.user;
          if (u?.id) {
            if (isMounted) setActiveUserId(String(u.id));
            return;
          }
        }
      } catch (err) {
        console.warn("[CartContext] Error comprobando sesión activa en /api/auth/me:", err);
      }

      if (isMounted) {
        setActiveUserId(null);
      }
    };

    resolveActiveUser();

    return () => {
      isMounted = false;
    };
  }, [session, sessionStatus, pathname]);

  // 3. Manejo de cambio de usuario / Login / Logout
  useEffect(() => {
    const prevId = previousUserIdRef.current;
    previousUserIdRef.current = activeUserId;

    // Si el usuario cerró sesión o no está autenticado (sin sesión)
    if (!activeUserId) {
      setItems([]);
      try {
        localStorage.removeItem(GUEST_STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {}
      setIsLoading(false);
      return;
    }

    // Si el usuario acaba de autenticarse
    setIsLoading(true);
    const userStorageKey = getCartStorageKey(activeUserId);

    // Cargar caché local del usuario para respuesta instantánea
    const userLocalItems = readStorageCart(userStorageKey);
    if (userLocalItems.length > 0) {
      setItems(userLocalItems);
    }

    let isMounted = true;

    const hydrateAndSync = async () => {
      const guestItems = readStorageCart(GUEST_STORAGE_KEY);
      // 1. Si había ítems agregados como invitado antes de hacer login, migrarlos y persistirlos en la BD
      if (guestItems.length > 0) {
        try {
          await Promise.all(
            guestItems.map((gItem) =>
              fetch("/api/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courseId: gItem.courseId, courseData: gItem.course }),
              }).catch((e) => console.warn("[CartContext] Error migrando guest item:", e))
            )
          );
          // Limpiar el carrito de invitado una vez transferido a la cuenta
          try {
            localStorage.removeItem(GUEST_STORAGE_KEY);
          } catch {}
        } catch (mergeErr) {
          console.warn("[CartContext] Error en proceso de merge:", mergeErr);
        }
      }

      // 2. Sincronizar con la API del servidor (Base de datos) como fuente canónica de verdad
      try {
        const res = await fetch("/api/cart");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && Array.isArray(data.items)) {
            setItems(data.items);
            writeStorageCart(userStorageKey, data.items);
          }
        }
      } catch (e) {
        console.warn("[CartContext] Error consultando el carrito del usuario:", e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    hydrateAndSync();

    return () => {
      isMounted = false;
    };
  }, [activeUserId]);

  const clearCart = useCallback(() => {
    setItems([]);
    cleanAllCartStorage();
  }, []);

  const isInCart = useCallback(
    (courseId: string) => {
      return items.some((item) => item.courseId === courseId || item.course?.id === courseId);
    },
    [items]
  );

  const addItem = async (
    courseId: string, 
    courseData?: Partial<CartCourseData>,
    options: { openDrawer?: boolean } = { openDrawer: true }
  ) => {
    try {
      const shouldOpen = options?.openDrawer !== false;

      // Si ya está en el carrito, solo abrimos el drawer si shouldOpen es true
      if (isInCart(courseId)) {
        if (shouldOpen) {
          setIsOpen(true);
        }
        return;
      }

      // Creación optimista local
      const optimisticItem: CartItemType = {
        id: `local-${courseId}-${Date.now()}`,
        courseId,
        course: {
          id: courseId,
          title: courseData?.title || "Curso",
          priceCents: courseData?.priceCents ?? 0,
          currency: courseData?.currency || "USD",
          thumbnailUrl: courseData?.thumbnailUrl || null,
          coach: {
            name: courseData?.coach?.name || courseData?.author || "Coach CFH",
          },
        },
      };

      // Si activeUserId aún no está resuelto en el estado, resolverlo de inmediato
      let uid = activeUserId;
      if (!uid) {
        try {
          const meRes = await fetch("/api/auth/me", { cache: "no-store" });
          if (meRes.ok) {
            const meData = await meRes.json();
            const u = meData?.user || meData?.data?.user;
            if (u?.id) {
              uid = String(u.id);
              setActiveUserId(uid);
            }
          }
        } catch {}
      }

      const storageKey = getCartStorageKey(uid);

      setItems((prev) => {
        if (prev.some((it) => it.courseId === courseId || it.course?.id === courseId)) {
          return prev;
        }
        const updated = [...prev, optimisticItem];
        writeStorageCart(storageKey, updated);
        return updated;
      });

      // Feedback inmediato: abrir el drawer del carrito solo si shouldOpen, o mostrar toast animado
      if (shouldOpen) {
        setIsOpen(true);
      } else {
        const title = courseData?.title || "Curso";
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        setToastMessage(`¡"${title}" se agregó a tu carrito!`);
        toastTimeoutRef.current = setTimeout(() => {
          setToastMessage(null);
          toastTimeoutRef.current = null;
        }, 3500);
      }

      // Si está autenticado, sincronizar y persistir en la Base de Datos
      if (uid) {
        try {
          const res = await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseId, courseData }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data?.item?.id) {
              setItems((prev) => {
                const updated = prev.map((it) =>
                  it.courseId === courseId
                    ? {
                        ...it,
                        id: data.item.id,
                        course: data.item.course || it.course,
                      }
                    : it
                );
                writeStorageCart(storageKey, updated);
                return updated;
              });
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            // Revertir agregación optimista si el usuario ya está inscrito o el curso no se puede comprar
            setItems((prev) => {
              const reverted = prev.filter((it) => it.courseId !== courseId && it.course?.id !== courseId);
              writeStorageCart(storageKey, reverted);
              return reverted;
            });
            if (errData?.alreadyEnrolled) {
              if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
              setToastMessage("Ya estás inscrito en este curso. Ya puedes acceder desde tu panel.");
              toastTimeoutRef.current = setTimeout(() => {
                setToastMessage(null);
                toastTimeoutRef.current = null;
              }, 4000);
            } else if (errData?.error) {
              alert(errData.error);
            }
          }
        } catch (apiErr) {
          console.warn("[CartContext] Falló sincronización en segundo plano con API:", apiErr);
        }
      }
    } catch (e) {
      console.error("[CartContext] Error agregando al carrito:", e);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      let uid = activeUserId;
      if (!uid) {
        try {
          const meRes = await fetch("/api/auth/me", { cache: "no-store" });
          if (meRes.ok) {
            const meData = await meRes.json();
            const u = meData?.user || meData?.data?.user;
            if (u?.id) uid = String(u.id);
          }
        } catch {}
      }

      const storageKey = getCartStorageKey(uid);
      setItems((prev) => {
        const updated = prev.filter((i) => i.id !== itemId && i.courseId !== itemId);
        writeStorageCart(storageKey, updated);
        return updated;
      });

      if (uid) {
        try {
          await fetch(`/api/cart?itemId=${itemId}`, { method: "DELETE" });
        } catch (apiErr) {
          console.warn("[CartContext] Error eliminando ítem del backend:", apiErr);
        }
      }
    } catch (e) {
      console.error("[CartContext] Error eliminando del carrito:", e);
    }
  };

  const totalItems = items.length;
  const totalCents = items.reduce((acc, item) => acc + (item.course?.priceCents || 0), 0);

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        addItem,
        removeItem,
        clearCart,
        isInCart,
        totalItems,
        totalCents,
        isOpen,
        setIsOpen,
        toastMessage,
        clearToast,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
