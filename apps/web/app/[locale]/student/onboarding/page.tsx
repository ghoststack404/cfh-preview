"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Code, Palette, Languages, Briefcase, Wallet, Heart,
  Sparkles, Megaphone, Cpu, Compass, Database, Users,
  ChevronRight, ChevronLeft, Check, Globe2, Target,
  UserCircle2, ArrowRight, PartyPopper, Flame, Lightbulb, Settings2, Loader2,
} from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import TermsContent from "@/components/TermsContent";
import { ScrollText } from "lucide-react";
import { useTranslation } from "@/components/TranslationProvider";
import { translateCategory } from "@/lib/i18n-helpers";

export interface StudentOnboardingData {
  interests: string[];
  goals: string;
  region: "LATAM" | "NORTH_AMERICA" | "EUROPE" | "ASIA" | "AFRICA" | "OCEANIA" | "OTHER";
  avatarUrl: string | null;
  completedAt?: string;
}

const INTEREST_OPTIONS = [
  { id: "programacion", name: "Programacion & Web", icon: Code },
  { id: "diseno", name: "Diseno UI/UX & Arte", icon: Palette },
  { id: "idiomas", name: "Ingles e Idiomas", icon: Languages },
  { id: "negocios", name: "Negocios & Emprendimiento", icon: Briefcase },
  { id: "finanzas", name: "Finanzas & Inversion", icon: Wallet },
  { id: "psicologia", name: "Psicologia & Bienestar", icon: Heart },
  { id: "desarrollo-personal", name: "Desarrollo Personal", icon: Sparkles },
  { id: "marketing", name: "Marketing Digital", icon: Megaphone },
  { id: "ia-datos", name: "Inteligencia Artificial & IA", icon: Cpu },
  { id: "liderazgo", name: "Liderazgo & Equipos", icon: Users },
  { id: "productividad", name: "Productividad & Habitos", icon: Compass },
  { id: "data-science", name: "Ciencia de Datos & SQL", icon: Database },
];

const REGION_OPTIONS = [
  { id: "LATAM", name: "América Latina", flag: "🌎", description: "México, Colombia, Argentina, Chile, Perú, etc." },
  { id: "NORTH_AMERICA", name: "Norteamérica", flag: "🌎", description: "Estados Unidos y Canadá" },
  { id: "EUROPE", name: "Europa", flag: "🌍", description: "España, Reino Unido, Alemania, Francia, etc." },
  { id: "ASIA", name: "Asia", flag: "🌏", description: "Japón, Corea, India, Sudeste Asiático, etc." },
  { id: "AFRICA", name: "África", flag: "🌍", description: "Norte y África Subsahariana" },
  { id: "OCEANIA", name: "Oceanía", flag: "🌏", description: "Australia, Nueva Zelanda, etc." },
  { id: "OTHER", name: "Otra Región", flag: "🌐", description: "Ubicación internacional general" },
] as const;

const GOAL_SUGGESTIONS = [
  "🚀 Conseguir mi primer empleo en tecnologia",
  "🗣️ Hablar ingles fluido para entrevistas internacionales",
  "📈 Aprender a gestionar e invertir mis finanzas",
  "🧘 Manejar el estres laboral y mejorar mis habitos",
  "💼 Lanzar mi propio emprendimiento digital",
];

import { getCoachOnboardingStatus, switchUserRole } from "@/app/actions/onboarding";

const STUDENT_DRAFT_KEY = "cfh_student_onboarding_draft";

function OnboardingContent() {
  const { update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";
  const { t, locale } = useTranslation();

  const makeHref = (path: string) => {
    const loc = locale || "es";
    if (path.startsWith(`/${loc}/`) || path === `/${loc}`) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `/${loc}${cleanPath}`;
  };

  const [step, setStep] = useState<number>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string>("");
  const [region, setRegion] = useState<StudentOnboardingData["region"]>("LATAM");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>("");
  const [isLoadingPrefs, setIsLoadingPrefs] = useState<boolean>(false);
  const [hasCoachProfile, setHasCoachProfile] = useState<boolean>(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Restaurar borrador de localStorage o cargar preferencias de la BD
  useEffect(() => {
    getCoachOnboardingStatus().then(res => {
      if (res.hasProfile) setHasCoachProfile(true);
    }).catch(console.error);

    let restored = false;
    if (typeof window !== "undefined") {
      try {
        const rawDraft = localStorage.getItem(STUDENT_DRAFT_KEY);
        if (rawDraft) {
          const draft = JSON.parse(rawDraft);
          if (draft && typeof draft === "object") {
            if (typeof draft.step === "number" && draft.step >= 1 && draft.step <= 4) {
              setStep(draft.step);
            }
            if (typeof draft.maxStepReached === "number" && draft.maxStepReached >= 1) {
              setMaxStepReached(draft.maxStepReached);
            } else if (typeof draft.step === "number") {
              setMaxStepReached(draft.step);
            }
            if (Array.isArray(draft.selectedInterests) && draft.selectedInterests.length > 0) {
              setSelectedInterests(draft.selectedInterests);
              restored = true;
            }
            if (typeof draft.goals === "string" && draft.goals) {
              setGoals(draft.goals);
              restored = true;
            }
            if (typeof draft.region === "string" && draft.region) {
              setRegion(draft.region);
            }
            if (typeof draft.avatarUrl === "string" && draft.avatarUrl) {
              setAvatarUrl(draft.avatarUrl);
              // Si es un dataUrl base64, convertir a File
              if (draft.avatarUrl.startsWith("data:image/")) {
                fetch(draft.avatarUrl)
                  .then(r => r.blob())
                  .then(blob => {
                    const restoredFile = new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" });
                    setAvatarFile(restoredFile);
                  })
                  .catch(() => {});
              }
            }
            if (restored) {
              setHasRestoredDraft(true);
            }
          }
        }
      } catch (e) {
        console.warn("No se pudo restaurar el borrador local:", e);
      }
    }

    if (isEditMode || !restored) {
      setIsLoadingPrefs(true);
      fetch("/api/student/preferences")
        .then((res) => res.json())
        .then((data) => {
          if (data.preferences) {
            const prefs = data.preferences;
            if (!restored) {
              if (Array.isArray(prefs.interests) && prefs.interests.length > 0) {
                setSelectedInterests(prefs.interests as string[]);
              }
              if (prefs.goals) setGoals(prefs.goals as string);
              if (prefs.region) setRegion(prefs.region as StudentOnboardingData["region"]);
              if (prefs.avatarUrl) setAvatarUrl(prefs.avatarUrl as string);
            }
          }
        })
        .catch(() => {/* silently ignore */})
        .finally(() => setIsLoadingPrefs(false));
    }
  }, [isEditMode]);

  // Guardado automático continuo en localStorage
  useEffect(() => {
    if (isCompleted || isLoadingPrefs) return;
    if (typeof window === "undefined") return;

    if (selectedInterests.length > 0 || goals.trim() || step > 1 || avatarUrl) {
      try {
        const draft = {
          step,
          maxStepReached: Math.max(step, maxStepReached),
          selectedInterests,
          goals,
          region,
          avatarUrl: avatarUrl && avatarUrl.length < 2000000 ? avatarUrl : null,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(STUDENT_DRAFT_KEY, JSON.stringify(draft));
      } catch (e) {
        console.warn("No se pudo guardar el borrador en localStorage:", e);
      }
    }
  }, [step, maxStepReached, selectedInterests, goals, region, avatarUrl, isCompleted, isLoadingPrefs]);

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGoalSuggestionClick = (suggestion: string) => {
    const textToAdd = suggestion.replace(/^[^\s]+\s/, "");
    setGoals((prev) => (prev ? `${prev}. ${textToAdd}` : textToAdd));
  };

  const handleCancel = async () => {
    if (!hasCoachProfile) return;
    try {
      const res = await switchUserRole("COACH");
      if (res.success || res.needsOnboarding) {
        window.location.href = res.redirectTo || makeHref("/coach/dashboard");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinish = async () => {
    setSaveError("");
    setIsSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;
      
      // Si el usuario subió una imagen local (avatarFile no es null)
      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json().catch(() => ({}));
        
        if (!uploadRes.ok) {
          setSaveError(uploadData.error || "Error al subir la imagen. Intenta de nuevo con otro archivo.");
          setIsSaving(false);
          return;
        }
        
        finalAvatarUrl = uploadData.url;
      }

      const res = await fetch("/api/student/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: selectedInterests,
          goals: goals.trim(),
          region,
          avatarUrl: finalAvatarUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error ?? "Error al guardar las preferencias. Intenta de nuevo.");
        setIsSaving(false);
        return;
      }

      try {
        await updateSession?.();
      } catch (sessErr) {
        console.warn("Could not immediately update session:", sessErr);
      }

      try {
        localStorage.removeItem(STUDENT_DRAFT_KEY);
      } catch (storageErr) {
        console.warn("Could not clean onboarding draft:", storageErr);
      }

      setIsCompleted(true);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setSaveError("Error de conexion. Verifica tu internet e intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const stepVariants = {
    initial: { opacity: 0, x: 20, scale: 0.98 },
    animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" as const } },
    exit: { opacity: 0, x: -20, scale: 0.98, transition: { duration: 0.25, ease: "easeIn" as const } },
  };

  if (isLoadingPrefs) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Cargando tus preferencias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-gradient-to-r from-cfh-light-green/20 via-cfh-dark-green/10 to-blue-200/20 blur-3xl -z-10 pointer-events-none rounded-full" />

      <div className="w-full max-w-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-gray-100 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 p-6 sm:p-10 transition-all">
        {!isCompleted && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full bg-cfh-dark-green/10 dark:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green">
                  {isEditMode ? "Editar Preferencias" : `Paso ${step} de 4`}
                </span>
                {hasRestoredDraft && !isEditMode && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-pulse">
                    <Check className="w-3 h-3" /> Progreso recuperado
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-slate-400 font-medium hidden sm:inline">
                  {step === 1 && "Intereses y Pasiones"}
                  {step === 2 && "Metas y Ubicación"}
                  {step === 3 && "Foto de Perfil"}
                </span>
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                Paso {step} de 4 ({Math.round((step / 4) * 100)}%)
              </span>
            </div>

            <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden relative">
              <motion.div
                className="h-full bg-gradient-to-r from-cfh-light-green to-cfh-dark-green rounded-full"
                initial={{ width: "33.3%" }}
                animate={{ width: `${(step / 4) * 100}%` }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 mt-4 text-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  step === 1
                    ? "bg-cfh-dark-green text-white shadow-sm"
                    : maxStepReached >= 1 || step > 1
                    ? "bg-cfh-light-green/20 dark:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green hover:bg-cfh-light-green/30"
                    : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500"
                }`}
              >
                {step > 1 || maxStepReached > 1 ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{t("StudentOnboarding.step_interests", "1. Intereses")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (maxStepReached >= 2 || selectedInterests.length > 0) {
                    setStep(2);
                  }
                }}
                disabled={maxStepReached < 2 && selectedInterests.length === 0}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
                  step === 2
                    ? "bg-cfh-dark-green text-white shadow-sm cursor-pointer"
                    : maxStepReached >= 2 || step > 2
                    ? "bg-cfh-light-green/20 dark:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green hover:bg-cfh-light-green/30 cursor-pointer"
                    : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed"
                }`}
              >
                {step > 2 || maxStepReached > 2 ? <Check className="w-3.5 h-3.5" /> : <Target className="w-3.5 h-3.5" />}
                <span>{t("StudentOnboarding.step_goals", "2. Metas")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (maxStepReached >= 3 || (selectedInterests.length > 0 && step >= 2)) {
                    setStep(3);
                  }
                }}
                disabled={maxStepReached < 3 && (selectedInterests.length === 0 || step < 2)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
                  step === 3
                    ? "bg-cfh-dark-green text-white shadow-sm cursor-pointer"
                    : maxStepReached >= 3 || step > 3
                    ? "bg-cfh-light-green/20 dark:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green hover:bg-cfh-light-green/30 cursor-pointer"
                    : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed"
                }`}
              >
                {step > 3 || maxStepReached > 3 ? <Check className="w-3.5 h-3.5" /> : <UserCircle2 className="w-3.5 h-3.5" />}
                <span>{t("StudentOnboarding.step_profile", "3. Perfil")}</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  if (maxStepReached >= 4 || step >= 3) {
                    setStep(4);
                  }
                }}
                disabled={maxStepReached < 4 && step < 3}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
                  step === 4
                    ? "bg-cfh-dark-green text-white shadow-sm cursor-pointer"
                    : maxStepReached >= 4
                    ? "bg-cfh-light-green/20 dark:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green hover:bg-cfh-light-green/30 cursor-pointer"
                    : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed"
                }`}
              >
                <ScrollText className="w-3.5 h-3.5" />
                <span>4. Legal</span>
              </button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && !isCompleted && (
            <motion.div key="step-1" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {isEditMode ? <Settings2 className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green" /> : <Flame className="w-5 h-5 text-amber-500" />}
                  <span className="text-xs font-bold uppercase tracking-wider text-cfh-dark-green dark:text-cfh-light-green">
                    {isEditMode ? "Editar Intereses de Aprendizaje" : "Paso 1 · Personaliza tu ruta"}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-cfh-text dark:text-slate-100 tracking-tight">
                  {isEditMode ? t("StudentOnboarding.edit_title", "Actualiza tus temas de interés") : t("StudentOnboarding.interests_title", "¿Qué te gustaría aprender hoy?")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">
                  {t("StudentOnboarding.interests_desc", "Elige uno o más temas para que sigamos recomendándote los cursos y coaches ideales para ti.")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {INTEREST_OPTIONS.map((item) => {
                  const isSelected = selectedInterests.includes(item.id);
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleInterest(item.id)}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl text-left border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-cfh-dark-green dark:border-cfh-light-green bg-gradient-to-r from-cfh-dark-green/10 to-cfh-light-green/10 dark:from-cfh-dark-green/20 dark:to-cfh-light-green/20 shadow-sm"
                          : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-gray-200 dark:hover:border-slate-700 hover:bg-gray-50/70 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-slate-950 shadow-sm" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs sm:text-sm font-bold truncate ${isSelected ? "text-cfh-dark-green dark:text-cfh-light-green" : "text-cfh-text dark:text-slate-200"}`}>{translateCategory(item.name, t)}</p>
                        <span className="text-[11px] text-gray-400 dark:text-slate-500">{isSelected ? t("StudentOnboarding.selected", "Seleccionado") : t("StudentOnboarding.tap_to_add", "Tocar para añadir")}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? "bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-slate-950" : "border border-gray-200 dark:border-slate-700"}`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 pt-2 border-t border-gray-100 dark:border-slate-800">
                <span>{t("StudentOnboarding.selected_count", "Has seleccionado")} <strong className="text-cfh-dark-green dark:text-cfh-light-green">{selectedInterests.length}</strong> {t("StudentOnboarding.selected_topics", "temas")}</span>
                {selectedInterests.length === 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{t("StudentOnboarding.select_at_least_one", "Selecciona al menos un interés para continuar")}</span>
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && !isCompleted && (
            <motion.div key="step-2" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-5 h-5 text-cfh-light-green" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cfh-dark-green dark:text-cfh-light-green">{t("StudentOnboarding.step_goals", "Paso 2 · Enfoque y Entorno")}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-cfh-text dark:text-slate-100 tracking-tight">{t("StudentOnboarding.goals_title", "Tus Metas y Ubicación")}</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">{t("StudentOnboarding.subtitle", "Cuéntanos qué buscas lograr en Coaching From Home para adaptar las sesiones a tus horarios y objetivos.")}</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{t("StudentOnboarding.goals_question", "¿Qué buscas lograr en la plataforma?")}</span>
                  <span className="text-gray-400 dark:text-slate-500 font-normal lowercase">({goals.length}/300 car.)</span>
                </label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder={t("StudentOnboarding.goals_placeholder", "Ej: Quiero mejorar mi nivel de conversación en inglés para postular a vacantes remotas...")}
                  className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-cfh-text dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cfh-dark-green/30 dark:focus:ring-cfh-light-green/30 focus:border-cfh-dark-green dark:focus:border-cfh-light-green transition-all"
                />
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ideas rápidas (haz clic para agregar):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {GOAL_SUGGESTIONS.map((chip, idx) => (
                      <button key={idx} type="button" onClick={() => handleGoalSuggestionClick(chip)} className="text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-cfh-dark-green dark:hover:border-cfh-light-green hover:text-cfh-dark-green dark:hover:text-cfh-light-green px-2.5 py-1 rounded-full transition-colors cursor-pointer">
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe2 className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                  <span>{t("StudentOnboarding.region_title", "Selecciona tu Región o Zona Horaria")}</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REGION_OPTIONS.map((item) => {
                    const isSelected = region === item.id;
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setRegion(item.id as StudentOnboardingData["region"])}
                        className={`flex items-center gap-3.5 p-3 rounded-2xl text-left border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-cfh-dark-green dark:border-cfh-light-green bg-gradient-to-r from-cfh-dark-green/10 to-cfh-light-green/10 dark:from-cfh-dark-green/20 dark:to-cfh-light-green/20 shadow-sm"
                            : "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-gray-200 dark:hover:border-slate-700 hover:bg-gray-50/70 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${
                            isSelected
                              ? "bg-cfh-dark-green/15 dark:bg-cfh-light-green/20 ring-1 ring-cfh-dark-green/30 dark:ring-cfh-light-green/40 shadow-xs"
                              : "bg-gray-100 dark:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60"
                          }`}
                        >
                          <span className="select-none leading-none">{item.flag}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs sm:text-sm font-bold truncate ${isSelected ? "text-cfh-dark-green dark:text-cfh-light-green" : "text-cfh-text dark:text-slate-200"}`}>{t(`Regions.${item.id}`, item.name)}</p>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{item.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-slate-950" : "border border-gray-300 dark:border-slate-700"}`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && !isCompleted && (
            <motion.div key="step-4" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ScrollText className="w-5 h-5 text-indigo-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cfh-dark-green dark:text-cfh-light-green">Paso 4 · Términos Legales</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-cfh-text dark:text-slate-100 tracking-tight">
                  Términos y Condiciones
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">
                  Revisa y acepta los términos para continuar.
                </p>
              </div>

              <TermsContent />

              <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-cfh-dark-green focus:ring-cfh-dark-green"
                />
                <label htmlFor="acceptTerms" className="text-sm font-medium text-gray-700 cursor-pointer">
                  He leído y acepto los Términos y Condiciones, y la Política de Privacidad de Coaching From Home.
                </label>
              </div>
            </motion.div>
          )}
          {step === 3 && !isCompleted && (
            <motion.div key="step-3" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <UserCircle2 className="w-5 h-5 text-indigo-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cfh-dark-green dark:text-cfh-light-green">Paso 3 · Tu Identidad</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-cfh-text dark:text-slate-100 tracking-tight">
                  {isEditMode ? "Actualiza tu foto de perfil" : "Sube tu foto de perfil"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">Una foto clara permite a tus coaches y compañeros reconocerte en las videollamadas.</p>
              </div>

              <div className="py-2">
                <ImageUploader
                  value={avatarUrl}
                  onChange={(url, file) => { setAvatarUrl(url); setAvatarFile(file || null); }}
                  label="Foto de perfil del aprendiz"
                  description="Formatos admitidos: JPG, PNG o WebP (max. 5MB)"
                />
              </div>

              {saveError && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 text-sm text-red-600 dark:text-red-400 font-medium">
                  {saveError}
                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-cfh-light-green/20 dark:bg-cfh-light-green/20 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center shrink-0 font-bold text-xs">i</div>
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                  Puedes elegir uno de los avatares ilustrados o presionar{" "}
                  <strong className="text-gray-700 dark:text-slate-200">{isEditMode ? "Guardar preferencias" : "Comenzar mi aprendizaje"}</strong> para continuar sin foto.
                  La foto quedará guardada en tu perfil.
                </p>
              </div>
            </motion.div>
          )}

          {isCompleted && (
            <motion.div key="completed-screen" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center text-center py-6 gap-6">
              <div className="w-20 h-20 bg-gradient-to-tr from-cfh-light-green to-cfh-dark-green rounded-full flex items-center justify-center text-white shadow-lg shadow-cfh-light-green/30 animate-bounce">
                <PartyPopper className="w-10 h-10" />
              </div>

              <div className="max-w-md">
                <h2 className="text-3xl font-extrabold text-cfh-text dark:text-slate-100">
                  {isEditMode ? "¡Preferencias actualizadas!" : "¡Todo listo para empezar!"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                  {isEditMode
                    ? "Hemos guardado tus cambios exitosamente en tu perfil."
                    : "Hemos guardado tus preferencias. Tu ruta personalizada de aprendizaje está lista."}
                </p>
              </div>

              <div className="w-full bg-gray-50 dark:bg-slate-800/60 rounded-2xl p-5 text-left border border-gray-100 dark:border-slate-700 flex flex-col gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Resumen de tus preferencias:</h4>
                <div className="flex items-start gap-2 text-xs text-cfh-text dark:text-slate-300">
                  <span className="font-semibold text-gray-500 dark:text-slate-400 shrink-0">Intereses ({selectedInterests.length}):</span>
                  <span className="font-medium bg-white dark:bg-slate-850 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700 break-all">
                    {selectedInterests.join(", ")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-cfh-text dark:text-slate-300">
                  <span className="font-semibold text-gray-500 dark:text-slate-400">Región:</span>
                  <span className="font-medium bg-white dark:bg-slate-850 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">{region}</span>
                </div>
                {goals && (
                  <div className="flex flex-col gap-1 text-xs text-cfh-text dark:text-slate-300">
                    <span className="font-semibold text-gray-500 dark:text-slate-400">Metas:</span>
                    <p className="font-medium bg-white dark:bg-slate-850 p-2 rounded border border-gray-200 dark:border-slate-700 italic">"{goals}"</p>
                  </div>
                )}
                {avatarUrl && (
                  <div className="flex items-center gap-2 text-xs text-cfh-text dark:text-slate-300">
                    <span className="font-semibold text-gray-500 dark:text-slate-400">Avatar:</span>
                    <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-slate-700" />
                  </div>
                )}
              </div>

              <Link
                href={makeHref("/dashboard")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-cfh-dark-green hover:bg-[#061528] dark:hover:bg-cfh-dark-green/80 text-white font-bold rounded-2xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <span>{isEditMode ? "Volver a mi Dashboard" : "Ir a mi Dashboard"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {!isCompleted && (
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100 dark:border-slate-800">
            <div className="flex gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-cfh-text dark:hover:text-slate-100 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t("StudentOnboarding.btn_back", "Atrás")}</span>
                </button>
              )}
              {(isEditMode || hasCoachProfile) && (
                <button
                  type="button"
                  onClick={() => isEditMode ? window.location.href = makeHref("/dashboard") : handleCancel()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span>{t("StudentOnboarding.btn_cancel", "Cancelar")}</span>
                </button>
              )}
            </div>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => {
                  const nextStep = Math.min(4, step + 1);
                  setStep(nextStep);
                  setMaxStepReached((prev) => Math.max(prev, nextStep));
                }}
                disabled={step === 1 && selectedInterests.length === 0}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer ${
                  step === 1 && selectedInterests.length === 0
                    ? "bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed"
                    : "bg-cfh-dark-green hover:bg-[#061528] dark:hover:bg-cfh-dark-green/80 text-white hover:shadow-lg transform hover:-translate-y-0.5"
                }`}
              >
                <span>{t("StudentOnboarding.btn_continue", "Continuar")}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={isSaving || !acceptedTerms}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-cfh-dark-green to-cfh-light-green text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-cfh-dark-green/20 hover:opacity-95 hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t("StudentOnboarding.saving", "Guardando...")}</span>
                  </>
                ) : (
                  <>
                    <span>{isEditMode ? t("StudentOnboarding.btn_save", "Guardar preferencias") : t("StudentOnboarding.btn_finish", "Comenzar a Aprender")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {!isCompleted && (
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-4 text-center">
          Paso {step} de 4 · Puedes actualizar tus respuestas en cualquier momento desde &quot;Editar preferencias&quot; en tu perfil.
        </p>
      )}
    </div>
  );
}

export default function StudentOnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm font-medium">Cargando...</p>
        </div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
