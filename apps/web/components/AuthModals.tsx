'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn as nextAuthSignIn } from 'next-auth/react';
import { useAuthModal } from '../context/AuthModalContext';
import { useTranslation } from './TranslationProvider';
import { useScrollLock } from '@/lib/scroll-lock';
import FullScreenSuspensionScreen from './FullScreenSuspensionScreen';

/**
 * AuthModals Component
 * Renderiza los modales flotantes para Iniciar Sesión y Registrarse.
 * Utiliza el sistema de autenticación propio (/api/auth/login y /api/auth/register)
 * para que la cookie de sesión quede disponible en los Server Actions.
 *
 * Flujo de Registro:
 * 1. El usuario selecciona su rol (Quiero Aprender / Quiero Enseñar).
 * 2. El usuario ingresa sus credenciales.
 * 3. Se llama a /api/auth/register y luego a /api/auth/login para crear la sesión.
 * 4. Si el rol es COACH, se redirige al onboarding; de lo contrario, se recarga.
 */
export default function AuthModals() {
  const { t, locale } = useTranslation();
  const { 
    isLoginOpen, 
    isRegisterOpen, 
    initialRegisterRole, 
    openLogin,
    openRegister,
    closeLogin, 
    closeRegister, 
    switchToLogin, 
    switchToRegister 
  } = useAuthModal();

  // Register state
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<'STUDENT' | 'COACH' | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [suspensionModal, setSuspensionModal] = useState<any | null>(null);

  // Referencia para procesar parámetros de URL solo una vez al montar y no reabrir tras cerrar
  const hasHandledUrlAuth = React.useRef(false);

  // Escuchar parámetros de autenticación en la URL (p.ej. /?auth=login&callbackUrl=/checkout) sólo una vez al montar
  React.useEffect(() => {
    if (typeof window !== 'undefined' && !hasHandledUrlAuth.current) {
      hasHandledUrlAuth.current = true;
      const params = new URLSearchParams(window.location.search);
      const authParam = params.get('auth');
      const alreadyReg = params.get('alreadyRegistered');
      const emailParam = params.get('email');

      if (alreadyReg === 'true') {
        if (emailParam) setEmail(emailParam);
        setError(t("auth.already_registered_notice", "Esta cuenta ya está registrada. Por favor, inicia sesión."));
        openLogin();
      } else if (authParam === 'login') {
        openLogin();
      } else if (authParam === 'register') {
        openRegister();
      }
    }
  }, [openLogin, openRegister, t]);

  React.useEffect(() => {
    if (isRegisterOpen && initialRegisterRole) {
      setRole(initialRegisterRole);
      setRegisterStep(2);
    }
  }, [isRegisterOpen, initialRegisterRole]);

  // Bloqueo total de scroll de fondo mientras cualquier modal de autenticación esté abierto
  useScrollLock(isLoginOpen || isRegisterOpen || Boolean(suspensionModal));

  // Cerrar modal al presionar la tecla Escape
  React.useEffect(() => {
    if (!isLoginOpen && !isRegisterOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoginOpen, isRegisterOpen, loading]);

  const resetState = () => {
    setRegisterStep(1);
    setRole(null);
    setEmail('');
    setError('');
    setSuspensionModal(null);
  };

  const handleClose = () => {
    closeLogin();
    closeRegister();
    setTimeout(resetState, 200);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.has('auth')) {
        url.searchParams.delete('auth');
        changed = true;
      }
      if (url.searchParams.has('alreadyRegistered')) {
        url.searchParams.delete('alreadyRegistered');
        changed = true;
      }
      if (url.searchParams.has('email')) {
        url.searchParams.delete('email');
        changed = true;
      }
      if (changed) {
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    }
  };

  if (!isLoginOpen && !isRegisterOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={loading ? undefined : handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md max-h-[92vh] overflow-y-auto overscroll-contain bg-white dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl z-10 p-5 sm:p-8"
        >
          {/* Botón Cerrar */}
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!loading) handleClose();
            }}
            aria-label={t("common.close", "Cerrar")}
            className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          {isLoginOpen && (
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-cfh-text dark:text-slate-100 mb-2">
                {t("auth.welcome_back_title", "Bienvenido de nuevo")}
              </h2>
              <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 mb-6">
                {t("auth.welcome_back_desc", "Ingresa a tu cuenta para continuar aprendiendo o enseñando.")}
              </p>

              {error && <div className="p-3 mb-4 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900">{error}</div>}

              <button 
                type="button" 
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  const callbackUrl = `/api/auth/oauth-redirect?flow=login`;
                  nextAuthSignIn("google", { callbackUrl });
                }}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-bold py-3.5 rounded-xl border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition-all disabled:opacity-70 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t("auth.signing_in", "Ingresando...")}
                  </span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
                      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                    {t("auth.continue_with_google", "Continuar con Google")}
                  </>
                )}
              </button>

              <div className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
                {t("auth.no_account", "¿No tienes cuenta?")}{' '}
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    switchToRegister();
                  }}
                  className="text-cfh-dark-green dark:text-cfh-light-green font-bold hover:underline cursor-pointer"
                >
                  {t("auth.register_here", "Regístrate aquí")}
                </button>
              </div>
            </div>
          )}

          {isRegisterOpen && (
            <div>
              {registerStep === 1 && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-cfh-text dark:text-slate-100 mb-2">
                    {t("auth.join_community_title", "Únete a la comunidad")}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 mb-6 sm:mb-8">
                    {t("auth.how_to_use", "¿Cómo te gustaría usar la plataforma?")}
                  </p>

                  <div className="flex flex-col gap-4">
                    <button 
                      type="button"
                      onClick={() => { setRole('STUDENT'); setRegisterStep(2); }}
                      className="group flex items-center p-5 border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 rounded-2xl hover:border-cfh-light-green dark:hover:border-cfh-light-green transition-all text-left cursor-pointer"
                    >
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-cfh-text dark:text-slate-100 text-lg">
                          {t("auth.student_role_title", "Quiero Aprender (Aprendiz)")}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {t("auth.student_role_desc", "Busco cursos y sesiones de 60 min.")}
                        </p>
                      </div>
                    </button>

                    <button 
                      type="button"
                      onClick={() => { setRole('COACH'); setRegisterStep(2); }}
                      className="group flex items-center p-5 border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 rounded-2xl hover:border-cfh-light-green dark:hover:border-cfh-light-green transition-all text-left cursor-pointer"
                    >
                      <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-cfh-text dark:text-slate-100 text-lg">
                          {t("auth.coach_role_title", "Quiero Enseñar (Coach)")}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {t("auth.coach_role_desc", "Quiero ofrecer cursos y mentorías.")}
                        </p>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}

              {registerStep === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <button 
                    type="button"
                    onClick={() => setRegisterStep(1)}
                    className="flex items-center text-sm font-bold text-gray-500 dark:text-slate-400 hover:text-cfh-dark-green dark:hover:text-cfh-light-green mb-6 transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><polyline points="15 18 9 12 15 6"/></svg>
                    {t("common.back", "Atrás")}
                  </button>

                  <h2 className="text-2xl font-extrabold text-cfh-text dark:text-slate-100 mb-2">
                    {role === 'STUDENT' ? t("auth.create_account_student", "Registro de Aprendiz") : t("auth.create_account_coach", "Registro de Coach")}
                  </h2>
                  <p className="text-gray-500 dark:text-slate-400 mb-6">{t("auth.create_account_desc", "Crea tu cuenta para comenzar.")}</p>

                  <div className="flex flex-col gap-4">
                    {error && <div className="p-3 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900">{error}</div>}
                    
                    <button 
                      type="button" 
                      disabled={loading}
                      onClick={() => {
                        setLoading(true);
                        const explicitRole = role === 'COACH' ? 'COACH' : 'STUDENT';
                        const callbackUrl = `/api/auth/oauth-redirect?flow=register&role=${explicitRole}`;
                        nextAuthSignIn("google", { callbackUrl });
                      }}
                      className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-bold py-3.5 rounded-xl border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition-all disabled:opacity-70 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                      </svg>
                      {t("auth.register_with_google", "Registrarse con Google")}
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="mt-6 text-center text-sm text-gray-500 dark:text-slate-400">
                {t("auth.already_have_account", "¿Ya tienes cuenta?")}{' '}
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    switchToLogin();
                  }}
                  className="text-cfh-dark-green dark:text-cfh-light-green font-bold hover:underline cursor-pointer"
                >
                  {t("auth.login_here", "Inicia sesión")}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {suspensionModal && (
        <FullScreenSuspensionScreen
          details={suspensionModal}
          onDismiss={() => setSuspensionModal(null)}
        />
      )}
    </AnimatePresence>
  );
}
