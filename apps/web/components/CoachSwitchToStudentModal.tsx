"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, X, Loader2, ArrowRight } from "lucide-react";
import { switchUserRole } from "@/app/actions/onboarding";
import { useTranslation } from "./TranslationProvider";
import { useScrollLock } from "@/lib/scroll-lock";

interface CoachSwitchToStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CoachSwitchToStudentModal({
  isOpen,
  onClose,
}: CoachSwitchToStudentModalProps) {
  const { t } = useTranslation();
  const [isSwitching, setIsSwitching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSwitching) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSwitching, onClose]);

  const handleSwitchRole = async () => {
    setIsSwitching(true);
    setErrorMessage(null);
    try {
      const res = await switchUserRole("STUDENT");
      if (res.success && res.redirectTo) {
        window.location.href = res.redirectTo;
      } else if (res.needsOnboarding && res.redirectTo) {
        window.location.href = res.redirectTo;
      } else {
        setErrorMessage(res.error || "No se pudo cambiar de rol. Intenta de nuevo.");
        setIsSwitching(false);
      }
    } catch (err: any) {
      console.error("[CoachSwitchToStudentModal] Error switching role:", err);
      setErrorMessage("Error de conexión al cambiar de rol.");
      setIsSwitching(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="relative w-full max-w-md my-auto bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 z-10 overflow-hidden text-center"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon Badge */}
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <GraduationCap className="w-8 h-8" />
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
            Ingresa como Aprendiz
          </h3>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            Actualmente estás en tu perfil de <strong className="text-slate-900 dark:text-white">Coach</strong>. Para ver el carrito, adquirir cursos y gestionar tu aprendizaje, debes ingresar en tu cuenta de <strong className="text-blue-600 dark:text-blue-400">Aprendiz</strong>.
          </p>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 text-center">
              {errorMessage}
            </div>
          )}

          {/* Action Button */}
          <div className="space-y-3">
            <button
              onClick={handleSwitchRole}
              disabled={isSwitching}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSwitching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cambiando a Aprendiz...</span>
                </>
              ) : (
                <>
                  <GraduationCap className="w-4 h-4" />
                  <span>Cambiar a Modo Aprendiz</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>

          <button
            onClick={onClose}
            className="mt-5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            Continuar como Coach
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
