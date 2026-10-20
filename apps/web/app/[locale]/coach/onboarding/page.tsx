"use client";
import TermsContent from "@/components/TermsContent";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Video,
  X,
  Check,
  Sparkles,
  Clock,
  Plus,
  Send,
  AlertCircle,
  CheckCircle2,
  Play,
  Film,
  Link as LinkIcon,
  ShieldCheck,
  FileText,
  ShieldAlert,
  AlertTriangle,
  Lock,
} from "lucide-react";
import ImageUploader from "@/components/ImageUploader";
import {
  completeCoachOnboarding,
  updateCoachProfile,
  getCoachOnboardingStatus,
  getOnboardingCategories,
  getOnboardingPlans,
  requestNewSpecialty,
  switchUserRole,
  updateUserName,
} from "@/app/actions/onboarding";
import type { CoachTier } from "@prisma/client";
import { CoachCertificationsSection, CoachCertificate } from "@/features/coach-certifications";
import { useTranslation } from "@/components/TranslationProvider";
import { translateCategory } from "@/lib/i18n-helpers";


interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isPending?: boolean;
}

interface SubscriptionPlanOption {
  id: string;
  code: string;
  tier: CoachTier;
  name: string;
  description: string;
  monthlyPriceCents: number;
  commissionBps: number;
  hasAiCopilot: boolean;
  hasCourseBuilder: boolean;
  hasWhatsappReminders: boolean;
  hasStudentTracking: boolean;
  hasWhiteboard: boolean;
  hasPdfResources: boolean;
  monthlyAiCredits: number;
  benefits?: any;
}

const DEFAULT_PLANS_FALLBACK: SubscriptionPlanOption[] = [
  {
    id: "p-basic",
    code: "BASIC",
    tier: "BASIC" as CoachTier,
    name: "Básico",
    description: "Para empezar a dar sesiones de 60 min con cero costo fijo.",
    monthlyPriceCents: 0,
    commissionBps: 2300,
    hasAiCopilot: false,
    hasCourseBuilder: false,
    hasWhatsappReminders: false,
    hasStudentTracking: false,
    hasWhiteboard: false,
    hasPdfResources: false,
    monthlyAiCredits: 0,
    benefits: ["Comisión 23%", "Sesiones en vivo de 60 minutos", "Chat interno seguro", "Sesión intro 15 min gratuita"],
  },
  {
    id: "p-cursos",
    code: "CURSOS_ONLY",
    tier: "CURSOS_ONLY" as CoachTier,
    name: "Solo Cursos",
    description: "Para creadores de contenido que solo venden videocursos asíncronos.",
    monthlyPriceCents: 900,
    commissionBps: 2500,
    hasAiCopilot: false,
    hasCourseBuilder: true,
    hasWhatsappReminders: false,
    hasStudentTracking: false,
    hasWhiteboard: false,
    hasPdfResources: true,
    monthlyAiCredits: 0,
    benefits: ["Comisión 25% + fee", "Course Builder ilimitado", "Materiales descargables"],
  },
  {
    id: "p-elite",
    code: "ELITE",
    tier: "ELITE" as CoachTier,
    name: "Elite",
    description: "Para coaches que buscan interacción dinámica en vivo.",
    monthlyPriceCents: 1900,
    commissionBps: 2000,
    hasAiCopilot: false,
    hasCourseBuilder: false,
    hasWhatsappReminders: false,
    hasStudentTracking: false,
    hasWhiteboard: true,
    hasPdfResources: false,
    monthlyAiCredits: 20,
    benefits: ["Comisión 20%", "Pizarra virtual interactiva", "Bloc de notas por aprendiz", "Recordatorios por email"],
  },
  {
    id: "p-gold",
    code: "GOLD",
    tier: "GOLD" as CoachTier,
    name: "Gold",
    description: "Para coaches con flujo constante y retención de aprendices.",
    monthlyPriceCents: 3900,
    commissionBps: 1800,
    hasAiCopilot: false,
    hasCourseBuilder: false,
    hasWhatsappReminders: true,
    hasStudentTracking: true,
    hasWhiteboard: true,
    hasPdfResources: true,
    monthlyAiCredits: 100,
    benefits: ["Comisión 18%", "Material didáctico (PDFs)", "Seguimiento de aprendices", "Recordatorios por WhatsApp"],
  },
  {
    id: "p-platinum",
    code: "PLATINUM",
    tier: "PLATINUM" as CoachTier,
    name: "Platinum",
    description: "La suite integral completa con Copiloto IA y creador de cursos.",
    monthlyPriceCents: 7900,
    commissionBps: 1500,
    hasAiCopilot: true,
    hasCourseBuilder: true,
    hasWhatsappReminders: true,
    hasStudentTracking: true,
    hasWhiteboard: true,
    hasPdfResources: true,
    monthlyAiCredits: 500,
    benefits: ["Comisión 15%", "Copiloto IA (Transcripción + Tareas)", "Course Builder (Cursos 24/7)", "Chat Inteligente con IA"],
  },
];

const DRAFT_STORAGE_KEY = "cfh_coach_onboarding_draft";

function CoachOnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("edit") === "true";
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

  const errorRef = useRef<HTMLDivElement>(null);
  const headlineInputRef = useRef<HTMLInputElement>(null);
  const biographyInputRef = useRef<HTMLTextAreaElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // -------- Estados de carga --------
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlanOption[]>(DEFAULT_PLANS_FALLBACK);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [userName, setUserName] = useState("");
  const [editingExistingProfile, setEditingExistingProfile] = useState(false);

  // -------- Estados de Borrador Automático (LocalStorage) --------
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  // -------- Estados del formulario --------
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [headline, setHeadline] = useState("");
  const [biography, setBiography] = useState("");
  const [hourlyRate, setHourlyRate] = useState<number | "">(15);
  const [yearsExperience, setYearsExperience] = useState<number | "">(3);
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTier, setSelectedTier] = useState<CoachTier>("BASIC");
  const [freeIntroEnabled, setFreeIntroEnabled] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasOpenedTerms, setHasOpenedTerms] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasFullyReadTerms, setHasFullyReadTerms] = useState(false);
  const [termsScrollProgress, setTermsScrollProgress] = useState(0);
  const termsScrollContainerRef = useRef<HTMLDivElement>(null);
  const [showCertificates, setShowCertificates] = useState(false);
  const [certificates, setCertificates] = useState<CoachCertificate[]>([]);

  // -------- Estados de Video --------
  const [videoTab, setVideoTab] = useState<"upload" | "url">("upload");
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<string>("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isVideoDragging, setIsVideoDragging] = useState(false);

  // -------- Estados de Solicitud de Especialidad --------
  const [showSpecialtyBox, setShowSpecialtyBox] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState("");
  const [newSpecialtyDesc, setNewSpecialtyDesc] = useState("");
  const [specialtySubmitting, setSpecialtySubmitting] = useState(false);
  const [specialtySuccessMsg, setSpecialtySuccessMsg] = useState<string | null>(null);
  const [specialtyErrorMsg, setSpecialtyErrorMsg] = useState<string | null>(null);
  const [pendingSpecialties, setPendingSpecialties] = useState<CategoryOption[]>([]);

  // -------- Estados de envío --------
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasStudentOnboarding, setHasStudentOnboarding] = useState(false);

  // -------- Estado del modal de salida --------
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const loadData = useCallback(async () => {
      try {
        const statusRes = await getCoachOnboardingStatus();
        const catRes = await getOnboardingCategories();
        const plansRes = await getOnboardingPlans();

        if (!statusRes.authenticated) {
        router.push("/?auth=login");
        return;
      }

      if (statusRes.userName) setUserName(statusRes.userName);
      if (statusRes.coachPhotoUrl) {
        setAvatarUrl(statusRes.coachPhotoUrl);
      } else {
        setAvatarUrl("");
      }
      if (statusRes.hasStudentOnboarding) setHasStudentOnboarding(true);
      setCategories(catRes.categories || []);
      if (plansRes.plans && plansRes.plans.length > 0) {
        setPlans(plansRes.plans as SubscriptionPlanOption[]);
      }

      // Si tiene perfil existente: pre-llenar datos
      if (statusRes.hasProfile && statusRes.profile) {
        const p = statusRes.profile as any;
        setEditingExistingProfile(true);
        setHeadline(p.headline ?? "");
        setBiography(p.biography ?? "");
        setHourlyRate(p.hourlyRateCents ? p.hourlyRateCents / 100 : 15);
        setYearsExperience(p.yearsExperience ?? 0);
        setIntroVideoUrl(p.introVideoUrl ?? "");
        setSlug(p.slug ?? "");
        setFreeIntroEnabled(p.freeIntroEnabled ?? true);
        if (p.currentTier) {
          setSelectedTier(p.currentTier as CoachTier);
        }
        setSelectedCategories(
          Array.isArray(p.categories) ? p.categories.map((c: { categoryId: string }) => c.categoryId) : []
        );
        setShowCertificates(Boolean(p.showCertificates));
        if (Array.isArray(p.certificates)) {
          setCertificates(p.certificates);
        }
        setTermsAccepted(true);
        setHasFullyReadTerms(true);
        setHasOpenedTerms(true);
        setHasScrolledToBottom(true);
        setTermsScrollProgress(100);
      }

      // Restaurar borrador de localStorage si existe (tanto para nuevo registro como al regresar de ver planes)
      if (typeof window !== "undefined") {
        try {
          const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (rawDraft) {
            const draft = JSON.parse(rawDraft);
            if (draft && typeof draft === "object") {
              if (typeof draft.userName === "string" && draft.userName) setUserName(draft.userName);
              if (typeof draft.avatarUrl === "string" && draft.avatarUrl) setAvatarUrl(draft.avatarUrl);
              if (typeof draft.headline === "string" && draft.headline) setHeadline(draft.headline);
              if (typeof draft.biography === "string" && draft.biography) setBiography(draft.biography);
              if (draft.hourlyRate !== undefined && draft.hourlyRate !== "") setHourlyRate(draft.hourlyRate);
              if (draft.yearsExperience !== undefined && draft.yearsExperience !== "") setYearsExperience(draft.yearsExperience);
              if (typeof draft.introVideoUrl === "string" && draft.introVideoUrl) setIntroVideoUrl(draft.introVideoUrl);
              if (typeof draft.slug === "string" && draft.slug) setSlug(draft.slug);
              if (Array.isArray(draft.selectedCategories) && draft.selectedCategories.length > 0) setSelectedCategories(draft.selectedCategories);
              if (draft.selectedTier) setSelectedTier(draft.selectedTier);
              if (typeof draft.freeIntroEnabled === "boolean") setFreeIntroEnabled(draft.freeIntroEnabled);
              if (typeof draft.showCertificates === "boolean") setShowCertificates(draft.showCertificates);
              if (Array.isArray(draft.certificates) && draft.certificates.length > 0) setCertificates(draft.certificates);
              if (draft.videoTab === "upload" || draft.videoTab === "url") setVideoTab(draft.videoTab);
              if (draft.termsAccepted && draft.hasFullyReadTerms) {
                setTermsAccepted(true);
                setHasFullyReadTerms(true);
                setHasOpenedTerms(true);
                setHasScrolledToBottom(true);
                setTermsScrollProgress(100);
              }

              if (!statusRes.hasProfile && (draft.headline || draft.biography || (draft.selectedCategories && draft.selectedCategories.length > 0))) {
                setHasRestoredDraft(true);
                if (draft.savedAt) {
                  setDraftSavedAt(new Date(draft.savedAt));
                }
              }
            }
          }
        } catch (e) {
          console.warn("No se pudo restaurar el borrador local:", e);
        }
      }

      // Si viene de regreso desde /coach/plans o /checkout/plan con un tier seleccionado en la URL (?tier=...)
      const urlTier = searchParams.get("tier")?.toUpperCase();
      if (urlTier && ["BASIC", "CURSOS_ONLY", "ELITE", "GOLD", "PLATINUM"].includes(urlTier)) {
        setSelectedTier(urlTier as CoachTier);
      }
    } catch (err) {
      console.error("Error al cargar datos de onboarding:", err);
    } finally {
      setLoadingInitial(false);
    }
  }, [router, isEditMode, searchParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancel = () => {
    setShowExitConfirm(true);
  };

  const handleConfirmExit = async () => {
    setShowExitConfirm(false);
    try {
      const res = await switchUserRole("STUDENT");
      if (res.success || res.needsOnboarding) {
        window.location.href = makeHref(res.redirectTo || "/dashboard");
      }
    } catch (e) {
      console.error(e);
      window.location.href = makeHref("/dashboard");
    }
  };

  // Limpiar el borrador guardado y restablecer campos
  const handleDiscardDraft = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
    setHeadline("");
    setBiography("");
    setHourlyRate(15);
    setYearsExperience(3);
    setIntroVideoUrl("");
    setSelectedCategories([]);
    setSelectedTier("BASIC");
    setFreeIntroEnabled(true);
    setShowCertificates(false);
    setCertificates([]);
    setHasRestoredDraft(false);
    setDraftSavedAt(null);
  };

  // Guardado automático del borrador en localStorage mientras el coach redacta
  useEffect(() => {
    if (loadingInitial || success) return;

    const timer = setTimeout(() => {
      if (
        headline.trim() ||
        biography.trim() ||
        selectedCategories.length > 0 ||
        introVideoUrl.trim() ||
        certificates.length > 0
      ) {
        try {
          const draft = {
            userName,
            avatarUrl,
            headline,
            biography,
            hourlyRate,
            yearsExperience,
            introVideoUrl,
            slug,
            selectedCategories,
            selectedTier,
            freeIntroEnabled,
            showCertificates,
            certificates,
            videoTab,
            termsAccepted,
            hasFullyReadTerms,
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
          setDraftSavedAt(new Date());
        } catch (e) {
          console.warn("No se pudo guardar el borrador en localStorage:", e);
        }
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    userName,
    avatarUrl,
    headline,
    biography,
    hourlyRate,
    yearsExperience,
    introVideoUrl,
    slug,
    selectedCategories,
    selectedTier,
    freeIntroEnabled,
    showCertificates,
    certificates,
    videoTab,
    termsAccepted,
    hasFullyReadTerms,
    loadingInitial,
    success,
  ]);

  // -------- Manejador de Categorías --------
  const toggleCategory = (catId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // -------- Manejador de Subida de Video con Validación de Duración (Máx 5 min) --------
  const handleVideoFile = (file: File) => {
    setVideoError(null);

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const isVideoMimeOrExt =
      file.type.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext);

    if (!isVideoMimeOrExt) {
      setVideoError("Formato no permitido. Solo se aceptan videos en formato MP4, WebM o MOV.");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setVideoError("El video excede el tamaño máximo permitido de 100 MB.");
      return;
    }

    const videoElem = document.createElement("video");
    videoElem.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);
    videoElem.src = objectUrl;

    videoElem.onloadedmetadata = async () => {
      URL.revokeObjectURL(objectUrl);
      const durationSeconds = videoElem.duration;
      if (Number.isFinite(durationSeconds)) {
        setVideoDuration(Math.round(durationSeconds));
      }

      if (Number.isFinite(durationSeconds) && durationSeconds > 300) {
        const mins = Math.floor(durationSeconds / 60);
        const secs = Math.round(durationSeconds % 60);
        setVideoError(
          `El video dura ${mins}m ${secs}s. El límite máximo permitido para el video de presentación es de 5 minutos (300 segundos). Por favor recórtalo o sube un video más breve.`
        );
        if (videoInputRef.current) videoInputRef.current.value = "";
        return;
      }

      setVideoUploading(true);
      setVideoUploadProgress("Subiendo video...");
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload?type=video", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          setIntroVideoUrl(data.url);
          setVideoError(null);
        } else {
          setVideoError(data.error || "Formato no permitido. Solo se aceptan videos en formato MP4, WebM o MOV.");
        }
      } catch (err: any) {
        setVideoError(err?.message || "Error al conectar con el servidor para subir el video.");
      } finally {
        setVideoUploading(false);
        setVideoUploadProgress("");
      }
    };

    videoElem.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setVideoError("No se pudo procesar la duración del archivo. Asegúrate de que sea un archivo de video válido.");
    };
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleVideoFile(e.dataTransfer.files[0]);
    }
  };

  const removeVideo = () => {
    setIntroVideoUrl("");
    setVideoDuration(null);
    setVideoError(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  // -------- Manejador de Solicitud de Nueva Especialidad --------
  const handleRequestSpecialtySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpecialtyErrorMsg(null);
    setSpecialtySuccessMsg(null);

    const clean = newSpecialtyName.trim();
    if (!clean || clean.length < 2) {
      setSpecialtyErrorMsg("Ingresa un nombre válido para la especialidad (mínimo 2 letras).");
      return;
    }

    setSpecialtySubmitting(true);
    try {
      const res = await requestNewSpecialty(clean, newSpecialtyDesc.trim());
      if (res.success && res.category) {
        const newCat: CategoryOption = {
          id: res.category.id,
          name: res.category.name,
          slug: "",
          description: newSpecialtyDesc.trim() || null,
          icon: "sparkles",
          isPending: true,
        };
        setPendingSpecialties((prev) => [...prev, newCat]);
        setSelectedCategories((prev) => [...prev, res.category!.id]);
        setSpecialtySuccessMsg(res.message || "Solicitud enviada correctamente.");
        setNewSpecialtyName("");
        setNewSpecialtyDesc("");
        setTimeout(() => {
          setShowSpecialtyBox(false);
        }, 4000);
      } else {
        setSpecialtyErrorMsg(res.error || "No se pudo procesar la solicitud.");
      }
    } catch (err: any) {
      setSpecialtyErrorMsg(err?.message || "Error al enviar la solicitud.");
    } finally {
      setSpecialtySubmitting(false);
    }
  };

  // -------- Control de Lectura Obligatoria y Desplazamiento de Términos --------
  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? Math.min(100, Math.round((scrollTop / maxScroll) * 100)) : 100;
    setTermsScrollProgress(progress);
    if (progress >= 95 || scrollTop + clientHeight >= scrollHeight - 35) {
      setHasScrolledToBottom(true);
    }
  };

  // -------- Envío del Formulario Completo --------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avatarUrl && !avatarFile) {
      setError("Es obligatorio subir una foto profesional de tu rostro para generar confianza con tus aprendices.");
      return;
    }
    if ((avatarUrl && avatarUrl.includes("dicebear.com")) || (avatarUrl && avatarUrl.includes("api.dicebear.com"))) {
      setError("Por favor sube una fotografía real de tu rostro. Los avatares ilustrados o de caricatura no están permitidos para coaches profesionales.");
      return;
    }
    if (!headline.trim()) {
      setError(t("CoachOnboarding.error_headline", "Por favor ingresa tu titular profesional."));
      headlineInputRef.current?.focus();
      return;
    }
    if (!biography.trim() || biography.trim().length < 20) {
      setError(t("CoachOnboarding.error_bio", "Por favor ingresa una biografía descriptiva (mínimo 20 caracteres)."));
      biographyInputRef.current?.focus();
      return;
    }
    if (!hourlyRate || Number(hourlyRate) < 5) {
      setError(t("CoachOnboarding.error_rate", "Por favor define una tarifa por hora válida en USD (mínimo $5 USD)."));
      return;
    }
    if (videoDuration && videoDuration > 300) {
      setError("El video de presentación no debe exceder 5 minutos (300 segundos).");
      return;
    }
    if (!editingExistingProfile && (!termsAccepted || !hasFullyReadTerms)) {
      setError("Es sumamente importante y obligatorio abrir, leer en su totalidad hasta el final y aceptar las Normas de la Comunidad y el Régimen de Sanciones (Sistema de 3 Strikes).");
      setShowTermsModal(true);
      return;
    }

    setSubmitting(true);

    try {
      let finalAvatarUrl = avatarUrl;
      if (avatarFile) {
        try {
          const avatarFormData = new FormData();
          avatarFormData.append("file", avatarFile);
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: avatarFormData,
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData?.url) {
              finalAvatarUrl = uploadData.url;
              setAvatarUrl(uploadData.url);
            }
          }
        } catch (uploadErr) {
          console.error("Error subiendo foto de perfil:", uploadErr);
        }
      }

      const payload = {
        headline: headline.trim(),
        biography: biography.trim(),
        hourlyRateCents: Math.round(Number(hourlyRate) * 100),
        yearsExperience: Number(yearsExperience) || 0,
        introVideoUrl: introVideoUrl.trim() || "",
        videoDurationSeconds: videoDuration || undefined,
        slug: slug.trim() || undefined,
        avatarUrl: finalAvatarUrl || undefined,
        displayName: userName.trim() || undefined,
        categoryIds: selectedCategories,
        tier: selectedTier,
        freeIntroEnabled,
        freeIntroMinutes: 15,
        currency: "USD",
        contractVersion: "1.0",
        showCertificates,
        certificates,
        isUpdate: editingExistingProfile,
      };

      let result: any = editingExistingProfile
        ? await updateCoachProfile(payload)
        : await completeCoachOnboarding(payload);

      if (!result.success) {
        try {
          const apiRes = await fetch("/api/coach/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const apiData = await apiRes.json();
          if (apiRes.ok && apiData.success) {
            result = { success: true, profileId: apiData.profileId, slug: apiData.slug, redirectUrl: apiData.redirectUrl };
          } else if (apiData.error) {
            result = { success: false, error: apiData.error };
          }
        } catch (apiErr) {
          // Mantener error del Server Action
        }
      }

      if (!result.success) {
        setError(result.error);
        setSubmitting(false);
        errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      
        if (typeof window !== "undefined") {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
        setSuccess(true);
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Si es una edición de perfil existente:
        // Los cambios ya se guardaron en la base de datos (incluso el tier si cambió).
        // Mostramos la confirmación de éxito y luego redirigimos a /coach/billing?success=true
        if (editingExistingProfile) {
          setTimeout(() => {
            window.location.href = makeHref("/coach/billing?success=true");
          }, 2000);
          return;
        }

        // --- MANEJO DE REDIRECCIÓN A PRE-CHECKOUT / DASHBOARD PARA REGISTRO NUEVO ---
        // Si el plan seleccionado requiere pago, mostrar confirmación y luego redirigir a pre-checkout
        const selectedPlan = plans.find(p => p.tier === selectedTier);
        if (result.redirectUrl && (result.redirectUrl.startsWith("/checkout/plan") || result.redirectUrl.includes("/checkout/plan"))) {
          setTimeout(() => {
            router.replace(makeHref(result.redirectUrl));
          }, 1800);
          return;
        } else if (selectedPlan && selectedPlan.monthlyPriceCents > 0) {
          setTimeout(() => {
            router.replace(makeHref(`/checkout/plan?planId=${selectedPlan.id}`));
          }, 1800);
          return;
        }
        
        // Si es gratuito (Plan Básico), ir directo al dashboard sin pedir tarjeta
        setTimeout(() => {
          window.location.href = makeHref(result.redirectUrl || "/coach/dashboard");
        }, 2200);

    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado al guardar los datos.");
      setSubmitting(false);
    }
  };

  // -------- Loading inicial --------
  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-cfh-dark-green dark:border-cfh-light-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 dark:text-slate-400 font-medium">
            {isEditMode ? "Cargando tu perfil..." : "Preparando tu formulario de coach..."}
          </p>
        </div>
      </div>
    );
  }

  const pageTitle = editingExistingProfile
    ? t("CoachOnboarding.edit_title", "Edita tu perfil de Coach")
    : t("CoachOnboarding.page_title", `¡Bienvenido${userName ? `, ${userName}` : ""}! Configura tu perfil`);

  const pageSubtitle = editingExistingProfile
    ? t("CoachOnboarding.edit_subtitle", "Actualiza la información que los aprendices ven en tu perfil público.")
    : t("CoachOnboarding.page_subtitle", "Únete a la red líder de coaches en vivo. Configura tus datos profesionales y comienza a dar sesiones de 60 min.");

  const submitLabel = editingExistingProfile
    ? t("CoachOnboarding.btn_save", "Guardar cambios")
    : t("CoachOnboarding.btn_submit", "Completar Registro de Coach");
  const successMessage = editingExistingProfile
    ? t("CoachOnboarding.success_updated", "¡Perfil actualizado exitosamente!")
    : t("CoachOnboarding.success_title", "¡Perfil creado exitosamente!");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* ── Modal de confirmación de salida ── */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 max-w-md w-full p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    ¿Deseas salir del registro de coach?
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Si sales ahora, tu progreso no se guardará en la plataforma. Cualquier borrador local permanecerá guardado en este dispositivo y podrás retomarlo después.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Continuar registro
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                >
                  Sí, salir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="relative text-center mb-8">
          {/* Botón X para cancelar el registro */}
          {!editingExistingProfile && (
            <button
              type="button"
              onClick={handleCancel}
              title="Salir del registro de coach"
              className="absolute right-0 top-0 w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cfh-light-green/20 dark:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green uppercase tracking-wider mb-3">
            {editingExistingProfile ? "✏️ EDITAR PERFIL" : "✨ ONBOARDING DE COACHES"}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {pageTitle}
          </h1>
          <p className="mt-2 text-base text-gray-600 dark:text-slate-400 max-w-xl mx-auto">{pageSubtitle}</p>
        </div>

        {/* Card Principal */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 p-6 sm:p-10"
        >
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="min-h-[360px] flex flex-col items-center justify-center py-16 text-center space-y-4"
              >
                <div className="w-20 h-20 bg-green-100 dark:bg-emerald-950/40 text-green-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{successMessage}</h2>
                <p className="text-gray-500 dark:text-slate-400">Redirigiendo a tu panel de control de coach...</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-10">
                {/* ── Banner de Borrador Restaurado ── */}
                {hasRestoredDraft && !editingExistingProfile && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">💾</span>
                      <div>
                        <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          {t("CoachOnboarding.draft_restored_title", "Borrador previo restaurado")}
                        </p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          {t("CoachOnboarding.draft_restored_desc", "Recuperamos tu información guardada automáticamente para que continúes donde te quedaste.")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDiscardDraft}
                      className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:text-red-600 dark:hover:text-red-400 underline cursor-pointer shrink-0 transition-colors"
                    >
                      {t("CoachOnboarding.draft_discard", "Descartar y limpiar formulario")}
                    </button>
                  </div>
                )}

                {/* ── Sección 1: Información Profesional ── */}
                <div className="space-y-5">
                  <h3 className="text-lg font-bold text-cfh-dark-green dark:text-cfh-light-green border-b border-gray-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-cfh-dark-green text-xs flex items-center justify-center font-black">
                      1
                    </span>
                    {t("CoachOnboarding.step_1", "1. Información Profesional")}
                  </h3>

                  {/* Nombre y Foto de Perfil del Coach */}
                  <div className="bg-gray-50/60 dark:bg-slate-850 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-slate-800 space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">
                        Nombre para tu perfil público <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-cfh-dark-green dark:focus:border-cfh-light-green focus:ring-2 focus:ring-cfh-dark-green/20 outline-none text-sm transition-all font-medium"
                      />
                    </div>
                    
                    <ImageUploader
                      value={avatarUrl}
                      onChange={(url, file) => {
                        setAvatarUrl(url);
                        setAvatarFile(file || null);
                      }}
                      label={t("CoachOnboarding.photo_label", "Foto de Perfil Profesional")}
                      description="Sube una fotografía real y profesional de tu rostro. Para generar confianza y autenticidad con tus aprendices, se requiere una foto de rostro auténtica."
                      hidePresets={true}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">
                      {t("CoachOnboarding.headline_label", "Titular Profesional")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={headlineInputRef}
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder={t("CoachOnboarding.headline_placeholder", "Ej. Mentor Senior en Liderazgo y Desarrollo Web")}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-cfh-dark-green dark:focus:border-cfh-light-green focus:ring-2 focus:ring-cfh-dark-green/20 outline-none text-sm transition-all font-medium"
                    />
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t("CoachOnboarding.headline_help", "Una frase corta que resuma tu especialidad.")}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">
                      {t("CoachOnboarding.bio_label", "Biografía y Enfoque de Mentoría")} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      ref={biographyInputRef}
                      value={biography}
                      onChange={(e) => setBiography(e.target.value)}
                      rows={4}
                      placeholder={t("CoachOnboarding.bio_placeholder", "Cuéntale a tus futuros aprendices sobre tu trayectoria, metodología y cómo puedes ayudarlos a lograr sus metas...")}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-cfh-dark-green dark:focus:border-cfh-light-green focus:ring-2 focus:ring-cfh-dark-green/20 outline-none text-sm transition-all resize-y font-medium"
                    />
                    <p className={`text-xs mt-1 font-medium ${biography.trim().length >= 20 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-slate-500"}`}>
                      {biography.length} caracteres (mínimo 20)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Enlace de Perfil (Slug)</label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="ej. mi-nombre-coach"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-cfh-dark-green dark:focus:border-cfh-light-green focus:ring-2 focus:ring-cfh-dark-green/20 outline-none text-sm transition-all font-medium"
                    />
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Opcional. Se autogenerará si lo dejas vacío.</p>
                  </div>
                </div>

                {/* ── Sección 2: Tarifa y Video de Presentación (Máx 5 min) ── */}
                <div className="space-y-5 pt-2">
                  <h3 className="text-lg font-bold text-cfh-dark-green dark:text-cfh-light-green border-b border-gray-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-cfh-dark-green text-xs flex items-center justify-center font-black">
                      2
                    </span>
                    {t("CoachOnboarding.step_tariff", "Tarifa y Video de Presentación")}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">
                        {t("CoachOnboarding.hourly_rate_label", "Tarifa por Hora (USD)")} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-gray-400 dark:text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          min="5"
                          step="1"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="15"
                          required
                          className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-cfh-dark-green dark:focus:border-cfh-light-green focus:ring-2 focus:ring-cfh-dark-green/20 outline-none text-sm transition-all font-semibold"
                        />
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t("CoachOnboarding.hourly_rate_desc", "Precio en dólares (USD) por 1 hora de sesión (mínimo $5 USD).")}</p>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-slate-850 rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">{t("CoachOnboarding.free_intro_label", "Sesión Introductoria Gratuita")}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{t("CoachOnboarding.free_intro_desc", "Ofrece 15 minutos sin costo a nuevos aprendices para conocerse.")}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={freeIntroEnabled}
                        onChange={(e) => setFreeIntroEnabled(e.target.checked)}
                        className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green rounded focus:ring-cfh-dark-green cursor-pointer ml-3 shrink-0"
                      />
                    </div>
                  </div>

                  {/* Espacio para subir video con validación de máx. 5 minutos */}
                  <div className="bg-gray-50/70 dark:bg-slate-850 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/60 dark:border-slate-750 pb-3">
                      <div className="flex items-center gap-2">
                        <Video className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green" />
                        <div>
                          <label className="text-sm font-bold text-gray-800 dark:text-white block">
                            {t("CoachOnboarding.video_label", "Video de Presentación (Opcional)")}
                          </label>
                          <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-cfh-dark-green dark:text-cfh-light-green" />
                            <strong>{t("CoachOnboarding.video_limit", "Límite: Máximo 5 minutos de duración")}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Toggle Subir archivo vs Enlace URL */}
                      <div className="flex items-center bg-gray-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setVideoTab("upload")}
                          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                            videoTab === "upload"
                              ? "bg-white dark:bg-slate-700 text-cfh-dark-green dark:text-cfh-light-green shadow-sm"
                              : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Subir archivo
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoTab("url")}
                          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                            videoTab === "url"
                              ? "bg-white dark:bg-slate-700 text-cfh-dark-green dark:text-cfh-light-green shadow-sm"
                              : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          Enlace web
                        </button>
                      </div>
                    </div>

                    {/* Vista Previa del Video Cargado */}
                    {introVideoUrl ? (
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                              <Film className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-800 dark:text-white">Video configurado</p>
                              {videoDuration && (
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Duración: {Math.floor(videoDuration / 60)}m {videoDuration % 60}s (Válido: ≤ 5 min)
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={removeVideo}
                            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            Quitar / Cambiar
                          </button>
                        </div>

                        {/* Player Preview */}
                        <div className="w-full max-w-md mx-auto aspect-video rounded-xl overflow-hidden bg-black/90 shadow-inner flex items-center justify-center">
                          {introVideoUrl.startsWith("/") || introVideoUrl.includes("/uploads/") ? (
                            <video
                              src={introVideoUrl}
                              controls
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="text-center p-4 text-white">
                              <Play className="w-8 h-8 mx-auto mb-2 text-cfh-light-green" />
                              <p className="text-xs text-gray-300 truncate max-w-xs">{introVideoUrl}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {videoTab === "upload" ? (
                          <div className="space-y-2">
                            <input
                              ref={videoInputRef}
                              type="file"
                              accept="video/mp4,video/webm,video/quicktime"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleVideoFile(e.target.files[0]);
                                }
                              }}
                              className="hidden"
                              id="coach-video-upload"
                            />

                            <div
                              onDrop={handleVideoDrop}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsVideoDragging(true);
                              }}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                setIsVideoDragging(false);
                              }}
                              onClick={() => videoInputRef.current?.click()}
                              className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all bg-white dark:bg-slate-900 ${
                                isVideoDragging
                                  ? "border-cfh-dark-green dark:border-cfh-light-green bg-cfh-dark-green/5 dark:bg-cfh-light-green/5"
                                  : "border-gray-200 dark:border-slate-700 hover:border-cfh-dark-green dark:hover:border-cfh-light-green hover:bg-gray-50/70 dark:hover:bg-slate-850"
                              }`}
                            >
                              <div className="flex flex-col items-center justify-center gap-2">
                                <div className="w-12 h-12 rounded-full bg-cfh-light-green/20 dark:bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center">
                                  {videoUploading ? (
                                    <div className="w-6 h-6 border-2 border-cfh-dark-green dark:border-cfh-light-green border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Upload className="w-6 h-6" />
                                  )}
                                </div>
                                <p className="text-sm font-bold text-gray-800 dark:text-white">
                                  {videoUploading ? (
                                    videoUploadProgress
                                  ) : (
                                    <>
                                      <span className="text-cfh-dark-green dark:text-cfh-light-green hover:underline">
                                        Haz clic para subir tu video
                                      </span>{" "}
                                      o arrástralo aquí
                                    </>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                  Formatos admitidos: MP4, WebM o MOV. <strong>Máximo 5 minutos de duración</strong>.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="url"
                              value={introVideoUrl}
                              onChange={(e) => setIntroVideoUrl(e.target.value)}
                              placeholder="https://www.youtube.com/watch?v=... o Vimeo"
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 focus:border-cfh-dark-green dark:focus:border-cfh-light-green focus:ring-2 focus:ring-cfh-dark-green/20 outline-none text-sm transition-all font-medium bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-400 dark:text-slate-500">
                              Pega el enlace de tu video de presentación alojado en YouTube, Vimeo o Cloudinary (máx. 5 min).
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Error de video */}
                    {videoError && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium flex items-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                        <span>{videoError}</span>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* ── Sección 3: Categorías y Solicitud de Especialidad ── */}
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                    <h3 className="text-lg font-bold text-cfh-dark-green dark:text-cfh-light-green flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-cfh-dark-green text-xs flex items-center justify-center font-black">
                        3
                      </span>
                      {t("CoachOnboarding.step_2", "Tus Especialidades")}
                    </h3>

                    {/* Botón para solicitar especialidad */}
                    <button
                      type="button"
                      onClick={() => setShowSpecialtyBox(!showSpecialtyBox)}
                      className="text-xs font-bold text-cfh-dark-green dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showSpecialtyBox ? t("CoachOnboarding.hide_request", "Ocultar solicitud") : t("CoachOnboarding.request_new_specialty", "Agregar / Solicitar otra especialidad")}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t("CoachOnboarding.select_specialties_desc", "Selecciona las categorías que mejor describan tu experiencia y conocimientos:")}
                  </p>

                  {/* Grid de categorías oficiales */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {categories.map((cat) => {
                      const isSelected = selectedCategories.includes(cat.id);
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          className={`p-3 rounded-xl text-left border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? "bg-cfh-dark-green dark:bg-cfh-dark-green text-white border-cfh-dark-green dark:border-cfh-light-green/60 shadow-sm scale-[1.02]"
                              : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:border-cfh-dark-green/40 dark:hover:border-cfh-light-green/50 hover:bg-gray-50 dark:hover:bg-slate-750"
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: isSelected ? "#4ade80" : "#94a3b8" }}
                          />
                          <span className="truncate">{translateCategory(cat.name, t)}</span>
                        </button>
                      );
                    })}

                    {/* Especialidades solicitadas pendientes */}
                    {pendingSpecialties.map((cat) => (
                      <div
                        key={cat.id}
                        className="p-3 rounded-xl text-left border text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 shadow-sm flex items-center justify-between gap-1"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 shrink-0 font-semibold">
                          En revisión
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Formulario desplegable para solicitar especialidad (con notificación por correo) */}
                  <AnimatePresence>
                    {showSpecialtyBox && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-gradient-to-br from-emerald-50/60 to-gray-50 dark:from-slate-850 dark:to-slate-900 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 space-y-3 mt-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                Proponer nueva especialidad
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                                Se enviará una notificación por correo al equipo de administración para su evaluación y aprobación.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowSpecialtyBox(false)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                                Nombre de la especialidad <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={newSpecialtyName}
                                onChange={(e) => setNewSpecialtyName(e.target.value)}
                                placeholder="Ej: Canto Lírico, Nutrición Holística..."
                                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 focus:border-cfh-dark-green dark:focus:border-cfh-light-green text-xs outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                                Breve justificación (opcional)
                              </label>
                              <input
                                type="text"
                                value={newSpecialtyDesc}
                                onChange={(e) => setNewSpecialtyDesc(e.target.value)}
                                placeholder="Por qué es relevante para tus aprendices..."
                                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 focus:border-cfh-dark-green dark:focus:border-cfh-light-green text-xs outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-medium"
                              />
                            </div>
                          </div>

                          {specialtySuccessMsg && (
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/40 p-2.5 rounded-xl flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
                              {specialtySuccessMsg}
                            </p>
                          )}

                          {specialtyErrorMsg && (
                            <p className="text-xs font-semibold text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                              {specialtyErrorMsg}
                            </p>
                          )}

                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={handleRequestSpecialtySubmit}
                              disabled={specialtySubmitting || !newSpecialtyName.trim()}
                              className="px-4 py-2 bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-cfh-dark-green rounded-xl text-xs font-bold hover:bg-[#061528] dark:hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              {specialtySubmitting ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-white dark:border-cfh-dark-green border-t-transparent rounded-full animate-spin" />
                                  <span>Enviando correo de aprobación...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Enviar solicitud a administración</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Sección 4: Certificaciones y Títulos ── */}
                <div className="space-y-4 pt-2">
                  <div className="border-b border-gray-100 dark:border-slate-800 pb-2">
                    <h3 className="text-lg font-bold text-cfh-dark-green dark:text-cfh-light-green flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-cfh-dark-green text-xs flex items-center justify-center font-black">
                        4
                      </span>
                      {t("CoachOnboarding.step_3", "Certificaciones y Títulos")}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      {t("CoachOnboarding.step_3_desc", "Acredita tu experiencia subiendo tus diplomas y certificaciones para generar mayor confianza con tus aprendices.")}
                    </p>
                  </div>

                  <CoachCertificationsSection
                    showCertificates={showCertificates}
                    onShowCertificatesChange={setShowCertificates}
                    certificates={certificates}
                    onCertificatesChange={setCertificates}
                  />
                </div>

                {/* ── Sección 5: Selección de Plan de Coach ── */}
                <div id="plan-selection" className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-2">
                    <div>
                      <h3 className="text-lg font-bold text-cfh-dark-green dark:text-cfh-light-green flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-cfh-dark-green text-xs flex items-center justify-center font-black">
                          5
                        </span>
                        {t("CoachOnboarding.step_4", "Selección de Plan")}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {t("CoachOnboarding.step_4_desc", "Elige el plan que mejor se adapte a tu forma de impartir clases o vender tus cursos:")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const draft = {
                            userName,
                            avatarUrl,
                            headline,
                            biography,
                            hourlyRate,
                            yearsExperience,
                            introVideoUrl,
                            slug,
                            selectedCategories,
                            selectedTier,
                            freeIntroEnabled,
                            showCertificates,
                            certificates,
                            videoTab,
                            termsAccepted,
                            hasFullyReadTerms,
                            savedAt: new Date().toISOString(),
                          };
                          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
                        } catch {}
                        router.push(makeHref("/coach/plans?from=onboarding"));
                      }}
                      className="text-xs font-bold text-cfh-dark-green dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Ver comparativa detallada de planes</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {plans.map((plan) => {
                      const isSelected = selectedTier === plan.tier;
                      const priceUsd = plan.monthlyPriceCents / 100;
                      const commissionPct = plan.commissionBps / 100;
                      const planCodeKey = plan.code.toLowerCase();
                      const planName = t(`CoachOnboarding.plan_${planCodeKey}_name`, plan.name);
                      const planDesc = t(`CoachOnboarding.plan_${planCodeKey}_desc`, plan.description);

                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedTier(plan.tier)}
                          className={`relative rounded-2xl p-5 border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? "border-cfh-dark-green dark:border-cfh-light-green bg-gradient-to-b from-cfh-light-green/10 to-white dark:from-cfh-light-green/10 dark:to-slate-850 shadow-md ring-2 ring-cfh-dark-green/20 dark:ring-cfh-light-green/20 scale-[1.01]"
                              : "border-gray-200 dark:border-slate-750 bg-white dark:bg-slate-850 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50/50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {/* Header de la tarjeta */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-extrabold text-base text-gray-900 dark:text-white">{planName}</span>
                            {isSelected ? (
                              <span className="w-6 h-6 rounded-full bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-cfh-dark-green flex items-center justify-center shadow">
                                <Check className="w-4 h-4 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-slate-600" />
                            )}
                          </div>

                          {/* Precio y comisión */}
                          <div className="space-y-1 mb-3">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-black text-cfh-dark-green dark:text-cfh-light-green">
                                ${priceUsd}
                              </span>
                              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">USD {t("CoachOnboarding.plan_month", "/mes")}</span>
                            </div>
                            <div className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                              {commissionPct}% {t("CoachOnboarding.plan_commission", "de comisión")}
                            </div>
                          </div>

                          <p className="text-xs text-gray-600 dark:text-slate-400 mb-4 line-clamp-2">
                            {planDesc}
                          </p>

                          {/* Lista de beneficios */}
                          <div className="space-y-1.5 pt-3 border-t border-gray-100 dark:border-slate-800 text-xs">
                            {Array.isArray(plan.benefits) &&
                              plan.benefits.slice(0, 4).map((b: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-1.5 text-gray-700 dark:text-slate-300">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span className="truncate">{b}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Sección 6: Términos y Envío ── */}
                <div className="space-y-5 pt-2 border-t border-gray-100 dark:border-slate-800">
                  {!editingExistingProfile && !isEditMode && (
                    <>
                      {/* Tarjeta de revisión de normas y advertencias */}
                      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        hasFullyReadTerms && termsAccepted
                          ? "border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/20 shadow-xs"
                          : "border-amber-300/90 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/30 shadow-sm ring-1 ring-amber-400/20"
                      } space-y-3`}>
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            hasFullyReadTerms && termsAccepted
                              ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                              : "bg-amber-500/15 dark:bg-amber-500/25 text-amber-700 dark:text-amber-400 animate-pulse"
                          }`}>
                            {hasFullyReadTerms && termsAccepted ? (
                              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ShieldAlert className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                Normas de la Comunidad, Términos y Régimen de Sanciones
                              </h4>
                              {hasFullyReadTerms && termsAccepted ? (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Lectura Completa Verificada
                                </span>
                              ) : (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/90 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  Lectura Obligatoria Requerida
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">
                              {hasFullyReadTerms && termsAccepted
                                ? "Has completado la lectura y confirmado el conocimiento de las políticas pedagógicas, la prohibición absoluta de pagos externos y el sistema de 3 strikes."
                                : "Para garantizar la calidad de la plataforma, la prohibición de cobros externos y la seguridad de los alumnos, es sumamente importante abrir, desplazarte y leer las políticas y el régimen de sanciones hasta el final."}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                          <button
                            type="button"
                            onClick={() => setShowTermsModal(true)}
                            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                              hasFullyReadTerms && termsAccepted
                                ? "bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-750"
                                : "bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20 hover:shadow-md ring-2 ring-amber-400/40 animate-pulse"
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            <span>
                              {hasFullyReadTerms
                                ? "Revisar Normas y Sanciones Nuevamente"
                                : "Abrir y Leer Normas, Términos y Avisos de Sanción (Obligatorio)"}
                            </span>
                          </button>

                          {hasFullyReadTerms && (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-100/60 dark:bg-emerald-950/40 px-3 py-1 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>100% leído y certificado</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Casilla de aceptación con protección contra marcado sin lectura */}
                      <div
                        onClick={() => {
                          if (!hasFullyReadTerms) {
                            setShowTermsModal(true);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          hasFullyReadTerms
                            ? "border-gray-200 dark:border-slate-800 bg-transparent"
                            : "border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/10 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/20"
                        }`}
                      >
                        <label className="flex items-start gap-3 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={termsAccepted && hasFullyReadTerms}
                            onChange={(e) => {
                              if (!hasFullyReadTerms) {
                                setShowTermsModal(true);
                                return;
                              }
                              setTermsAccepted(e.target.checked);
                            }}
                            className="mt-1 w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green rounded focus:ring-cfh-dark-green cursor-pointer shrink-0"
                          />
                          <div className="flex-1">
                            <span className="text-xs text-gray-700 dark:text-slate-300 font-medium leading-relaxed block">
                              He leído detenidamente y acepto las <strong className="text-gray-900 dark:text-white">Normas de la Comunidad</strong>, los <strong className="text-gray-900 dark:text-white">Términos del Coach</strong> y los <strong className="text-gray-900 dark:text-white">Avisos de Advertencia de Bloqueo y Sanciones (Sistema de 3 Strikes)</strong> de Coaching From Home.
                            </span>
                            {!hasFullyReadTerms && (
                              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-1 inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Haz clic para abrir el documento y certificar tu lectura hasta el final antes de poder marcar esta casilla.
                              </span>
                            )}
                          </div>
                        </label>
                      </div>
                    </>
                  )}

                  {/* Banner de error */}
                  {error && (
                    <div
                      ref={errorRef}
                      className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm font-medium flex items-center gap-3"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Indicador sutil de guardado de borrador */}
                  {!editingExistingProfile && draftSavedAt && (
                    <div className="flex items-center justify-end gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      <span>{t("CoachOnboarding.draft_saved", "Borrador guardado localmente")}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                    {(editingExistingProfile || hasStudentOnboarding) && (
                      <button
                        type="button"
                        onClick={() => editingExistingProfile ? router.push("/coach/dashboard") : handleCancel()}
                        className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-extrabold rounded-2xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        {t("CoachOnboarding.btn_cancel", "Cancelar")}
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-4 bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-cfh-dark-green font-extrabold rounded-2xl shadow-lg shadow-cfh-dark-green/30 dark:shadow-cfh-light-green/20 hover:bg-[#061528] dark:hover:bg-emerald-400 hover:shadow-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-base cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white dark:border-cfh-dark-green border-t-transparent rounded-full animate-spin" />
                          <span>{t("CoachOnboarding.submitting", "Guardando perfil de coach...")}</span>
                        </>
                      ) : (
                        <>
                          <span>{submitLabel}</span>
                          <ShieldCheck className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </AnimatePresence>

          {/* Modal de Normas, Términos y Avisos de Sanción */}
          <AnimatePresence>
            {showTermsModal && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
                >
                  {/* Modal Header */}
                  <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 via-white to-transparent dark:from-slate-850 dark:via-slate-900 dark:to-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-cfh-dark-green text-white dark:bg-cfh-light-green dark:text-cfh-dark-green flex items-center justify-center shadow-md">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                          Normas de la Comunidad y Régimen de Sanciones
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Coaching From Home • Políticas de observancia obligatoria
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTermsModal(false)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Reading Progress Bar */}
                  <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 relative">
                    <div
                      className={`h-full transition-all duration-150 ${
                        hasScrolledToBottom ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${termsScrollProgress}%` }}
                    />
                  </div>
                  <div className="px-6 py-2 bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-200/50 dark:border-amber-900/40 flex items-center justify-between text-[11px] font-bold">
                    <span className={hasScrolledToBottom ? "text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5" : "text-amber-800 dark:text-amber-300 flex items-center gap-1.5"}>
                      {hasScrolledToBottom ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Lectura completa verificada (100%)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Desplaza hacia abajo para leer todos los apartados obligatorios</span>
                        </>
                      )}
                    </span>
                    <span className="text-gray-500 dark:text-slate-400 font-mono">
                      {termsScrollProgress}% leído
                    </span>
                  </div>

                  {/* Modal Scrollable Content */}
                  <div
                    ref={termsScrollContainerRef}
                    onScroll={handleTermsScroll}
                    className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm text-gray-700 dark:text-slate-300 leading-relaxed"
                  >
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-4">
                        <TermsContent locale={locale} />
                      </div>
                    </div>

                  {/* Modal Footer con Aceptación */}
                  <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-850 flex flex-col gap-3">
                    {!hasScrolledToBottom ? (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5 text-left">
                        <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Debes desplazarte hasta el final para desbloquear la aceptación ({termsScrollProgress}%).</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5 text-left">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>Has llegado al final. Ya puedes certificar y aceptar las normas.</span>
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 w-full">
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(false)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                      >
                        Cerrar
                      </button>

                      <button
                        type="button"
                        disabled={!hasScrolledToBottom}
                        onClick={() => {
                          setHasOpenedTerms(true);
                          setHasFullyReadTerms(true);
                          setTermsAccepted(true);
                          setShowTermsModal(false);
                          setError("");
                        }}
                        className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md text-center max-w-full ${
                          hasScrolledToBottom
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer ring-2 ring-emerald-500/40"
                            : "bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed border border-gray-300 dark:border-slate-700"
                        }`}
                      >
                        {hasScrolledToBottom ? (
                          <>
                            <ShieldCheck className="w-4 h-4 text-white shrink-0" />
                            <span className="break-words">He leído y acepto íntegramente las Normas y Sanciones</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
                            <span>Desplaza hasta el final ({termsScrollProgress}%)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

export default function CoachOnboardingPage() {
  return (
    <Suspense
      fallback={<div className="p-20 text-center font-bold text-gray-500">Cargando perfil...</div>}
    >
      <CoachOnboardingForm />
    </Suspense>
  );
}



