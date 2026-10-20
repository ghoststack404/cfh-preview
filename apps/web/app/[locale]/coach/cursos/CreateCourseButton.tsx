"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createCourseDraft } from "@/app/actions/createCourse";
import { Plus, Sparkles, X, BookOpen, AlertCircle } from "lucide-react";
import { useTranslation } from "@/components/TranslationProvider";

export default function CreateCourseButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale } = useParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && showModal && !isPending) {
        setShowModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal, isPending]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      setErrorMessage(null);
      const res = await createCourseDraft(newTitle.trim());
      if (res?.id) {
        startTransition(() => {
          router.push(`/${locale}/coach/cursos/${res.id}/editar`);
        });
        setShowModal(false);
        setNewTitle("");
        return;
      }
      setErrorMessage("No se pudo crear el curso.");
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Error inesperado al crear el curso.");
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-cfh-dark-green hover:bg-cfh-light-green text-white font-extrabold text-sm shadow-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span>{t("CoachCursos.create_btn", "Crear Nuevo Curso")}</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={modalRef}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cfh-light-green/20 dark:bg-cfh-light-green/10 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 dark:text-slate-100 text-lg">
                    Crear Nuevo Curso
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Define el título inicial para comenzar a estructurar tu contenido.
                  </p>
                </div>
              </div>
              <button
                disabled={isPending}
                onClick={() => {
                  setShowModal(false);
                  setNewTitle("");
                  setErrorMessage(null);
                }}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Input del Título */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Título del Curso <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newTitle}
                disabled={isPending}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTitle.trim() && !isPending) {
                    handleCreate();
                  }
                }}
                placeholder="Ej. Dominio de Finanzas Personales de Cero a Pro"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/90 text-gray-900 dark:text-slate-100 text-sm font-semibold outline-none focus:border-cfh-dark-green focus:ring-2 focus:ring-cfh-dark-green/20 placeholder-gray-400 dark:placeholder-slate-500"
                autoFocus
              />
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5">
                Podrás configurar módulos, lecciones, precio en USD y multimedia en el editor.
              </p>
            </div>

            {/* Acciones */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setShowModal(false);
                  setNewTitle("");
                  setErrorMessage(null);
                }}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isPending || !newTitle.trim()}
                className="flex-1 py-3 rounded-xl bg-cfh-dark-green hover:bg-cfh-light-green text-white font-bold text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creando borrador...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Crear y Continuar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
