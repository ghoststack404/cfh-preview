"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  getCoachOnboardingStatus,
  saveUserAvatar,
  updateUserName,
  changeUserPassword,
  updateUserPresencePrivacy,
  updateUserProfileDetails,
  switchUserRole,
} from "@/app/actions/onboarding";
import {
  getUserProfileCoursesAndCertificates,
  type UserProfileCoursesAndCertificatesResponse,
  type UserProfileStudentCourseItem,
  type UserProfileStudentCertificateItem,
} from "@/app/actions/courses";
import ImageUploader from "@/components/ImageUploader";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  Award,
  ArrowRight,
  Pencil,
  Play,
  Download,
  Flame,
  Star,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Settings,
  GraduationCap,
  Briefcase,
  ArrowLeftRight,
  ZoomIn,
  X,
  Clock,
  Trophy,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  LogOut,
  Target,
  CreditCard,
  Plus,
  Trash2,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function StudentProfilePage() {
  const { t } = useTranslation();

  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();
  const [onboardingStatus, setOnboardingStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showEnlargedAvatar, setShowEnlargedAvatar] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Cursos y Certificados del Aprendiz
  const [profileData, setProfileData] = useState<UserProfileCoursesAndCertificatesResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"courses" | "certificates">("courses");
  const [selectedDiplomaPreview, setSelectedDiplomaPreview] = useState<UserProfileStudentCertificateItem | null>(null);
  const [copiedCertCode, setCopiedCertCode] = useState<string | null>(null);

  // Modales de Configuración
  const [showOnline, setShowOnline] = useState(true);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileBio, setEditProfileBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Modal: Cambiar Contraseña
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Modal: Privacidad
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Métodos de Pago / Billetera de Aprendiz
  const [walletCards, setWalletCards] = useState<Array<{
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  }>>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardHolder, setNewCardHolder] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newCardCvc, setNewCardCvc] = useState("");
  const [savingCard, setSavingCard] = useState(false);
  const [cardError, setCardError] = useState("");

  // Menú de opciones de configuración
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Bloquear scroll de la página de fondo cuando cualquier modal esté abierto
  const isAnyModalOpen = Boolean(
    showPhotoModal ||
    showEditProfileModal ||
    showChangePasswordModal ||
    showPrivacyModal ||
    showAddCardModal ||
    selectedDiplomaPreview
  );

  useEffect(() => {
    if (isAnyModalOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isAnyModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPhotoModal) setShowPhotoModal(false);
        if (showEditProfileModal) setShowEditProfileModal(false);
        if (showChangePasswordModal) setShowChangePasswordModal(false);
        if (showPrivacyModal) setShowPrivacyModal(false);
        if (showAddCardModal) setShowAddCardModal(false);
        if (selectedDiplomaPreview) setSelectedDiplomaPreview(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPhotoModal, showEditProfileModal, showChangePasswordModal, showPrivacyModal, showAddCardModal, selectedDiplomaPreview]);

  // Autenticación y Carga
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/?auth=login");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadData() {
      try {
        const [statusRes, coursesCertRes] = await Promise.all([
          getCoachOnboardingStatus(),
          getUserProfileCoursesAndCertificates(),
        ]);

        if (!statusRes.authenticated) {
          router.replace("/?auth=login");
          return;
        }

        // Si el usuario tiene rol activo de COACH, redirigir a su perfil de Coach
        const cookieRole = typeof document !== "undefined"
          ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
          : null;
        const currentActiveRole = cookieRole || statusRes.activeRole || (statusRes as any).role;
        if (currentActiveRole === "COACH") {
          router.replace("/coach/profile");
          return;
        }

        setOnboardingStatus(statusRes);
        if (statusRes?.userAvatarUrl) {
          setAvatarUrl(statusRes.userAvatarUrl);
        }

        if (statusRes && "interests" in statusRes && Array.isArray(statusRes.interests)) {
          setShowOnline(!statusRes.interests.includes("_ONLINE_HIDDEN"));
        }

        if (coursesCertRes.success) {
          setProfileData(coursesCertRes);
        }

        // Cargar tarjetas de la billetera
        try {
          const walletRes = await fetch("/api/wallet/payment-methods");
          if (walletRes.ok) {
            const walletData = await walletRes.json();
            setWalletCards(walletData.paymentMethods || []);
          }
        } catch (wErr) {
          console.error("Error al cargar billetera:", wErr);
        }
      } catch (err) {
        console.error("Error al cargar perfil de estudiante:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // Escuchar evento global de avatar
  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      const newUrl = e.detail;
      if (newUrl) {
        setAvatarUrl(newUrl);
        setOnboardingStatus((prev: any) =>
          prev ? { ...prev, userAvatarUrl: newUrl } : prev
        );
      }
    };
    window.addEventListener("cfh:user-avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("cfh:user-avatar-updated", handleAvatarUpdate);
  }, []);

  // Escape key listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowEnlargedAvatar(false);
        setShowPhotoModal(false);
        setSelectedDiplomaPreview(null);
        setShowEditProfileModal(false);
        setShowChangePasswordModal(false);
        setShowPrivacyModal(false);
        setShowSettingsMenu(false);
        setShowAddCardModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const userName = session?.user?.name || onboardingStatus?.userName || "Aprendiz";
  const userEmail = session?.user?.email || onboardingStatus?.userEmail || "";
  const rawAvatar = avatarUrl || session?.user?.image || onboardingStatus?.userAvatarUrl;
  const displayAvatar = (rawAvatar && !rawAvatar.startsWith("/avatars/"))
    ? rawAvatar
    : `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(userName)}`;

  // Fecha de registro formateada
  const rawCreatedAt = onboardingStatus?.createdAt || (session?.user as any)?.createdAt;
  const memberSinceFormatted = rawCreatedAt
    ? new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(rawCreatedAt))
    : "Reciente";

  // Intereses de aprendizaje del usuario
  const userInterests: string[] = Array.isArray(onboardingStatus?.interests) && onboardingStatus.interests.length > 0
    ? (onboardingStatus.interests as string[]).filter((i) => !i.startsWith("_"))
    : ["Marketing", "Tecnología", "Liderazgo", "Finanzas", "Desarrollo Personal"];

  // Métricas reales de estudiante (CERO datos inventados)
  const studentCourses = profileData?.studentCourses || [];
  const studentCertificates = profileData?.studentCertificates || [];

  const totalCoursesCount = studentCourses.length;
  const completedCoursesCount = studentCourses.filter((c) => c.status === "COMPLETED").length;
  const inProgressCoursesCount = studentCourses.filter((c) => c.status !== "COMPLETED").length;
  const totalCertificatesCount = studentCertificates.length;

  const overallProgress = totalCoursesCount > 0
    ? Math.round(studentCourses.reduce((acc, c) => acc + (c.progressPercent || 0), 0) / totalCoursesCount)
    : 0;

  const learnerLevel =
    overallProgress >= 75 ? "Nivel Avanzado" : overallProgress >= 35 ? "Nivel Intermedio" : t("StudentProfile.beginner_level", "Nivel Principiante");

  // Biografía / Metas del estudiante
  const displayBio = (session?.user as any)?.goals || onboardingStatus?.goals ||
    `Hola, soy ${userName}. Me apasiona el aprendizaje continuo y el desarrollo de nuevas habilidades para alcanzar mis metas profesionales y personales.`;

  // Coach de referencia asignado por cursos
  const firstEnrolledCourse = studentCourses[0];
  const assignedCoach = firstEnrolledCourse
    ? {
        name: firstEnrolledCourse.coachName || "Coach Asignado",
        headline: `Coach de ${firstEnrolledCourse.title}`,
        avatarUrl: firstEnrolledCourse.coachAvatarUrl || `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(firstEnrolledCourse.coachName || "Coach")}`,
        slug: firstEnrolledCourse.slug,
      }
    : null;

  // Insignias y Logros
  const achievements = [
    {
      id: "first-course",
      title: "Primer curso",
      subtitle: "completado",
      icon: BookOpen,
      color: "from-blue-600 to-blue-500",
      unlocked: completedCoursesCount >= 1,
    },
    {
      id: "streak",
      title: "Aprendizaje activo",
      subtitle: "en plataforma",
      icon: Flame,
      color: "from-amber-500 to-orange-500",
      unlocked: totalCoursesCount >= 1,
    },
    {
      id: "five-courses",
      title: "5 cursos",
      subtitle: "completados",
      icon: Star,
      color: "from-emerald-500 to-teal-500",
      unlocked: completedCoursesCount >= 5,
    },
    {
      id: "first-cert",
      title: "Primera",
      subtitle: "certificación",
      icon: Award,
      color: "from-purple-600 to-indigo-600",
      unlocked: totalCertificatesCount >= 1,
    },
    {
      id: "expert-student",
      title: "Aprendiz",
      subtitle: "destacado",
      icon: Trophy,
      color: "from-teal-600 to-emerald-600",
      unlocked: overallProgress >= 75 && totalCoursesCount >= 2,
    },
  ];

  // Guardar Foto
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

      const res = await saveUserAvatar(formData);
      if (res.success && res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        setOnboardingStatus((prev: any) =>
          prev ? { ...prev, userAvatarUrl: res.avatarUrl } : prev
        );
        setToastMessage({ type: "success", text: "¡Foto de perfil actualizada con éxito!" });
        setShowPhotoModal(false);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cfh:user-avatar-updated", { detail: res.avatarUrl }));
        }

        if (updateSession) {
          await updateSession();
        }
      } else {
        setToastMessage({ type: "error", text: res.error || "No se pudo actualizar la foto." });
      }
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message || "Error al subir la foto." });
    } finally {
      setSavingPhoto(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Guardar Nombre
  const handleSaveName = async () => {
    if (!editNameValue.trim() || editNameValue.trim() === userName) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    const res = await updateUserName(editNameValue);
    setSavingName(false);
    if (res.success) {
      setToastMessage({ type: "success", text: "Nombre actualizado correctamente" });
      setIsEditingName(false);
      if (updateSession) await updateSession();
      setOnboardingStatus((prev: any) => (prev ? { ...prev, userName: editNameValue.trim() } : prev));
    } else {
      setToastMessage({ type: "error", text: res.error || "Error al actualizar el nombre" });
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Guardar Detalles de Perfil (Modal)
  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProfileName.trim()) return;
    setSavingProfile(true);
    try {
      const res = await updateUserProfileDetails({
        name: editProfileName.trim(),
        biography: editProfileBio.trim(),
      });
      if (res.success) {
        setToastMessage({ type: "success", text: "¡Perfil actualizado con éxito!" });
        setShowEditProfileModal(false);
        if (updateSession) await updateSession();
        setOnboardingStatus((prev: any) => (prev ? { ...prev, userName: editProfileName.trim(), goals: editProfileBio.trim() } : prev));
      } else {
        setToastMessage({ type: "error", text: res.error || "Error al actualizar los datos." });
      }
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message || "Error al actualizar perfil." });
    } finally {
      setSavingProfile(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Guardar Contraseña
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (pwdNew !== pwdConfirm) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }
    if (pwdNew.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await changeUserPassword(pwdCurrent, pwdNew);
      if (res.success) {
        setToastMessage({ type: "success", text: res.message || "¡Contraseña actualizada con éxito!" });
        setShowChangePasswordModal(false);
        setPwdCurrent("");
        setPwdNew("");
        setPwdConfirm("");
      } else {
        setPasswordError(res.error || "Error al cambiar la contraseña.");
      }
    } catch (err: any) {
      setPasswordError(err?.message || "Error al cambiar la contraseña.");
    } finally {
      setSavingPassword(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Guardar Privacidad
  const handleSavePrivacy = async (newValue: boolean) => {
    setSavingPrivacy(true);
    const res = await updateUserPresencePrivacy(newValue);
    setSavingPrivacy(false);
    if (res.success) {
      setShowOnline(newValue);
      setToastMessage({
        type: "success",
        text: newValue ? "Ahora apareces como Activo en la comunidad." : "Ahora apareces como Ausente en la comunidad.",
      });
    } else {
      setToastMessage({ type: "error", text: res.error || "Error al actualizar privacidad." });
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cambio de Rol a Coach
  const handleRoleSwitch = async (targetRole: "COACH" | "STUDENT") => {
    setSwitchingRole(true);
    setToastMessage(null);
    try {
      const res = await switchUserRole(targetRole);
      if (res.success) {
        setToastMessage({
          type: "success",
          text: targetRole === "COACH" ? "¡Cambiando a Modo Coach!" : "¡Cambiando a Modo Aprendiz!",
        });
        if (updateSession) await updateSession();
        setTimeout(() => {
          window.location.href = res.redirectTo || (targetRole === "COACH" ? "/coach/dashboard" : "/dashboard");
        }, 600);
      } else if (res.needsOnboarding && res.redirectTo) {
        window.location.href = res.redirectTo;
      } else {
        setToastMessage({ type: "error", text: res.error || "No se pudo cambiar de rol." });
        setSwitchingRole(false);
      }
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message || "Error al procesar el cambio de rol." });
      setSwitchingRole(false);
    }
  };

  // Copiar código de certificación
  const handleCopyCertCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCertCode(code);
    setTimeout(() => setCopiedCertCode(null), 2500);
  };

  // Métodos de Pago / Billetera
  const getBrandDetails = (brand: string) => {
    const b = (brand || "").toLowerCase();
    if (b.includes("visa")) return { name: "Visa", bg: "bg-blue-600", text: "text-white", border: "border-blue-500/50" };
    if (b.includes("mastercard")) return { name: "Mastercard", bg: "bg-gradient-to-r from-red-600 to-amber-500", text: "text-white", border: "border-orange-500/50" };
    if (b.includes("amex") || b.includes("american")) return { name: "Amex", bg: "bg-cyan-700", text: "text-white", border: "border-cyan-600/50" };
    if (b.includes("discover")) return { name: "Discover", bg: "bg-orange-600", text: "text-white", border: "border-orange-500/50" };
    return { name: (brand || "Card").toUpperCase(), bg: "bg-slate-700", text: "text-white", border: "border-slate-600/50" };
  };

  const fetchWalletCards = async () => {
    setLoadingCards(true);
    try {
      const res = await fetch("/api/wallet/payment-methods");
      if (res.ok) {
        const data = await res.json();
        setWalletCards(data.paymentMethods || []);
      }
    } catch (err) {
      console.error("Error al obtener métodos de pago:", err);
    } finally {
      setLoadingCards(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (deletingCardId) return;
    setDeletingCardId(cardId);
    try {
      const res = await fetch(`/api/wallet/payment-methods/${cardId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWalletCards((prev) => prev.filter((c) => c.id !== cardId));
        setToastMessage({ type: "success", text: "Tarjeta eliminada de tu billetera con éxito." });
      } else {
        const err = await res.json();
        setToastMessage({ type: "error", text: err.error || "No se pudo eliminar la tarjeta." });
      }
    } catch {
      setToastMessage({ type: "error", text: "Error al comunicar con el servidor." });
    } finally {
      setDeletingCardId(null);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setCardError("");

    const cleanNumber = newCardNumber.replace(/\s+/g, "");
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      setCardError("Por favor ingresa un número de tarjeta válido (13 a 19 dígitos).");
      return;
    }

    const [expMonthStr, expYearStr] = newCardExpiry.split("/");
    const expMonth = parseInt(expMonthStr || "", 10);
    let expYear = parseInt(expYearStr || "", 10);
    if (!expMonth || expMonth < 1 || expMonth > 12) {
      setCardError("Mes de vencimiento inválido (01 a 12).");
      return;
    }
    if (!expYear) {
      setCardError("Año de vencimiento inválido.");
      return;
    }
    if (expYear < 100) expYear += 2000;

    if (!newCardCvc || newCardCvc.length < 3) {
      setCardError("Código CVC de seguridad inválido.");
      return;
    }

    setSavingCard(true);
    try {
      // 1. Obtener SetupIntent del backend de forma segura
      const setupRes = await fetch("/api/wallet/setup-intent", { method: "POST" });
      if (!setupRes.ok) {
        const errData = await setupRes.json();
        throw new Error(errData.error || "Error al iniciar registro seguro de tarjeta.");
      }
      const setupData = await setupRes.json();

      // Determinar marca
      let brand = "visa";
      if (cleanNumber.startsWith("5") || cleanNumber.startsWith("2")) brand = "mastercard";
      else if (cleanNumber.startsWith("3")) brand = "amex";
      else if (cleanNumber.startsWith("6")) brand = "discover";

      // 2. Registrar método de pago en el wallet
      const addRes = await fetch("/api/wallet/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          last4: cleanNumber.slice(-4),
          expMonth,
          expYear,
          isDefault: walletCards.length === 0,
          setupIntentId: setupData.clientSecret,
        }),
      });

      if (!addRes.ok) {
        const addErr = await addRes.json();
        throw new Error(addErr.error || "No se pudo guardar la tarjeta.");
      }

      setToastMessage({
        type: "success",
        text: "¡Tarjeta guardada de forma segura en tu billetera!",
      });
      setShowAddCardModal(false);
      setNewCardNumber("");
      setNewCardHolder("");
      setNewCardExpiry("");
      setNewCardCvc("");
      await fetchWalletCards();
    } catch (err: any) {
      setCardError(err.message || "Error al registrar la tarjeta.");
    } finally {
      setSavingCard(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-cfh-dark-green dark:text-cfh-light-green mb-3" />
        <p className="text-sm font-semibold text-gray-600 dark:text-slate-400">Cargando tu perfil de aprendizaje...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors pb-24">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-bold ${
              toastMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-950/90 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Banner de Modo Aprendiz */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-700 text-white px-6 py-4 rounded-3xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 text-white flex items-center justify-center shrink-0 border border-white/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base">{t("StudentProfile.my_learner_profile", "Mi Perfil de Aprendiz")}</span>
                <span className="text-xs uppercase tracking-wider font-black bg-white/20 text-white px-2.5 py-0.5 rounded-full border border-white/30">
                  Modo Aprendiz
                </span>
              </div>
              <p className="text-xs text-blue-100">{t("StudentProfile.profile_subtitle", "Consulta tu avance académico, cursos inscritos y certificaciones oficiales.")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Mi Aprendizaje
            </Link>
            <button
              onClick={() => handleRoleSwitch("COACH")}
              disabled={switchingRole}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{switchingRole ? "Cambiando..." : "Cambiar a Modo Coach"}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna Izquierda: Información de Perfil del Aprendiz */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-200 dark:border-slate-800 shadow-sm relative">
              {/* Settings Dropdown Button */}
              <div className="absolute top-5 right-5">
                <div className="relative">
                  <button
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                    className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Configuración de Cuenta"
                  >
                    <Settings className="w-5 h-5" />
                  </button>

                  {showSettingsMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 py-2 z-30">
                      <button
                        onClick={() => {
                          setShowSettingsMenu(false);
                          setEditProfileName(userName);
                          setEditProfileBio(displayBio);
                          setShowEditProfileModal(true);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4 text-blue-500" />
                        <span>Editar Perfil</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowSettingsMenu(false);
                          setShowChangePasswordModal(true);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Lock className="w-4 h-4 text-amber-500" />
                        <span>Cambiar Contraseña</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowSettingsMenu(false);
                          setShowPrivacyModal(true);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span>Privacidad & Presencia</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowSettingsMenu(false);
                          const el = document.getElementById("wallet-section");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                        <span>Métodos de Pago</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Avatar y Datos Principales */}
              <div className="flex flex-col items-center text-center">
                <div className="relative group mb-4">
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    <img
                      src={displayAvatar}
                      alt={userName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => setShowPhotoModal(true)}
                    className="absolute bottom-0 right-0 p-2 bg-cfh-dark-green text-white rounded-full shadow-md hover:bg-[#061528] transition-all cursor-pointer"
                    title="Cambiar Foto"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div className="w-full">
                  {!isEditingName ? (
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <h2 className="text-xl font-extrabold text-gray-900 dark:text-white truncate max-w-[220px]">
                        {userName}
                      </h2>
                      <button
                        onClick={() => {
                          setEditNameValue(userName);
                          setIsEditingName(true);
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                        title="Editar nombre"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        className="px-3 py-1 text-sm font-bold rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white max-w-[180px] focus:outline-none focus:ring-2 focus:ring-cfh-dark-green"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={savingName}
                        className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setIsEditingName(false)}
                        className="p-1.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 truncate">{userEmail}</p>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 mb-4">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{learnerLevel}</span>
                  </div>

                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-6">
                    {t("StudentProfile.member_since", "Miembro desde")} {memberSinceFormatted}
                  </p>
                </div>

                {/* Biografía del Aprendiz */}
                <div className="w-full text-left pt-5 border-t border-gray-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">{t("StudentProfile.about_me", "Acerca de mí")}</span>
                    <button
                      onClick={() => {
                        setEditProfileName(userName);
                        setEditProfileBio(displayBio);
                        setShowEditProfileModal(true);
                      }}
                      className="text-xs text-cfh-dark-green dark:text-cfh-light-green font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Editar
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {displayBio}
                  </p>
                </div>

                {/* {t("StudentProfile.areas_of_interest", "Áreas de Interés")} */}
                <div className="w-full text-left pt-5 border-t border-gray-100 dark:border-slate-800 space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">{t("StudentProfile.areas_of_interest", "Áreas de Interés")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {userInterests.map((interest, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Estado de Presencia */}
                <div className="w-full text-left pt-5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${showOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`}></span>
                    <span className="text-xs font-semibold text-gray-600 dark:text-slate-400">
                      {showOnline ? "Visible en Comunidad" : "Modo Oculto / Ausente"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSavePrivacy(!showOnline)}
                    disabled={savingPrivacy}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {showOnline ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
            </div>

            {/* Mi Coach Asignado */}
            {assignedCoach && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>Mi Coach de Referencia</span>
                  </h3>
                  <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    Activo
                  </span>
                </div>

                <div className="flex items-center gap-3.5">
                  <img
                    src={assignedCoach.avatarUrl}
                    alt={assignedCoach.name}
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-gray-100 dark:ring-slate-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{assignedCoach.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{assignedCoach.headline}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link
                    href={`/coaches/${assignedCoach.slug}`}
                    className="py-2 px-3 text-center text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver Perfil</span>
                  </Link>
                  <Link
                    href="/messages"
                    className="py-2 px-3 text-center text-xs font-bold rounded-xl bg-cfh-dark-green hover:bg-[#061528] text-white transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Mensaje</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Métricas Reales, Progreso y Cursos/Diplomas */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tarjetas de Métricas Académicas (100% Reales) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{t("StudentProfile.enrolled", "Inscritos")}</span>
                  <BookOpen className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{totalCoursesCount}</div>
                <span className="text-xs sm:text-sm text-gray-400 dark:text-slate-500">{t("StudentProfile.total_courses", "Cursos en total")}</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{t("StudentProfile.completed", "Completados")}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{completedCoursesCount}</div>
                <span className="text-xs sm:text-sm text-gray-400 dark:text-slate-500">{t("StudentProfile.finished_100", "Finalizados 100%")}</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{t("StudentProfile.in_progress", "En Curso")}</span>
                  <Play className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{inProgressCoursesCount}</div>
                <span className="text-xs sm:text-sm text-gray-400 dark:text-slate-500">{t("StudentProfile.active_lessons", "Lecciones activas")}</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-slate-400">{t("StudentProfile.diplomas", "Diplomas")}</span>
                  <Award className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">{totalCertificatesCount}</div>
                <span className="text-xs sm:text-sm text-gray-400 dark:text-slate-500">{t("StudentProfile.certifications", "Certificaciones")}</span>
              </div>
            </div>

            {/* Barra de Progreso General Continuo */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green" />
                    <span>{t("StudentProfile.global_progress", "Progreso Global de Aprendizaje")}</span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{t("StudentProfile.global_progress_desc", "Promedio de avance en todos tus programas inscritos.")}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-cfh-dark-green dark:text-cfh-light-green">{overallProgress}%</span>
                  <span className="text-xs font-semibold text-gray-400">completado</span>
                </div>
              </div>

              <div className="w-full h-3.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cfh-dark-green rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(overallProgress, 2)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 pt-1">
                <span>{t("StudentProfile.0_start", "0% Inicio")}</span>
                <span>{t("StudentProfile.50_mid", "50% Intermedio")}</span>
                <span>{t("StudentProfile.100_mastery", "100% Maestría")}</span>
              </div>
            </div>

            {/* Insignias y Logros Académicos */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>{t("StudentProfile.achievement_badges", "Insignias de Logro")}</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {achievements.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <div
                      key={badge.id}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center transition-all ${
                        badge.unlocked
                          ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-gray-900 dark:text-white shadow-xs"
                          : "bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800 text-gray-400 dark:text-slate-500 opacity-60"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 shadow-sm ${
                          badge.unlocked
                            ? `bg-gradient-to-br ${badge.color} text-white`
                            : "bg-gray-200 dark:bg-slate-700 text-gray-400"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-extrabold leading-tight">{badge.title}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">{badge.subtitle}</span>
                      <span className={`text-xs mt-1.5 font-bold uppercase px-1.5 py-0.5 rounded-md ${
                        badge.unlocked ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300" : "bg-gray-100 dark:bg-slate-800 text-gray-400"
                      }`}>
                        {badge.unlocked ? "Desbloqueado" : "Bloqueado"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pestañas: Mis Cursos vs Mis Certificados */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex border-b border-gray-100 dark:border-slate-800">
                <button
                  onClick={() => setActiveTab("courses")}
                  className={`pb-3 px-4 font-extrabold text-sm sm:text-base border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === "courses"
                      ? "border-cfh-dark-green text-cfh-dark-green dark:border-cfh-light-green dark:text-cfh-light-green"
                      : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Mis Cursos ({totalCoursesCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab("certificates")}
                  className={`pb-3 px-4 font-extrabold text-sm sm:text-base border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === "certificates"
                      ? "border-cfh-dark-green text-cfh-dark-green dark:border-cfh-light-green dark:text-cfh-light-green"
                      : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>Diplomas & Certificados ({totalCertificatesCount})</span>
                </button>
              </div>

              {/* Tab 1: Cursos del Alumno */}
              {activeTab === "courses" && (
                <div>
                  {studentCourses.length === 0 ? (
                    <div className="py-12 px-4 text-center space-y-4">
                      <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-cfh-dark-green dark:text-cfh-light-green rounded-3xl flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-800/60">
                        <BookOpen className="w-8 h-8" />
                      </div>
                      <div className="max-w-md mx-auto">
                        <h4 className="text-base font-extrabold text-gray-900 dark:text-white">Aún no estás inscrito en ningún curso</h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          Explora el catálogo de cursos creados por coaches expertos y comienza a desarrollar tus competencias hoy mismo.
                        </p>
                      </div>
                      <Link
                        href="/cursos"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-2xl shadow-md transition-all cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Explorar Catálogo de Cursos</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {studentCourses.map((course) => (
                        <div
                          key={course.courseId}
                          className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-gray-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between"
                        >
                          <div>
                            <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-slate-700 mb-3">
                              <img
                                src={course.thumbnailUrl || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=350&fit=crop"}
                                alt={course.title}
                                className="w-full h-full object-cover"
                              />
                              {course.status === "COMPLETED" ? (
                                <span className="absolute top-2 right-2 bg-emerald-600 text-white text-xs font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                                  Completado
                                </span>
                              ) : (
                                <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                                  En Curso
                                </span>
                              )}
                            </div>

                            <h4 className="font-extrabold text-sm text-gray-900 dark:text-white line-clamp-2 mb-1" title={course.title}>
                              {course.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Coach: {course.coachName}</p>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs font-bold text-gray-600 dark:text-slate-400">
                                <span>{course.progressPercent}%</span>
                                <span>{course.completedLessons}/{course.totalLessons} lecciones</span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-cfh-dark-green dark:bg-cfh-light-green rounded-full transition-all"
                                  style={{ width: `${Math.max(course.progressPercent, 5)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <Link
                            href={`/classroom/${course.courseId}`}
                            className="w-full py-2.5 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-xl text-center transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Continuar Curso</span>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Certificados Oficiales */}
              {activeTab === "certificates" && (
                <div>
                  {studentCertificates.length === 0 ? (
                    <div className="py-12 px-4 text-center space-y-4">
                      <div className="w-16 h-16 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-3xl flex items-center justify-center mx-auto border border-purple-100 dark:border-purple-800/60">
                        <Award className="w-8 h-8" />
                      </div>
                      <div className="max-w-md mx-auto">
                        <h4 className="text-base font-extrabold text-gray-900 dark:text-white">Aún no tienes diplomas emitidos</h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                          Al completar el 100% de las lecciones de cualquier curso, recibirás automáticamente tu certificado digital con código único de verificación.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {studentCertificates.map((cert) => (
                        <div
                          key={cert.enrollmentId}
                          className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-gray-200/80 dark:border-slate-800 space-y-4 flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                                <ShieldCheck className="w-3 h-3" />
                                Verificado
                              </span>
                              <span className="text-xs sm:text-sm text-gray-400 dark:text-slate-500">{cert.completedAt}</span>
                            </div>

                            <h4 className="font-extrabold text-sm text-gray-900 dark:text-white line-clamp-2">
                              {cert.courseTitle}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Emitido por: {cert.coachName}</p>

                            {/* Código de verificación */}
                            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 flex items-center justify-between">
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-gray-400 uppercase block">Cód. Verificación</span>
                                <span className="text-xs font-mono font-bold text-gray-700 dark:text-slate-300 truncate block">
                                  {cert.certificateCode}
                                </span>
                              </div>
                              <button
                                onClick={() => handleCopyCertCode(cert.certificateCode)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
                                title="Copiar código"
                              >
                                {copiedCertCode === cert.certificateCode ? (
                                  <Check className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                              onClick={() => setSelectedDiplomaPreview(cert)}
                              className="py-2.5 px-3 text-center text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver Diploma</span>
                            </button>
                            <a
                              href={cert.pdfDownloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="py-2.5 px-3 text-center text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Descargar</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sección: Métodos de Pago / Datos Financieros (Billetera de Aprendiz) */}
            <div id="wallet-section" className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60 shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                        Métodos de Pago / Datos Financieros
                      </h3>
                      <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        PCI-DSS Compliant
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Tarjetas de crédito o débito vinculadas de forma segura con Stripe para pagos y reservas en 1 clic.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCardError("");
                    setShowAddCardModal(true);
                  }}
                  className="px-4 py-2.5 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Tarjeta</span>
                </button>
              </div>

              {loadingCards ? (
                <div className="py-8 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mb-2 text-cfh-dark-green dark:text-cfh-light-green" />
                  <span className="text-xs">Cargando tus métodos de pago guardados...</span>
                </div>
              ) : walletCards.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 rounded-3xl flex items-center justify-center mx-auto border border-gray-200 dark:border-slate-700">
                    <CreditCard className="w-8 h-8" />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h4 className="text-base font-extrabold text-gray-900 dark:text-white">No tienes tarjetas registradas</h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Agrega tu tarjeta Visa, Mastercard o American Express mediante nuestro cifrado bancario seguro para pagar cursos y reservar mentorías con un solo clic.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCardError("");
                      setShowAddCardModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Primera Tarjeta</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {walletCards.map((card) => {
                    const brandMeta = getBrandDetails(card.brand);
                    return (
                      <div
                        key={card.id}
                        className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white shadow-md relative overflow-hidden flex flex-col justify-between min-h-[160px] border border-slate-700/60"
                      >
                        {/* Chip & Brand */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-7 rounded bg-gradient-to-tr from-amber-300 via-amber-200 to-amber-400 border border-amber-500/40 shadow-xs flex items-center justify-center">
                              <div className="w-6 h-4 border border-amber-600/30 rounded-xs grid grid-cols-2 gap-0.5">
                                <div className="border-r border-amber-600/20"></div>
                                <div></div>
                              </div>
                            </div>
                            <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-md ${brandMeta.bg} ${brandMeta.text} shadow-xs border ${brandMeta.border}`}>
                              {brandMeta.name}
                            </span>
                          </div>

                          {card.isDefault && (
                            <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                              Predeterminada
                            </span>
                          )}
                        </div>

                        {/* Card Number Masked */}
                        <div className="my-3">
                          <div className="font-mono text-lg sm:text-xl tracking-widest text-slate-100 font-bold flex items-center gap-2">
                            <span>••••</span>
                            <span>••••</span>
                            <span>••••</span>
                            <span className="text-white">{card.last4}</span>
                          </div>
                        </div>

                        {/* Expiration and Actions */}
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700/60 text-slate-300">
                          <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider block">Expira</span>
                            <span className="font-mono font-semibold">
                              {String(card.expMonth).padStart(2, "0")}/{card.expYear}
                            </span>
                          </div>

                          <button
                            onClick={() => handleDeleteCard(card.id)}
                            disabled={deletingCardId === card.id}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                            title="Eliminar tarjeta guardada"
                          >
                            {deletingCardId === card.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PCI-DSS Security Guarantee Note */}
              <div className="flex items-center gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Tus datos bancarios están cifrados y procesados exclusivamente por Stripe. Coaching From Home nunca guarda números de tarjeta ni códigos CVC en sus bases de datos.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Cambiar Foto de Perfil */}
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
                  <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">Foto de Perfil</h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                    Elige uno de nuestros avatares prediseñados o sube tu propia imagen personalizada.
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
              value={avatarUrl}
              onChange={handleSavePhoto}
              label="Sube tu imagen"
              description="Formato JPG, PNG o WebP (max. 5MB)"
            />

            {savingPhoto && (
              <div className="flex items-center justify-center gap-2 mt-4 text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando foto...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Vista Previa de Diploma */}
      {selectedDiplomaPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto overscroll-contain"
          onClick={() => setSelectedDiplomaPreview(null)}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative border border-gray-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto overscroll-contain cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedDiplomaPreview(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-4 border-double border-amber-300/60 dark:border-amber-500/30 rounded-2xl p-6 sm:p-10 text-center space-y-6 bg-gradient-to-b from-amber-50/20 via-white to-amber-50/10 dark:from-slate-900 dark:to-slate-950">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-amber-200 dark:border-amber-800">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-400 block mb-1">
                  Certificado Oficial de Aprobación
                </span>
                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 dark:text-white">
                  Coaching From Home
                </h3>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-slate-400">Se otorga con orgullo el presente reconocimiento a:</p>
                <p className="text-xl sm:text-2xl font-black text-cfh-dark-green dark:text-cfh-light-green tracking-wide">
                  {userName}
                </p>
              </div>

              <div className="space-y-1 max-w-md mx-auto">
                <p className="text-xs text-gray-500 dark:text-slate-400">Por haber concluido exitosamente el programa:</p>
                <p className="text-base font-bold text-gray-900 dark:text-white">
                  "{selectedDiplomaPreview.courseTitle}"
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Impartido por el mentor profesional <strong>{selectedDiplomaPreview.coachName}</strong>.
                </p>
              </div>

              <div className="pt-4 border-t border-amber-200/60 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 dark:text-slate-400 gap-2">
                <span>Fecha: {selectedDiplomaPreview.completedAt}</span>
                <span className="font-mono text-xs sm:text-sm bg-amber-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-amber-200 dark:border-slate-700">
                  Código: {selectedDiplomaPreview.certificateCode}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setSelectedDiplomaPreview(null)}
                className="px-5 py-2.5 text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cerrar
              </button>
              <a
                href={selectedDiplomaPreview.pdfDownloadUrl}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar en PDF</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Perfil */}
      {showEditProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto overscroll-contain"
          onClick={() => setShowEditProfileModal(false)}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-gray-100 dark:border-slate-800 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowEditProfileModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">Editar Perfil</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">Actualiza tus datos públicos en la plataforma.</p>

            <form onSubmit={handleSaveProfileDetails} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={editProfileName}
                  onChange={(e) => setEditProfileName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cfh-dark-green"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Biografía / Metas de Aprendizaje</label>
                <textarea
                  rows={4}
                  value={editProfileBio}
                  onChange={(e) => setEditProfileBio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cfh-dark-green resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cambiar Contraseña */}
      {showChangePasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto overscroll-contain"
          onClick={() => setShowChangePasswordModal(false)}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-gray-100 dark:border-slate-800 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowChangePasswordModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">Cambiar Contraseña</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">Ingresa tu contraseña actual y la nueva que deseas utilizar.</p>

            <form onSubmit={handleSavePassword} className="space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold text-red-700 dark:text-red-300">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Contraseña Actual <span className="font-normal text-gray-400 dark:text-slate-500">(si ya la configuraste previamente)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPwdCurrent ? "text" : "password"}
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cfh-dark-green pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwdCurrent(!showPwdCurrent)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPwdCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Nueva Contraseña (mín. 6 caracteres)</label>
                <div className="relative">
                  <input
                    type={showPwdNew ? "text" : "password"}
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cfh-dark-green pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwdNew(!showPwdNew)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPwdNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showPwdConfirm ? "text" : "password"}
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cfh-dark-green pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwdConfirm(!showPwdConfirm)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPwdConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-5 py-2.5 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Actualizar Contraseña</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Privacidad y Presencia */}
      {showPrivacyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto overscroll-contain"
          onClick={() => setShowPrivacyModal(false)}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-gray-100 dark:border-slate-800 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">Privacidad y Presencia</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">Configura cómo interactúas con los demás miembros de la comunidad.</p>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Estado Activo / En Línea</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Muestra un indicador verde cuando estás navegando en la plataforma.</p>
                </div>
                <button
                  onClick={() => handleSavePrivacy(!showOnline)}
                  disabled={savingPrivacy}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    showOnline ? "bg-emerald-600 justify-end" : "bg-gray-300 dark:bg-slate-600 justify-start"
                  }`}
                >
                  <motion.div layout className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-5 py-2.5 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-xl shadow-md"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agregar Tarjeta / Billetera con SetupIntent */}
      {showAddCardModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto overscroll-contain"
          onClick={() => setShowAddCardModal(false)}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-gray-100 dark:border-slate-800 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAddCardModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-cfh-dark-green dark:text-cfh-light-green">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">
                Agregar Método de Pago
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
              Registra tu tarjeta de crédito o débito de forma segura utilizando Stripe SetupIntent (PCI-DSS Nivel 1).
            </p>

            <form onSubmit={handleAddCard} className="space-y-4">
              {cardError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cardError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Nombre en la Tarjeta
                </label>
                <input
                  type="text"
                  placeholder="Juan Pérez"
                  value={newCardHolder}
                  onChange={(e) => setNewCardHolder(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cfh-dark-green"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Número de Tarjeta
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={19}
                    placeholder="4000 1234 5678 9010"
                    value={newCardNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                      const formatted = val.replace(/(\d{4})(?=\d)/g, "$1 ");
                      setNewCardNumber(formatted);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cfh-dark-green pr-10"
                    required
                  />
                  <div className="absolute right-3 top-3 text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Vencimiento (MM/AA)
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="12/28"
                    value={newCardExpiry}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (val.length >= 3) {
                        val = val.slice(0, 2) + "/" + val.slice(2);
                      }
                      setNewCardExpiry(val);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cfh-dark-green"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                    CVC
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="123"
                    value={newCardCvc}
                    onChange={(e) => setNewCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cfh-dark-green"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center gap-2.5 text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>La tarjeta se vincula de manera segura a tu cuenta mediante tokenización de Stripe.</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCardModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCard}
                  className="px-5 py-2.5 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingCard && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Guardar Tarjeta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
