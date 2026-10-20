"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";

export function SessionWatcher() {
  const { data: session } = useSession();
  const alertShownRef = useRef(false);
  const [showModal, setShowModal] = useState(false);
  const [errorType, setErrorType] = useState<"SessionConflict" | "Suspended" | null>(null);

  useEffect(() => {
    const error = session && (session as any).error;
    if (error && (error === "SessionConflict" || error === "Suspended") && !alertShownRef.current) {
      alertShownRef.current = true;
      setErrorType(error);
      
      try {
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      } catch (e) {}

      setShowModal(true);
    }
  }, [session]);

  // Presence is now event-driven via Pusher Presence Channels (presence-community).
  // The legacy 15-second HTTP heartbeat has been permanently retired.

  const handleConfirm = () => {
    try {
      localStorage.removeItem("cfh_community_draft");
    } catch (_) {}
    nextAuthSignOut({ callbackUrl: "/" });
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-800 text-center animate-in fade-in zoom-in duration-300">
        <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {errorType === "Suspended" ? "Cuenta suspendida" : "Sesión cerrada"}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
          {errorType === "Suspended" 
            ? "Tu cuenta ha sido suspendida. Has sido desconectado por seguridad." 
            : "Tu sesión ha sido cerrada automáticamente porque se inició sesión en otro navegador o dispositivo."}
        </p>
        <button
          onClick={handleConfirm}
          className="w-full bg-cfh-dark-green hover:bg-cfh-light-green text-white font-bold py-3 px-4 rounded-xl transition-colors duration-200"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
