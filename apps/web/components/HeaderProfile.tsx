"use client";

import { createPortal } from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { signOut as nextAuthSignOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTranslation } from './TranslationProvider';
import { useAuthModal } from '../context/AuthModalContext';
import { useCart } from '../context/CartContext';
import { switchUserRole } from '@/app/actions/onboarding';
import { GraduationCap, ArrowLeftRight, Briefcase, Sparkles, Calendar, Pencil } from 'lucide-react';

export default function HeaderProfile({ initialUser = null }: { initialUser?: any }) {
  const pathname = usePathname();
  const { t, locale } = useTranslation();
  const locPrefix = locale ? '/' + locale : '';
  const makeHref = (p: string): string => {
    if (!p) return locPrefix || '/';
    if (p === '/') return locPrefix || '/';
    if (locPrefix && (p === locPrefix || p.startsWith(locPrefix + '/'))) return p;
    const match = p.match(/^\/([a-z]{2})(?:\/|$)/);
    if (match) return p;
    return `${locPrefix}${p.startsWith('/') ? p : `/${p}`}`;
  };
  const { clearCart } = useCart();
  const [session, setSession] = useState<{ user: any } | null>(initialUser ? { user: initialUser } : null);
  useEffect(() => {
    if (initialUser) {
      setSession({ user: initialUser });
      setStatus('authenticated');
    } else {
      setSession(null);
      setStatus('unauthenticated');
    }
  }, [JSON.stringify(initialUser)]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(initialUser ? 'authenticated' : 'unauthenticated');
  const { openLogin, openRegister } = useAuthModal();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú al hacer clic fuera o presionar la tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Sincronizar en tiempo real fotos independientes de Aprendiz y Coach
  useEffect(() => {
    const handleUserAvatarUpdate = (e: any) => {
      const newUrl = e.detail;
      setSession((prev) => {
        if (!prev?.user) return prev;
        return {
          ...prev,
          user: {
            ...prev.user,
            avatarUrl: newUrl,
            image: newUrl,
          },
        };
      });
    };

    const handleCoachAvatarUpdate = (e: any) => {
      const newUrl = e.detail;
      setSession((prev) => {
        if (!prev?.user) return prev;
        return {
          ...prev,
          user: {
            ...prev.user,
            coachPhotoUrl: newUrl,
          },
        };
      });
    };

    window.addEventListener("cfh:user-avatar-updated", handleUserAvatarUpdate);
    window.addEventListener("cfh:coach-avatar-updated", handleCoachAvatarUpdate);
    return () => {
      window.removeEventListener("cfh:user-avatar-updated", handleUserAvatarUpdate);
      window.removeEventListener("cfh:coach-avatar-updated", handleCoachAvatarUpdate);
    };
  }, []);



  const handleSignOut = async () => {
    setIsSigningOut(true);
    // 1. Resetear el estado global del carrito y limpiar almacenamiento local/sesión
    try {
      clearCart();
      localStorage.removeItem("cfh_community_draft");
    } catch (e) {
      console.error("Error clearing cart on sign out:", e);
    }

    // 2. Cerrar sesión en el backend personalizado
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error("Error logging out from custom API:", e);
    }

    // 3. Cerrar sesión en NextAuth
    try {
      await nextAuthSignOut({ redirect: false });
    } catch (e) {
      console.error("Error logging out from NextAuth:", e);
    }

    window.location.href = makeHref('/');
  };

  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const user = session?.user;
  const initialRole = user?.activeRole || user?.role;
  const [activeRole, setActiveRole] = useState(initialRole);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookieRole = document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1];
      if (cookieRole && cookieRole !== activeRole) {
        setActiveRole(cookieRole);
      }
    }
  }, [user]);

  const isOnboarding = pathname?.includes('/onboarding');
  const isCoachMode = activeRole === 'COACH';
  const isCoach = isCoachMode;
  const hasCoachProfile = Boolean(user?.coachProfile);
  const hasStudentOnboarding = Boolean(
    user?.onboardingCompletedAt ||
    (Array.isArray(user?.interests) && user.interests.length > 0)
  );

  const handleRoleSwitch = async (targetRole: 'COACH' | 'STUDENT') => {
    setIsSwitchingRole(true);
    try {
      const res = await switchUserRole(targetRole);
      if (res.success && res.redirectTo) {
        const dest = res.redirectTo.startsWith('/') ? makeHref(res.redirectTo) : res.redirectTo;
        window.location.href = dest;
      } else if (res.needsOnboarding && res.redirectTo) {
        const dest = res.redirectTo.startsWith('/') ? makeHref(res.redirectTo) : res.redirectTo;
        window.location.href = dest;
      } else {
        alert(res.error || 'Error al cambiar de rol.');
        setIsSwitchingRole(false);
      }
    } catch (err) {
      console.error("Error switching role:", err);
      setIsSwitchingRole(false);
    }
  };

  if (status === 'loading') {
    return <div className="pl-4 border-l border-gray-200 dark:border-slate-700 animate-pulse w-24 h-9 bg-gray-100 dark:bg-slate-800 rounded-lg" />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-1 sm:gap-2.5 pl-1.5 sm:pl-3 border-l border-gray-200 dark:border-slate-700">
        <button
          onClick={openLogin}
          className="text-xs sm:text-sm lg:text-base font-extrabold text-gray-800 dark:text-slate-200 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors px-1.5 sm:px-2 py-1 sm:py-2 cursor-pointer whitespace-nowrap"
        >
          {t('Header.login', 'Iniciar Sesión')}
        </button>
        <button
          onClick={openRegister}
          className="inline-flex text-xs sm:text-sm lg:text-base font-extrabold bg-[#548BB0] hover:bg-[#3d6986] text-white px-2.5 sm:px-5 lg:px-6 py-1.5 sm:py-2 lg:py-2.5 rounded-full shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
        >
          {t('Header.register', 'Registrarse')}
        </button>
      </div>
    );
  }

  const rawAvatar = (() => {
    const user = session?.user;
    if (isCoachMode) {
      // En modo Coach: SOLO la foto del coach (si no puso foto, retorna null para no mostrar la de aprendiz)
      return user?.coachPhotoUrl || user?.coachProfile?.photoUrl || null;
    }
    // En modo Aprendiz: SOLO la foto del aprendiz
    return user?.avatarUrl || user?.image || null;
  })();
  
  const displayUserName = (isCoachMode && ((session?.user as any)?.coachName || (session?.user as any)?.coachProfile?.displayName)) 
    ? ((session?.user as any)?.coachName || (session?.user as any)?.coachProfile?.displayName)
    : (session?.user?.name || 'Usuario');
    
  const avatarSrc = (rawAvatar && !rawAvatar.startsWith("/avatars/"))
    ? rawAvatar
    : isCoachMode
      ? `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(displayUserName)}&backgroundColor=04101e&textColor=ffffff`
      : `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(displayUserName)}`;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link
        href={makeHref("/messages")}
        title={t('Header.messages', 'Mis Mensajes')}
        className="flex p-2 text-gray-500 dark:text-slate-400 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </Link>

      <div ref={menuRef} className="relative">
        {/* Avatar + nombre */}
        <div
          className={`flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-gray-200 dark:border-slate-700 ${!isOnboarding ? 'cursor-pointer' : ''}`}
          onClick={() => !isOnboarding && setIsOpen(!isOpen)}
        >
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-inner flex-shrink-0">
            <img 
              src={avatarSrc} 
              alt="Profile" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="hidden 2xl:block max-w-[125px]">
            <p className="text-sm font-bold leading-none text-gray-900 dark:text-slate-100 truncate" title={displayUserName}>
              {displayUserName}
            </p>
            {!isOnboarding && <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1 truncate">{t('Header.my_profile')}</p>}
          </div>
          {/* Chevron */}
          {!isOnboarding && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`hidden sm:block text-gray-400 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 py-2 z-50">
            {!isOnboarding && (
              <>
                {/* 1. Mi Perfil */}
              <Link
                href={isCoach ? makeHref("/coach/profile") : makeHref("/dashboard/profile")}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <span className="font-semibold">{t('Header.my_profile')}</span>
              </Link>

              {isCoach && (
                <Link
                  href={makeHref("/coach/onboarding?edit=true")}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors font-medium"
                >
                  <Pencil className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold">{t('CoachDashboard.edit_profile', 'Editar Perfil')}</span>
                </Link>
              )}

              {/* Mensajes */}
              <Link
                href={makeHref("/messages")}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span className="font-semibold">{t('Header.messages') || "Mensajes"}</span>
              </Link>

            <div className="border-t border-gray-100 dark:border-slate-800 my-1" />

            {/* Si es COACH */}
            {isCoach ? (
              <>
                {hasCoachProfile ? (
                  <>
                    <Link
                      href={makeHref("/coach/dashboard")}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                      </svg>
                      <span className="font-medium">{t('Header.coach_panel') || "Portal de Coach"}</span>
                    </Link>

                    <Link
                      href={makeHref("/coach/availability")}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>{t('Header.my_schedule') || "Mis Horarios"}</span>
                    </Link>

                    <Link
                      href={makeHref("/coach/billing")}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-credit-card">
                        <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
                      </svg>
                      <span>{t('Navigation.billing', 'Suscripciones y Pagos')}</span>
                    </Link>
                  </>
                ) : (
                  <Link
                    href={makeHref("/coach/onboarding")}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors font-bold"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('Header.continue_coach_registration', 'Continuar Registro de Coach')}</span>
                  </Link>
                )}

                {/* Cambiar a Aprendiz (solo si ya tiene onboarding de alumno o puede iniciarlo) */}

                <div className="border-t border-gray-100 dark:border-slate-800 my-1" />

                {hasStudentOnboarding ? (
                  <button
                    type="button"
                    disabled={isSwitchingRole}
                    onClick={async () => {
                      setIsOpen(false);
                      await handleRoleSwitch('STUDENT');
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors font-medium disabled:opacity-60 cursor-pointer"
                  >
<GraduationCap className="w-4 h-4" />
                      <span>{isSwitchingRole ? (t('Header.switching') || "Cambiando...") : (t('Header.switch_to_student') || "Cambiar a Modo Aprendiz")}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      handleRoleSwitch("STUDENT");
                    }}
                    disabled={isSwitchingRole}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 transition-colors font-medium cursor-pointer dark:text-blue-400 dark:hover:bg-blue-900/30"
                  >
                    <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>{isSwitchingRole ? (t('Header.switching') || "Cambiando...") : (t('Header.want_to_be_student') || "Quiero ser Aprendiz")}</span>
                  </button>
                )}

              </>
            ) : (
              /* Si es ESTUDIANTE / ALUMNO */
              <>
                <Link
                  href={makeHref("/dashboard")}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                  <span>{t('Navigation.my_learning', 'Mi Aprendizaje')}</span>
                </Link>

                <div className="border-t border-gray-100 dark:border-slate-800 my-1" />

                {hasCoachProfile ? (
                  <button
                    type="button"
                    disabled={isSwitchingRole}
                    onClick={async () => {
                      setIsOpen(false);
                      await handleRoleSwitch('COACH');
                    }}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors font-medium disabled:opacity-60 cursor-pointer"
                  >
<Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{isSwitchingRole ? (t('Header.switching') || "Cambiando...") : (t('Header.switch_to_coach') || "Cambiar a Modo Coach")}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      handleRoleSwitch("COACH");
                    }}
                    disabled={isSwitchingRole}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors font-medium cursor-pointer dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                  >
                    <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{isSwitchingRole ? (t('Header.switching') || "Cambiando...") : (t('Header.want_to_be_coach') || "Quiero Enseñar")}</span>
                  </button>
                )}
              </>
            )}

              </>
            )}

            {!isOnboarding && <div className="border-t border-gray-100 dark:border-slate-800 my-1" />}

            {/* 3. Cerrar Sesión */}
            <button
              onClick={() => {
                setIsOpen(false);
                handleSignOut();
              }}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 transition-colors font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {t('Header.sign_out') || "Cerrar Sesión"}
            </button>
          </div>
        )}
        {isSwitchingRole && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[999999] bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center m-0 p-0">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-cfh-dark-green border-t-transparent dark:border-cfh-light-green dark:border-t-transparent mb-4"></div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">{t('Overlay.preparing_environment', 'Preparando tu entorno...')}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">{t('Overlay.switching_role', 'Cambiando de rol')}</p>
          </div>,
          document.body
        )}
              {isSigningOut && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[999999] bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center m-0 p-0">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent dark:border-red-400 dark:border-t-transparent mb-4"></div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">{t('Overlay.signing_out_title', "Cerrando sesión...")}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">{t('Overlay.signing_out_desc', "Hasta pronto, vuelve pronto")}</p>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

