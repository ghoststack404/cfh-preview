"use client";

import React, { useState, useEffect } from "react";
import { Camera, CheckCircle2, X, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import ImageUploader from "@/components/ImageUploader";
import { saveCoachAvatar } from "@/app/actions/onboarding";

interface CoachAvatarUploaderProps {
  initialPhotoUrl?: string | null;
  coachName: string;
}

export default function CoachAvatarUploader({
  initialPhotoUrl = null,
  coachName,
}: CoachAvatarUploaderProps) {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setPhotoUrl(initialPhotoUrl);
  }, [initialPhotoUrl]);

  // Bloquear scroll de la página de fondo cuando el modal esté abierto
  useEffect(() => {
    if (showPhotoModal) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [showPhotoModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showPhotoModal) {
        setShowPhotoModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPhotoModal]);

  const handleSavePhoto = async (newUrl: string | null, file?: File | null) => {
    if (!newUrl && !file) return;
    setSavingPhoto(true);
    setToastMessage(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else if (newUrl) {
        formData.append("presetUrl", newUrl);
      }

      const res = await saveCoachAvatar(formData);
      if (res.success && res.avatarUrl) {
        setPhotoUrl(res.avatarUrl);
        setShowPhotoModal(false);
        setToastMessage({ type: "success", text: "¡Foto de coach actualizada con éxito!" });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cfh:coach-avatar-updated", { detail: res.avatarUrl }));
        }
        router.refresh();
      } else {
        setToastMessage({ type: "error", text: res.error || "No se pudo actualizar la foto." });
      }
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message || "Error al subir la foto de coach." });
    } finally {
      setSavingPhoto(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleRemovePhoto = async () => {
    setSavingPhoto(true);
    setToastMessage(null);
    try {
      const formData = new FormData();
      formData.append("remove", "true");

      const res = await saveCoachAvatar(formData);
      if (res.success) {
        setPhotoUrl(null);
        setShowPhotoModal(false);
        setToastMessage({ type: "success", text: "Foto de coach eliminada. Tu perfil de coach no mostrará foto." });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cfh:coach-avatar-updated", { detail: null }));
        }
        router.refresh();
      } else {
        setToastMessage({ type: "error", text: res.error || "No se pudo eliminar la foto." });
      }
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message || "Error al eliminar la foto." });
    } finally {
      setSavingPhoto(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const displayAvatar = (photoUrl && !photoUrl.startsWith("/avatars/"))
    ? photoUrl
    : `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(coachName || "Coach")}&backgroundColor=04101e&textColor=ffffff`;

  return (
    <>
      <div className="relative group shrink-0">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <img
            src={displayAvatar}
            alt={coachName}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Botón flotante para editar foto de coach */}
        <button
          type="button"
          onClick={() => setShowPhotoModal(true)}
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px] rounded-3xl opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white text-[11px] font-bold cursor-pointer"
          title="Actualizar o quitar foto de Coach"
        >
          <Camera className="w-5 h-5 mb-0.5" />
          <span>Editar</span>
        </button>

        <span
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white shadow-sm pointer-events-none"
          title="Perfil de Coach verificado"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Toast feedback */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-bold flex items-center gap-2 border animate-in fade-in slide-in-from-bottom-3 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
              : "bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700"
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Modal: Cambiar Foto de Perfil del Coach */}
      {showPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md overflow-y-auto overscroll-contain"
          onClick={() => setShowPhotoModal(false)}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 md:p-10 max-w-2xl sm:max-w-3xl lg:max-w-4xl w-full shadow-2xl relative border border-gray-100 dark:border-slate-800 my-auto cursor-default max-h-[92vh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cfh-dark-green/10 dark:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">
                    Foto de Perfil del Coach
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                    Esta imagen es independiente de tu cuenta de aprendiz. Puedes subir una foto profesional o quitarla en cualquier momento.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ImageUploader
              value={photoUrl}
              onChange={handleSavePhoto}
              label="Sube tu fotografía de coach"
              description="Formatos JPG, PNG o WebP (máx. 5MB). Se guardará exclusivamente en tu perfil de coach."
              hidePresets={false}
            />

            {/* Acciones del pie: Eliminar foto de coach si tiene una */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
              {photoUrl ? (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={savingPhoto}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Quitar foto de Coach</span>
                </button>
              ) : (
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Actualmente no tienes foto de coach asignada.
                </p>
              )}

              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {savingPhoto && (
              <div className="flex items-center justify-center gap-2 mt-4 text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Actualizando foto de coach...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
