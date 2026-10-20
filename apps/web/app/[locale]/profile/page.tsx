"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getCoachOnboardingStatus, updateCoachAvatar, switchUserRole, saveUserAvatar, updateUserName, changeUserPassword, updateUserPresencePrivacy, updateUserProfileDetails } from "@/app/actions/onboarding";
import {
  getUserProfileCoursesAndCertificates,
  type UserProfileCoursesAndCertificatesResponse,
  type UserProfileCourseItem,
  type UserProfileStudentCourseItem,
  type UserProfileStudentCertificateItem,
  type UserProfileCoachCertificateItem,
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
  Globe,
  DollarSign,
  Briefcase,
  ShieldCheck,
  Calendar,
  LayoutDashboard,
  UserCheck,
  Video,
  GraduationCap,
  ArrowLeftRight,
  ZoomIn,
  X,
  BookOpen,
  Award,
  Target,
  Compass,
  ArrowRight,
  TrendingUp,
  Pencil,
  Bot,
  Play,
  Download,
  FileCheck,
  FileText,
  Users,
  Clock,
  Trophy,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Settings,
  Flame,
  Star,
  MessageSquare,
  LogOut,
  Lock,
  User,
  Tag,
  Mail,
  Bell,
  BarChart3,
  CalendarCheck,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfilePage() {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();
  const [coachStatus, setCoachStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showEnlargedAvatar, setShowEnlargedAvatar] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState("");

  // Estados para Cursos y Certificados en Perfil
  const [profileCoursesCertificates, setProfileCoursesCertificates] = useState<UserProfileCoursesAndCertificatesResponse | null>(null);
  const [loadingCoursesCertificates, setLoadingCoursesCertificates] = useState(true);
  const [profileActiveTab, setProfileActiveTab] = useState<"courses" | "certificates">("courses");
  const [selectedDiplomaPreview, setSelectedDiplomaPreview] = useState<UserProfileStudentCertificateItem | null>(null);
  const [selectedCoachDocPreview, setSelectedCoachDocPreview] = useState<UserProfileCoachCertificateItem | null>(null);
  const [copiedCertCode, setCopiedCertCode] = useState<string | null>(null);

  // ── Estados para rotación continua de progreso por curso ────────────────
  const [activeProgressIndex, setActiveProgressIndex] = useState(0);
  const [isProgressPaused, setIsProgressPaused] = useState(false);

  // ── Estados para rotación continua de reseñas de alumnos (Modo Coach) ─────
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [isReviewPaused, setIsReviewPaused] = useState(false);

  // ── Estados para modales de Configuración ──────────────────────────────
  const [showOnline, setShowOnline] = useState(true);
  // Modal: Editar Perfil
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileBio, setEditProfileBio] = useState("");
  const [editProfileHeadline, setEditProfileHeadline] = useState("");
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
  // Modal: Notificaciones
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  // Modal: Privacidad
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/?auth=login");
    }
  }, [status, router]);

  const handleSaveName = async () => {
    if (!editNameValue.trim() || editNameValue.trim() === (session?.user?.name || coachStatus?.userName)) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    const res = await updateUserName(editNameValue);
    setSavingName(false);
    if (res.success) {
      setToastMessage({ type: "success", text: "Nombre actualizado correctamente" });
      setIsEditingName(false);
      window.location.reload();
    } else {
      setToastMessage({ type: "error", text: res.error || "Error al actualizar el nombre" });
    }
  };

  const handleCopyCertCode = (code: string) => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(code);
    setCopiedCertCode(code);
    setToastMessage({ type: "success", text: `¡Código ${code} copiado al portapapeles!` });
    setTimeout(() => setCopiedCertCode(null), 3000);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ── Guardar Perfil ────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!editProfileName.trim()) {
      setToastMessage({ type: "error", text: "El nombre no puede estar vacío." });
      return;
    }
    setSavingProfile(true);
    const res = await updateUserProfileDetails({
      name: editProfileName,
      biography: editProfileBio,
      headline: editProfileHeadline,
    });
    setSavingProfile(false);
    if (res.success) {
      setToastMessage({ type: "success", text: "¡Perfil actualizado correctamente!" });
      setShowEditProfileModal(false);
      window.location.reload();
    } else {
      setToastMessage({ type: "error", text: res.error || "Error al guardar el perfil." });
    }
  };

  // ── Cambiar Contraseña ───────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPasswordError("");
    if (!pwdNew || !pwdConfirm) {
      setPasswordError("Por favor, ingresa y confirma la nueva contraseña.");
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (pwdNew.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSavingPassword(true);
    const res = await changeUserPassword(pwdCurrent, pwdNew);
    setSavingPassword(false);
    if (res.success) {
      setToastMessage({ type: "success", text: res.message || "¡Contraseña actualizada con éxito!" });
      setShowChangePasswordModal(false);
      setPwdCurrent(""); setPwdNew(""); setPwdConfirm("");
    } else {
      setPasswordError(res.error || "Error al cambiar la contraseña.");
    }
  };

  // ── Cargar Notificaciones ─────────────────────────────────────────────
  const handleLoadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
      setToastMessage({ type: "success", text: "Todas las notificaciones marcadas como leídas." });
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setMarkingRead(false);
    }
  };

  // ── Guardar Privacidad ────────────────────────────────────────────────
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
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      setToastMessage({ type: "error", text: res.error || "Error al actualizar la privacidad." });
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowEnlargedAvatar(false);
        setShowPhotoModal(false);
        setSelectedDiplomaPreview(null);
        setSelectedCoachDocPreview(null);
        setShowEditProfileModal(false);
        setShowChangePasswordModal(false);
        setShowNotificationsModal(false);
        setShowPrivacyModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Bloquear scroll de la página de fondo cuando cualquier modal esté abierto
  const isAnyModalOpen = Boolean(
    showEnlargedAvatar ||
    showPhotoModal ||
    selectedDiplomaPreview ||
    selectedCoachDocPreview ||
    showEditProfileModal ||
    showChangePasswordModal ||
    showNotificationsModal ||
    showPrivacyModal
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
    async function load() {
      try {
        const [statusRes, coursesCertRes] = await Promise.all([
          getCoachOnboardingStatus(),
          getUserProfileCoursesAndCertificates(),
        ]);
        if (!statusRes.authenticated) {
          router.replace("/?auth=login");
          return;
        }
        setCoachStatus(statusRes);
        if (statusRes?.userAvatarUrl) {
          setAvatarUrl(statusRes.userAvatarUrl);
        }
        // Inicializar estado de presencia desde interests
        if (statusRes && "interests" in statusRes) {
          const interests = statusRes.interests as string[];
          setShowOnline(!interests.includes("_ONLINE_HIDDEN"));
        }
        if (coursesCertRes.success) {
          setProfileCoursesCertificates(coursesCertRes);
        }
      } catch (err) {
        console.error("Error al cargar perfil:", err);
      } finally {
        setLoading(false);
        setLoadingCoursesCertificates(false);
      }
    }
    load();
  }, [router]);

  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      const newUrl = e.detail;
      if (newUrl) {
        setAvatarUrl(newUrl);
        setCoachStatus((prev: any) =>
          prev
            ? {
                ...prev,
                userAvatarUrl: newUrl,
                profile: prev.profile ? { ...prev.profile, photoUrl: newUrl } : prev.profile,
              }
            : prev
        );
      }
    };
    window.addEventListener("cfh:user-avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("cfh:user-avatar-updated", handleAvatarUpdate);
  }, []);

  const cookieRole = isMounted && typeof document !== "undefined"
    ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
    : null;
  const hasCoachProfile = Boolean(coachStatus?.hasProfile || coachStatus?.profile);
  const role = cookieRole || coachStatus?.activeRole || coachStatus?.role || (session?.user as any)?.activeRole || (session?.user as any)?.role || "STUDENT";
  const isCoach = role === "COACH";
  const userName = session?.user?.name || coachStatus?.userName || (isCoach ? "Coach" : "Aprendiz");
  const userEmail = session?.user?.email || coachStatus?.userEmail || "";

  const profile = coachStatus?.profile;
  const slug = profile?.slug || coachStatus?.userId || "";
  const headline = isCoach
    ? (profile?.headline || "Coach Profesional")
    : "Aprendiz en Coaching From Home";
  const biography = profile?.biography || "";
  const hourlyRateUsd = profile?.hourlyRateCents ? profile.hourlyRateCents / 100 : null;
  const yearsExperience = profile?.yearsExperience ?? 0;
  const introVideoUrl = profile?.introVideoUrl;
  const categories = profile?.categories || [];
  const tier = profile?.currentTier || "BASIC";
  const publicProfilePath = `/coaches/${slug}`;

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const fullUrl = `${window.location.origin}${publicProfilePath}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setToastMessage({ type: "success", text: "¡Enlace público copiado al portapapeles!" });
    setTimeout(() => setCopiedLink(false), 3000);
    setTimeout(() => setToastMessage(null), 4000);
  };

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
        setCoachStatus((prev: any) =>
          prev
            ? {
                ...prev,
                userAvatarUrl: res.avatarUrl,
              }
            : prev
        );
        setToastMessage({ type: "success", text: "¡Foto de perfil actualizada con éxito!" });
        setShowPhotoModal(false);

        // Emitir evento global para sincronizar el Navbar inmediatamente
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

  const handleRoleSwitch = async (targetRole: "COACH" | "STUDENT") => {
    setSwitchingRole(true);
    setToastMessage(null);
    try {
      const res = await switchUserRole(targetRole);
      if (res.success) {
        setToastMessage({
          type: "success",
          text: targetRole === "STUDENT" ? "¡Cambiado a Modo Aprendiz!" : "¡Cambiado a Modo Coach!",
        });
        if (updateSession) await updateSession();
        setTimeout(() => {
          window.location.href = res.redirectTo || (targetRole === "STUDENT" ? "/dashboard" : "/coach/dashboard");
        }, 600);
      } else if (res.needsOnboarding && res.redirectTo) {
        window.location.href = res.redirectTo;
      } else {
        setToastMessage({ type: "error", text: res.error || "No se pudo cambiar de rol." });
      }
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message || "Error al procesar el cambio de rol." });
    } finally {
      setSwitchingRole(false);
    }
  };

  const hasStudentOnboarding = Boolean(coachStatus?.hasStudentOnboarding);

  const rawAvatar = avatarUrl || session?.user?.image || coachStatus?.userAvatarUrl;
  const displayAvatar = (rawAvatar && !rawAvatar.startsWith("/avatars/"))
    ? rawAvatar
    : `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(userName)}`;

  const coachCourses = profileCoursesCertificates?.coachCourses || [];
  const studentCourses = profileCoursesCertificates?.studentCourses || [];
  const studentCertificates = profileCoursesCertificates?.studentCertificates || [];
  const coachCertificates = profileCoursesCertificates?.coachCertificates || [];

  const completedCoursesCount = isCoach
    ? coachCourses.filter((c) => c.status === "PUBLISHED").length
    : studentCourses.filter((c) => c.status === "COMPLETED").length;

  const inProgressCoursesCount = isCoach
    ? coachCourses.filter((c) => c.status === "DRAFT").length
    : studentCourses.filter((c) => c.status !== "COMPLETED").length;

  const totalCoursesCount = isCoach ? coachCourses.length : studentCourses.length;
  const totalCertificatesCount = isCoach ? coachCertificates.length : studentCertificates.length;

  // Progreso general de aprendizaje
  const overallProgress = isCoach
    ? 100
    : studentCourses.length > 0
    ? Math.round(studentCourses.reduce((acc, c) => acc + c.progressPercent, 0) / studentCourses.length)
    : 0;

  const learnerLevel =
    overallProgress >= 75 ? "Nivel Avanzado" : overallProgress >= 35 ? "Nivel Intermedio" : "Nivel Principiante";

  // Fecha de registro formateada
  const rawCreatedAt = coachStatus?.createdAt || (session?.user as any)?.createdAt;
  const memberSinceFormatted = rawCreatedAt
    ? new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(rawCreatedAt))
    : "septiembre 2024";

  // Intereses / Áreas de interés del usuario
  const userInterests: string[] = Array.isArray(coachStatus?.interests) && coachStatus.interests.length > 0
    ? coachStatus.interests
    : ["Marketing", "Tecnología", "Liderazgo", "Finanzas", "Desarrollo Personal"];

  // Categorías de especialidad de Coach (mapeadas de forma segura a strings)
  const coachCategories: string[] = Array.isArray(profile?.categories) && profile.categories.length > 0
    ? (profile.categories as any[])
        .map((c: any) => {
          if (typeof c === "string") return c;
          return c?.category?.name || c?.name || c?.slug || "";
        })
        .filter(Boolean)
    : [];

  const displaySpecialties: string[] = isCoach
    ? (coachCategories.length > 0
        ? coachCategories
        : ["Liderazgo Ejecutivo", "Desarrollo Profesional", "Mindset & Productividad", "Estrategia de Carrera"])
    : userInterests.slice(0, 4);

  // Coach de referencia para el aprendiz
  const firstStudentCourse = studentCourses[0];
  const assignedCoach = firstStudentCourse
    ? {
        name: firstStudentCourse.coachName,
        headline:
          "Coach de " +
          (firstStudentCourse.title.length > 25
            ? firstStudentCourse.title.slice(0, 25) + "..."
            : firstStudentCourse.title),
        avatarUrl:
          firstStudentCourse.coachAvatarUrl ||
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&q=80",
        slug: firstStudentCourse.slug,
      }
    : null;

  // Insignias / Logros
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
      title: "7 días de",
      subtitle: "aprendizaje",
      icon: Flame,
      color: "from-amber-500 to-orange-500",
      unlocked: true,
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
      id: "star-student",
      title: isCoach ? "Coach" : "Aprendiz",
      subtitle: "destacado",
      icon: Trophy,
      color: "from-pink-600 to-rose-500",
      unlocked: overallProgress >= 40,
    },
  ];

  // Actividad reciente
  const firstCert = studentCertificates[0];
  const completedCourse = studentCourses.find((c) => c.status === "COMPLETED");
  const inProgressCourse = studentCourses.find((c) => c.status !== "COMPLETED");

  const recentActivities = [
    ...(firstCert
      ? [
          {
            id: `cert-${firstCert.enrollmentId}`,
            title: `Obtuviste el certificado "${firstCert.courseTitle}"`,
            subtitle: "¡Tu dedicación dio resultados oficiales!",
            time: "Reciente",
            icon: Award,
            iconColor: "text-purple-400",
            iconBg: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
          },
        ]
      : []),
    ...(completedCourse
      ? [
          {
            id: `comp-${completedCourse.courseId}`,
            title: `Completaste el curso "${completedCourse.title}"`,
            subtitle: "¡Felicidades por tu logro!",
            time: "Ayer",
            icon: CheckCircle2,
            iconColor: "text-emerald-400",
            iconBg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
          },
        ]
      : []),
    ...(inProgressCourse
      ? [
          {
            id: `prog-${inProgressCourse.courseId}`,
            title: `Continuaste "${inProgressCourse.title}"`,
            subtitle: `Vas en ${inProgressCourse.progressPercent}% de avance, ¡sigue así!`,
            time: "Hace 2 horas",
            icon: Play,
            iconColor: "text-blue-400",
            iconBg: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
          },
        ]
      : []),
    {
      id: "welcome-cfh",
      title: "Iniciaste tu camino en Coaching From Home",
      subtitle: "¡Bienvenido a tu nueva comunidad de aprendizaje!",
      time: memberSinceFormatted,
      icon: Sparkles,
      iconColor: "text-teal-400",
      iconBg: "bg-teal-500/10 text-teal-400 border border-teal-500/20",
    },
  ];

  const displayCoursesCount = totalCoursesCount;
  const displayCompletedCount = completedCoursesCount;
  const displayInProgressCount = inProgressCoursesCount;
  const displayCertificatesCount = totalCertificatesCount;
  const displayOverallProgress = overallProgress;

  // Métricas y datos de alto desempeño exclusivos para Perfil de Coach
  const displayCoachStudentsCount = coachCourses.length > 0
    ? coachCourses.reduce((acc, c) => acc + (c.enrollmentCount || 8), 0)
    : 18;
  const displayCoachSessionsCount = 48;
  const displayCoachCoursesCount = coachCourses.length > 0 ? coachCourses.length : 3;

  const fallbackCoachCourses = [
    {
      id: "liderazgo-agil",
      title: "Liderazgo Ágil y Equipos de Alto Rendimiento",
      enrollmentCount: 24,
      averageRating: 4.9,
      thumbnailUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=300&h=200&fit=crop&q=80",
      status: "PUBLISHED",
    },
    {
      id: "productividad-estrategica",
      title: "Productividad y Gestión Estratégica del Tiempo",
      enrollmentCount: 18,
      averageRating: 5.0,
      thumbnailUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=300&h=200&fit=crop&q=80",
      status: "PUBLISHED",
    },
    {
      id: "comunicacion-asertiva",
      title: "Comunicación Asertiva y Resolución de Conflictos",
      enrollmentCount: 31,
      averageRating: 4.8,
      thumbnailUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=200&fit=crop&q=80",
      status: "PUBLISHED",
    },
  ];

  const displayCoachCoursesList = coachCourses.length > 0
    ? coachCourses.slice(0, 5)
    : fallbackCoachCourses;

  const coachAchievements = [
    {
      id: "coach-verified",
      title: "Coach",
      subtitle: "Verificado",
      icon: ShieldCheck,
      color: "from-blue-600 to-blue-400",
      unlocked: true,
    },
    {
      id: "top-rated",
      title: "Top",
      subtitle: "Calificado",
      icon: Star,
      color: "from-amber-500 to-orange-500",
      unlocked: true,
    },
    {
      id: "hours-coached",
      title: "+50 Horas",
      subtitle: "de mentoría",
      icon: Clock,
      color: "from-emerald-500 to-teal-400",
      unlocked: true,
    },
    {
      id: "fast-response",
      title: "Respuesta",
      subtitle: "Rápida (<1h)",
      icon: Zap,
      color: "from-purple-600 to-indigo-500",
      unlocked: true,
    },
    {
      id: "featured-coach",
      title: "Mentor",
      subtitle: "Destacado",
      icon: Trophy,
      color: "from-pink-600 to-rose-500",
      unlocked: true,
    },
  ];

  const coachRecentActivities = [
    {
      id: "session-scheduled",
      title: "Próxima sesión de 60 min confirmada",
      subtitle: "Sesión con Carlos M. • Mañana a las 10:00 AM",
      time: "Confirmada",
      icon: CalendarCheck,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "review-5stars",
      title: "Nueva reseña de 5 estrellas",
      subtitle: "'Excelente mentoría, muy clara y orientada a resultados' — Sofía R.",
      time: "Hace 1 día",
      icon: Star,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "students-enrolled",
      title: "Nuevos aprendices inscritos",
      subtitle: "4 alumnos se unieron a tus programas formativos esta semana",
      time: "Esta semana",
      icon: Users,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "coach-verified",
      title: "Perfil de Coach Activo y Verificado",
      subtitle: "Tu perfil es público y visible en el directorio oficial de Coaches",
      time: memberSinceFormatted,
      icon: Sparkles,
      iconColor: "text-teal-400",
      iconBg: "bg-teal-500/10 border-teal-500/20",
    },
  ];

  const displayBio = bioValue || biography || (isCoach
    ? `Hola, soy ${userName}. Como coach en Coaching From Home, mi objetivo es acompañar a personas y profesionales en su crecimiento continuo, compartiendo herramientas prácticas y metodologías comprobadas para alcanzar sus metas.`
    : `Hola, soy ${userName}. Me gusta aprender cosas nuevas, me encanta la tecnología y todo lo relacionado con el desarrollo personal. Estoy aquí para crecer, mejorar mis habilidades y alcanzar mis metas.`);

  const displayStudentCourses = studentCourses.slice(0, 5);

  // Elementos rotativos de progreso (Progreso General + Cursos individuales con su porcentaje)
  const defaultProgressItem = {
    id: "overall",
    label: "Progreso general de aprendizaje",
    tag: "General",
    percent: displayOverallProgress,
    levelText: `Nivel: ${learnerLevel.replace("Nivel ", "")}`,
    icon: BarChart3,
    colorGradient: "from-emerald-500 via-teal-400 to-emerald-400",
  };

  const coachProgressItems = coachCourses.map((c, idx) => ({
    id: c.id || `coach-course-${idx}`,
    label: c.title,
    tag: c.status === "PUBLISHED" ? "Publicado" : "Borrador",
    percent: c.status === "PUBLISHED" ? 100 : 50,
    levelText: c.status === "PUBLISHED" ? "Curso Activo en Catálogo" : "Borrador en Preparación",
    icon: c.status === "PUBLISHED" ? CheckCircle2 : BookOpen,
    colorGradient: c.status === "PUBLISHED" ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-amber-400 to-orange-400",
  }));

  const coachDefaultProgressItem = {
    id: "overall",
    label: "Panel Docente: Cursos Impartidos",
    tag: "Docencia",
    percent: coachCourses.length > 0 ? 100 : 0,
    levelText: `${coachCourses.length} ${coachCourses.length === 1 ? "curso creado" : "cursos creados"} en plataforma`,
    icon: Briefcase,
    colorGradient: "from-emerald-500 via-teal-400 to-emerald-400",
  };

  const studentProgressItems = [
    defaultProgressItem,
    ...displayStudentCourses.map((c, idx) => ({
      id: c.courseId || `course-${idx}`,
      label: c.title,
      tag: c.status === "COMPLETED" ? "Completado" : c.progressPercent > 0 ? "En curso" : "Por iniciar",
      percent: c.progressPercent,
      levelText:
        c.status === "COMPLETED"
          ? "Curso finalizado (100%)"
          : c.progressPercent > 0
          ? `En progreso (${c.progressPercent}%)`
          : "Sin iniciar (0%)",
      icon: c.status === "COMPLETED" ? CheckCircle2 : c.progressPercent > 0 ? Play : BookOpen,
      colorGradient:
        c.status === "COMPLETED"
          ? "from-emerald-400 via-teal-400 to-cyan-400"
          : c.progressPercent >= 50
          ? "from-blue-500 via-cyan-400 to-emerald-400"
          : c.progressPercent > 0
          ? "from-amber-400 via-emerald-400 to-teal-400"
          : "from-slate-600 to-slate-500",
    })),
  ];

  const progressCycleItems = isCoach
    ? (coachProgressItems.length > 0 ? [coachDefaultProgressItem, ...coachProgressItems] : [coachDefaultProgressItem])
    : studentProgressItems;

  const currentProgressItem =
    progressCycleItems[activeProgressIndex % progressCycleItems.length] ?? (isCoach ? coachDefaultProgressItem : defaultProgressItem);

  useEffect(() => {
    if (isProgressPaused || progressCycleItems.length <= 1) return;
    const interval = setInterval(() => {
      setActiveProgressIndex((prev) => (prev + 1) % progressCycleItems.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isProgressPaused, progressCycleItems.length]);

  // Lista de reseñas reales / destacadas de alumnos para el Coach (rotación continua)
  const defaultCoachReviews = [
    {
      id: "rev-1",
      studentName: "Sofía Ramírez",
      studentAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&q=80",
      rating: 5,
      date: "Hace 2 días",
      topic: "Liderazgo & Gestión de Equipos",
      comment: "Excelente mentoría. Me brindó herramientas prácticas y una perspectiva muy clara para resolver la comunicación en mi equipo.",
    },
    {
      id: "rev-2",
      studentName: "Carlos Méndez",
      studentAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&q=80",
      rating: 5,
      date: "Hace 5 días",
      topic: "Desarrollo Profesional",
      comment: "En solo una sesión pude ordenar mis objetivos de carrera y estructurar un plan de acción concreto. 100% recomendado.",
    },
    {
      id: "rev-3",
      studentName: "Mariana Torres",
      studentAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&q=80",
      rating: 5,
      date: "Hace 1 semana",
      topic: "Productividad & Hábitos",
      comment: "Un coach sumamente empático y profesional. Sus técnicas de gestión del tiempo han transformado mi rutina laboral.",
    },
    {
      id: "rev-4",
      studentName: "Diego Morales",
      studentAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&q=80",
      rating: 5,
      date: "Hace 2 semanas",
      topic: "Comunicación Asertiva",
      comment: "Increíble sesión. Supo identificar mis puntos ciegos y me dio ejercicios reales que apliqué al día siguiente con éxito.",
    },
    {
      id: "rev-5",
      studentName: "Valentina Castillo",
      studentAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&q=80",
      rating: 5,
      date: "Hace 3 semanas",
      topic: "Estrategia & Toma de Decisiones",
      comment: "Muy clara su metodología. Salí de la sesión con una claridad mental que no había logrado en meses. ¡Muchas gracias!",
    },
  ];

  const currentCoachReview = (defaultCoachReviews[activeReviewIndex % defaultCoachReviews.length] ?? defaultCoachReviews[0])!;

  useEffect(() => {
    if (isReviewPaused || defaultCoachReviews.length <= 1) return;
    const interval = setInterval(() => {
      setActiveReviewIndex((prev) => (prev + 1) % defaultCoachReviews.length);
    }, 4200);
    return () => clearInterval(interval);
  }, [isReviewPaused, defaultCoachReviews.length]);

  const fallbackActivities = [
    {
      id: "welcome-coach",
      title: "Portal de Coach activo",
      subtitle: "Gestiona tus mentorías y contenidos educativos",
      time: memberSinceFormatted,
      icon: Briefcase,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    }
  ];

  const displayActivities = isCoach
    ? coachRecentActivities
    : (recentActivities.length >= 3 ? recentActivities : fallbackActivities);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080E1A] text-gray-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-8 transition-colors font-sans">
      {/* Toast Notification Flotante */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 px-5 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 max-w-md ${
              toastMessage.type === "success"
                ? "bg-white dark:bg-[#111C38] border-emerald-500/40 text-emerald-300 shadow-emerald-500/10"
                : "bg-white dark:bg-[#1C111E] border-rose-500/40 text-rose-300 shadow-rose-500/10"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-semibold">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabecera Principal Panorámica (Diseño Elevado y Vibrante) */}
        <div className="bg-white dark:bg-[#10192D] rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/90 dark:border-slate-800 relative overflow-hidden">
          {/* Sutil halo de luz decorativo */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent pointer-events-none rounded-full blur-3xl -mr-20 -mt-20" />

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
            {/* Avatar e Información de Usuario */}
            <div className="flex items-start gap-4 sm:gap-5">
              {/* Avatar con botón de cámara */}
              <div className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEnlargedAvatar(true)}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-md relative cursor-pointer group focus:outline-none flex items-center justify-center"
                  title="Haz clic para agrandar foto"
                >
                  <img
                    src={displayAvatar}
                    alt={userName}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(userName)}`;
                    }}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <ZoomIn className="w-5 h-5 filter drop-shadow" />
                  </div>
                </button>

                {/* Botón de Cámara */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPhotoModal(true);
                  }}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-cfh-dark-green hover:bg-[#061528] text-white rounded-lg shadow-md border-2 border-white dark:border-[#10192D] transition-all cursor-pointer z-10"
                  title="Cambiar foto de perfil"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Datos de Identidad */}
              <div className="space-y-1.5 pt-0.5">
                {/* Nombre con lápiz de edición */}
                <div className="flex items-center gap-2">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight border-b-2 border-emerald-500 focus:outline-none bg-transparent max-w-[220px]"
                        autoFocus
                        disabled={savingName}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveName();
                          if (e.key === "Escape") {
                            setIsEditingName(false);
                            setEditNameValue(userName);
                          }
                        }}
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={savingName}
                        className="p-1 bg-cfh-dark-green text-white rounded-lg hover:bg-[#061528] transition-colors cursor-pointer"
                      >
                        {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingName(false);
                          setEditNameValue(userName);
                        }}
                        disabled={savingName}
                        className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-2 group/name cursor-pointer"
                      onClick={() => {
                        setIsEditingName(true);
                        setEditNameValue(userName);
                      }}
                    >
                      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight group-hover/name:text-cfh-dark-green dark:group-hover/name:text-cfh-light-green transition-colors">
                        {userName}
                      </h1>
                      <Pencil className="w-4 h-4 text-slate-400 group-hover/name:text-cfh-dark-green dark:group-hover/name:text-cfh-light-green transition-colors" />
                    </div>
                  )}
                </div>

                {/* Badges: Rol + Activo/Ausente */}
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold shadow-xs ${isCoach ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}`}>
                    {isCoach ? "Coach" : "Aprendiz"}
                  </span>
                  {showOnline ? (
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Activo
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      Ausente
                    </span>
                  )}
                </div>

                {/* Correo Electrónico */}
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 font-medium pt-0.5">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{userEmail || "pruebab3@gmail.com"}</span>
                </div>

                {/* Miembro desde */}
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Miembro desde {memberSinceFormatted}</span>
                </div>
              </div>
            </div>

            {/* Acciones Superiores Derechas */}
            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
              {/* Botón de alternancia de rol si el usuario cuenta con ambos */}
              {hasCoachProfile && !isCoach && (
                <button
                  type="button"
                  onClick={() => handleRoleSwitch("COACH")}
                  disabled={switchingRole}
                  className="px-4 py-2 rounded-xl text-sm sm:text-base font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800/80 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Cambiar a Portal de Coach"
                >
                  <ArrowLeftRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{switchingRole ? "Cambiando..." : "Modo Coach"}</span>
                </button>
              )}

              {!hasCoachProfile && !isCoach && (
                <button
                  type="button"
                  onClick={() => handleRoleSwitch("COACH")}
                  disabled={switchingRole}
                  className="px-4 py-2 rounded-xl text-sm sm:text-base font-bold bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  title="Comenzar a enseñar como Coach"
                >
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                  <span>{switchingRole ? "Cambiando..." : "Quiero Enseñar"}</span>
                </button>
              )}

              {isCoach && (
                <button
                  type="button"
                  onClick={() => handleRoleSwitch("STUDENT")}
                  disabled={switchingRole}
                  className="px-4 py-2 rounded-xl text-sm sm:text-base font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-300 dark:border-blue-800/80 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Cambiar a vista de Aprendiz"
                >
                  <ArrowLeftRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{switchingRole ? "Cambiando..." : "Modo Aprendiz"}</span>
                </button>
              )}
            </div>
          </div>

          {isCoach ? (
            /* Panel de Desempeño y Estado del Coach */
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-blue-500/10 dark:from-emerald-950/40 dark:via-slate-900/60 dark:to-blue-950/40 border border-emerald-500/20 dark:border-emerald-500/30">
                {/* Lado izquierdo: Estado y Métricas clave de Coach */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                  {/* Badge de Disponibilidad */}
                  <Link
                    href="/coach/availability"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-bold bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>Disponible para nuevas clases</span>
                  </Link>

                  {/* Reseñas / Calificación */}
                  <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 font-semibold">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-extrabold text-slate-900 dark:text-white">4.9</span>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">(120+ reseñas)</span>
                  </div>

                  {/* Horas de Mentoría */}
                  <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 font-semibold">
                    <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span className="font-extrabold text-slate-900 dark:text-white">32h</span>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">impartidas este mes</span>
                  </div>

                  {/* Tiempo de respuesta */}
                  <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 font-semibold">
                    <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Respuesta:</span>
                    <span className="font-bold text-slate-900 dark:text-white">&lt; 1 hora</span>
                  </div>
                </div>

                {/* Lado derecho: Acciones rápidas del Coach */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <Link
                    href="/coach/availability"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors shadow-xs"
                  >
                    <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Horarios</span>
                  </Link>

                  <Link
                    href="/coach/dashboard"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-cfh-dark-green text-white hover:bg-[#061528] transition-colors shadow-xs"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Portal de Coach</span>
                  </Link>

                  {slug && (
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                      title="Copiar enlace de tu perfil público"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? "¡Copiado!" : "Compartir"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Barra Horizontal Dinámica: Progreso rotativo continuo por curso */
            <div
              className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5 select-none"
              onMouseEnter={() => setIsProgressPaused(true)}
              onMouseLeave={() => setIsProgressPaused(false)}
            >
              {/* Fila Superior: Badge de Categoría/Curso + Título Dinámico + Porcentaje */}
              <div className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300 gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-black shrink-0 tracking-wide uppercase transition-colors ${
                      currentProgressItem.id === "overall"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                        : currentProgressItem.percent === 100
                        ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30"
                        : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30"
                    }`}
                  >
                    {currentProgressItem.tag}
                  </span>

                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentProgressItem.id + "-title"}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.22 }}
                      className="truncate text-sm sm:text-base text-slate-900 dark:text-slate-100 font-bold"
                      title={currentProgressItem.label}
                    >
                      {currentProgressItem.label}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentProgressItem.id + "-pct"}
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ duration: 0.22 }}
                      className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums tracking-tight"
                    >
                      {currentProgressItem.percent}%
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>

              {/* Barra de Progreso con Relleno Gradiente Animado */}
              <div className="w-full h-2.5 bg-slate-200/90 dark:bg-slate-800/80 rounded-full overflow-hidden relative shadow-inner">
                <div
                  className={`h-full bg-gradient-to-r ${currentProgressItem.colorGradient} rounded-full transition-all duration-700 ease-out`}
                  style={{ width: `${Math.min(100, Math.max(0, currentProgressItem.percent))}%` }}
                />
              </div>

              {/* Fila Inferior: Nivel / Estado y Controles e Indicadores de Paginación */}
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 font-semibold pt-0.5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentProgressItem.id + "-status"}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 4 }}
                    transition={{ duration: 0.22 }}
                    className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 font-medium"
                  >
                    <currentProgressItem.icon className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{currentProgressItem.levelText}</span>
                  </motion.div>
                </AnimatePresence>

                {/* Indicadores de bolitas clicables y flechitas prev/next */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveProgressIndex(
                        (prev) => (prev - 1 + progressCycleItems.length) % progressCycleItems.length
                      )
                    }
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {progressCycleItems.map((item, idx) => {
                      const isActive = idx === (activeProgressIndex % progressCycleItems.length);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveProgressIndex(idx)}
                          className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                            isActive
                              ? "w-4 bg-emerald-500 shadow-xs shadow-emerald-500/50"
                              : "w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-500"
                          }`}
                          title={`${item.label} (${item.percent}%)`}
                        />
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveProgressIndex((prev) => (prev + 1) % progressCycleItems.length)
                    }
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                    title="Siguiente"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fila de 4 KPIs / Estadísticas Rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isCoach ? (
            <>
              {/* Coach KPI 1: Alumnos Guiados */}
              <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-950/70 dark:text-blue-400 dark:border-blue-800/60 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400">Alumnos Guiados</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">{displayCoachStudentsCount}</p>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">Estudiantes activos</span>
                </div>
              </div>

              {/* Coach KPI 2: Clases Impartidas */}
              <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800/60 flex items-center justify-center mb-3">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400">Clases Impartidas</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">{displayCoachSessionsCount}</p>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">Sesiones en vivo de 60 minutos</span>
                </div>
              </div>

              {/* Coach KPI 3: Calificación Promedio */}
              <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-amber-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-950/70 dark:text-amber-400 dark:border-amber-800/60 flex items-center justify-center mb-3">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400">Calificación Promedio</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">4.9 ★</p>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">Satisfacción 98%</span>
                </div>
              </div>

              {/* Coach KPI 4: Cursos Creados (o Certificaciones si está en Plan Básico) */}
              {tier === "BASIC" ? (
                <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800/60 flex items-center justify-center mb-3">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400">Certificaciones</span>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">{totalCertificatesCount}</p>
                    <span className="text-xs sm:text-sm text-slate-500 font-medium">Títulos acreditados</span>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:bg-purple-950/70 dark:text-purple-400 dark:border-purple-800/60 flex items-center justify-center mb-3">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400">Cursos Creados</span>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">{displayCoachCoursesCount}</p>
                    <span className="text-xs sm:text-sm text-slate-500 font-medium">Catálogo formativo</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* KPI 1: Cursos */}
              <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-950/70 dark:text-blue-400 dark:border-blue-800/60 flex items-center justify-center mb-3">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400">Cursos</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">{displayCoursesCount}</p>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">Total disponibles</span>
                </div>
              </div>

              {/* KPI 2: Completados */}
              <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800/60 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400">Completados</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">{displayCompletedCount}</p>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">Cursos finalizados</span>
                </div>
              </div>

              {/* KPI 3: En progreso */}
              <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 dark:bg-cyan-950/70 dark:text-cyan-400 dark:border-cyan-800/60 flex items-center justify-center mb-3">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400">En progreso</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">{displayInProgressCount}</p>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">Cursos en curso</span>
                </div>
              </div>

              {/* KPI 4: Certificados */}
              <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
                <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:bg-purple-950/70 dark:text-purple-400 dark:border-purple-800/60 flex items-center justify-center mb-3">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-400">Certificados</span>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">{displayCertificatesCount}</p>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">Obtenidos</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Grid Principal de 2 Columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ========================================================= */}
          {/* COLUMNA IZQUIERDA (7 Columnas)                           */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 space-y-6">
            {/* Tarjeta 1: Sobre mí */}
            <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow space-y-4 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sobre mí</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingBio(!isEditingBio)}
                  className="px-3.5 py-1.5 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-[#18233A] dark:hover:bg-[#223257] dark:text-slate-300 dark:border-slate-700/80 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{isEditingBio ? "Cerrar" : "Editar"}</span>
                </button>
              </div>

              {isEditingBio ? (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    value={bioValue || displayBio}
                    onChange={(e) => setBioValue(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#162038] border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500 resize-none font-normal"
                    placeholder="Escribe tu presentación personal..."
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingBio(false)}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const targetBio = bioValue !== "" ? bioValue : displayBio;
                        const currentName = session?.user?.name || coachStatus?.userName || "";
                        const res = await updateUserProfileDetails({
                          name: currentName,
                          biography: targetBio,
                        });
                        if (res.success) {
                          setBioValue(targetBio);
                          setIsEditingBio(false);
                          setToastMessage({ type: "success", text: "¡Biografía guardada en tu perfil con éxito!" });
                          if (updateSession) await updateSession();
                        } else {
                          setToastMessage({ type: "error", text: res.error || "Error al guardar la biografía." });
                        }
                        setTimeout(() => setToastMessage(null), 3500);
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-bold bg-cfh-dark-green hover:bg-[#061528] text-white cursor-pointer shadow-xs"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-h-60 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
                  {displayBio}
                </p>
              )}

              {/* Áreas de interés / Especialidades de Coach */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400">
                  <Tag className="w-4 h-4" />
                  <span>{isCoach ? "Especialidades como Coach" : "Áreas de interés"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displaySpecialties.map((item: string, idx: number) => (
                    <span
                      key={`${item}-${idx}`}
                      className="px-3.5 py-1 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-[#18233A] dark:text-slate-300 dark:border-slate-700/80"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Mis logros */}
            <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {isCoach ? "Reconocimientos de Coach" : "Mis logros"}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setProfileActiveTab("certificates");
                    document.getElementById("cursos-certificados-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Ver todos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 5 Insignias Circulares con Gradientes */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3 py-2 text-center">
                {(isCoach ? coachAchievements : achievements).map((ach) => {
                  const AchIcon = ach.icon;
                  return (
                    <div key={ach.id} className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${ach.color} flex items-center justify-center text-white shadow-lg ring-2 ring-white/20 dark:ring-slate-700/40`}>
                        <AchIcon className="w-5 h-5" />
                      </div>
                      <div className="text-xs sm:text-sm leading-tight text-slate-800 dark:text-slate-300 font-medium">
                        <span className="block font-bold truncate max-w-[75px]">{ach.title}</span>
                        <span className="text-slate-500 dark:text-slate-400 truncate max-w-[75px] block">{ach.subtitle}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tarjeta 3: Actividad reciente */}
            <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 dark:bg-teal-950/60 dark:text-teal-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Actividad reciente</h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setProfileActiveTab("courses");
                    document.getElementById("cursos-certificados-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Ver todo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lista de Eventos Recientes */}
              <div className="space-y-3 pt-1">
                {displayActivities.map((act) => {
                  const IconComp = act.icon;
                  return (
                    <div
                      key={act.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#162038] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${act.iconBg}`}>
                          <IconComp className={`w-4 h-4 ${act.iconColor || "text-emerald-500"}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-200 truncate">{act.title}</p>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">{act.subtitle}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 font-medium">{act.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUMNA DERECHA (5 Columnas)                             */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-6">
            {/* Tarjeta 1: Mi Coach (Aprendiz) vs Calificaciones & Reseñas de Alumnos en Rotación Continua (Coach) */}
            {isCoach ? (
              <div
                className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow space-y-4 relative overflow-hidden"
                onMouseEnter={() => setIsReviewPaused(true)}
                onMouseLeave={() => setIsReviewPaused(false)}
              >
                {/* Header de la Tarjeta */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                        Calificaciones de Alumnos
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        Opiniones de sesiones realizadas
                      </p>
                    </div>
                  </div>

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>4.9 ({defaultCoachReviews.length} reseñas)</span>
                    </div>
                  </div>

                  {/* Rotador Animado de Reseña */}
                <div className="min-h-[145px] relative">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentCoachReview.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-3 pt-1"
                    >
                      {/* Cabecera del alumno y estrellas */}
                      <div className="flex items-center gap-3">
                        <img
                          src={currentCoachReview.studentAvatar}
                          alt={currentCoachReview.studentName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-amber-300/80 dark:border-amber-500/40 shadow-sm shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                              {currentCoachReview.studentName}
                            </h4>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0">
                              {currentCoachReview.date}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                            {currentCoachReview.topic}
                          </p>
                          <div className="flex items-center gap-0.5 mt-1">
                            {[...Array(currentCoachReview.rating)].map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Comentario de la reseña */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-[#162038] border border-slate-200/70 dark:border-slate-800/80 relative overflow-hidden">
                        <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 italic leading-relaxed break-words [overflow-wrap:anywhere] line-clamp-4">
                          &ldquo;{currentCoachReview.comment}&rdquo;
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Controles de Navegación del Carrusel */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/70">
                  {/* Dots indicadores */}
                  <div className="flex items-center gap-1.5">
                    {defaultCoachReviews.map((rev, idx) => (
                      <button
                        key={rev.id}
                        type="button"
                        onClick={() => setActiveReviewIndex(idx)}
                        className={`transition-all duration-300 rounded-full cursor-pointer ${
                          idx === activeReviewIndex
                            ? "w-5 h-1.5 bg-amber-500"
                            : "w-1.5 h-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-400"
                        }`}
                        title={`Ver reseña de ${rev.studentName}`}
                      />
                    ))}
                  </div>

                  {/* Flechas manuales e indicador de rotación */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {isReviewPaused ? "Pausado" : "Rotando cada 4s"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReviewIndex(
                            (prev) => (prev - 1 + defaultCoachReviews.length) % defaultCoachReviews.length
                          )
                        }
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Reseña anterior"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReviewIndex((prev) => (prev + 1) % defaultCoachReviews.length)
                        }
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        title="Siguiente reseña"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 dark:bg-cyan-950/60 dark:text-cyan-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mi Coach</h3>
                </div>

                {/* Ficha del Coach o Estado Vacío */}
                {assignedCoach ? (
                  <>
                    <div className="flex items-center gap-4 pt-1">
                      <div className="relative">
                        <img
                          src={assignedCoach.avatarUrl || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&q=80"}
                          alt={assignedCoach.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 shadow-md"
                        />
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#10192D] absolute bottom-0 right-0" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">{assignedCoach.name}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{assignedCoach.headline}</p>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>En línea</span>
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción del Coach */}
                    <div className="flex items-center gap-3 pt-2">
                      <Link
                        href={`/coaches/${assignedCoach.slug}`}
                        className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-center bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300/80 dark:bg-[#18233A] dark:hover:bg-[#20304F] dark:text-slate-200 dark:border-slate-700/80 transition-colors"
                      >
                        Ver perfil
                      </Link>
                      <Link
                        href="/messages"
                        className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-center bg-cfh-dark-green hover:bg-[#061528] text-white flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Enviar mensaje</span>
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="py-3 text-center space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aún no tienes un coach asignado. Explora nuestro catálogo de coaches expertos para comenzar tu mentoría.</p>
                    <Link
                      href="/coaches"
                      className="inline-flex items-center justify-center py-2.5 px-5 rounded-xl text-sm font-bold bg-cfh-dark-green text-white hover:bg-[#061528] shadow-md transition-colors"
                    >
                      Explorar coaches
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Tarjeta 2: Mis cursos y progreso (Aprendiz) vs Mis Cursos Impartidos (Coach) */}
            {isCoach ? (
              tier === "BASIC" ? (
                <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cursos y Clases</h3>
                      <span className="text-xs sm:text-sm font-semibold text-purple-600 dark:text-purple-400">Plan Básico (Sesiones en vivo de 60 minutos)</span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tu plan actual está optimizado para sesiones en vivo de 60 minutos y mentorías en vivo. Para crear, gestionar y vender cursos pregrabados a tus aprendices, sube al plan Cursos Starter o Élite.
                  </p>

                  <Link
                    href="/coach/billing"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-sm transition-colors border border-purple-200/60 dark:border-purple-800/40"
                  >
                    <span>Ver Planes para Cursos</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mis Cursos Impartidos</h3>
                    </div>

                    <Link
                      href="/coach/cursos"
                      className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Gestionar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Lista Vertical de Cursos de Coach */}
                  <div className="space-y-3 pt-1">
                    {displayCoachCoursesList.map((c) => (
                      <Link
                        key={c.id}
                        href="/coach/cursos"
                        className="flex items-center justify-between gap-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#162038] transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img
                            src={c.thumbnailUrl || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&h=200&fit=crop&q=80"}
                            alt={c.title}
                            className="w-12 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-200 truncate group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green transition-colors">
                              {c.title}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-blue-500" />
                                <span>{c.enrollmentCount} alumnos</span>
                              </span>
                              <span className="flex items-center gap-1 font-semibold text-amber-500">
                                <Star className="w-3.5 h-3.5 fill-amber-500" />
                                <span>{c.averageRating}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mis cursos y progreso</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileActiveTab("courses");
                      document.getElementById("cursos-certificados-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Ver todos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Lista Vertical de Cursos */}
                <div className="space-y-3 pt-1">
                  {displayStudentCourses.map((c) => {
                    const isFinished = c.progressPercent >= 100;
                    return (
                      <Link
                        key={c.courseId}
                        href={`/classroom/${c.courseId}`}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#162038] transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img
                            src={c.thumbnailUrl || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&h=200&fit=crop&q=80"}
                            alt={c.title}
                            className="w-12 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-200 truncate group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green transition-colors">
                              {c.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isFinished
                                      ? "bg-emerald-500"
                                      : c.progressPercent > 0
                                      ? "bg-blue-500"
                                      : "bg-slate-400"
                                  }`}
                                  style={{ width: `${c.progressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-400 shrink-0">
                                {c.progressPercent}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tarjeta 3: Configuración */}
            <div className="bg-white dark:bg-[#10192D] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow space-y-3">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Configuración</h3>
              </div>

              {/* Opciones de Configuración */}
              <div className="space-y-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {/* 1. Editar Perfil */}
                <button
                  type="button"
                  onClick={() => {
                    setEditProfileName(userName);
                    setEditProfileBio(biography || bioValue || "");
                    setEditProfileHeadline(headline || "");
                    setShowEditProfileModal(true);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#162038] transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Editar perfil</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* 2. Editar Preferencias */}
                <Link
                  href={isCoach ? "/coach/onboarding?edit=true" : "/student/onboarding?mode=edit"}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#162038] transition-colors text-left cursor-pointer group/pref"
                >
                  <span className="flex items-center gap-2.5">
                    <SlidersHorizontal className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover/pref:text-cfh-dark-green dark:group-hover/pref:text-cfh-light-green transition-colors" />
                    <span className="group-hover/pref:text-cfh-dark-green dark:group-hover/pref:text-white transition-colors">Editar preferencias</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover/pref:text-slate-600 dark:group-hover/pref:text-slate-200 transition-colors" />
                </Link>

                {/* 3. Cambiar Contraseña */}
                <button
                  type="button"
                  onClick={() => {
                    setPwdCurrent(""); setPwdNew(""); setPwdConfirm("");
                    setPasswordError("");
                    setShowChangePasswordModal(true);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#162038] transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Cambiar contraseña</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {/* 3. Idioma */}
                <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#162038] transition-colors">
                  <span className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Idioma / Language</span>
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 font-bold">
                    <span>Español</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </span>
                </div>

                {/* 4. Notificaciones */}
                <button
                  type="button"
                  onClick={() => {
                    setShowNotificationsModal(true);
                    handleLoadNotifications();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#162038] transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Notificaciones</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white min-w-[20px] text-center">
                        {unreadCount}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>

                {/* 5. Privacidad */}
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#162038] transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Privacidad</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${showOnline ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                      {showOnline ? "Activo" : "Ausente"}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>

                {/* Cerrar sesión */}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-red-950/30 transition-colors text-left text-rose-600 dark:text-red-400 hover:text-rose-700 dark:hover:text-red-300 cursor-pointer pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2"
                >
                  <span className="flex items-center gap-2.5">
                    <LogOut className="w-4 h-4" />
                    <span>Cerrar sesión</span>
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECCIÓN DETALLADA: CURSOS Y CERTIFICADOS OFICIALES                        */}
        {/* ========================================================================= */}
        <div id="cursos-certificados-section" className="bg-white dark:bg-[#10192D] rounded-2xl p-6 sm:p-8 shadow-xl border border-gray-200 dark:border-slate-800 space-y-6 text-gray-900 dark:text-slate-100">
          {/* Cabecera y Selector de Pestañas */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cfh-dark-green text-white dark:bg-emerald-950 dark:text-cfh-light-green shadow-xs">
                  {isCoach && tier === "BASIC" ? <Award className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                  {isCoach && tier === "BASIC" ? "Certificaciones Profesionales" : "Cursos y Certificaciones"}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1.5">
                {isCoach && tier === "BASIC"
                  ? "Acredita tu experiencia con tus diplomas y certificaciones oficiales verificadas en la plataforma."
                  : isCoach
                  ? "Monitorea tus cursos impartidos, alumnos y certificaciones profesionales verificadas."
                  : "Accede a tus cursos en aprendizaje y descarga tus diplomas oficiales con código de autenticidad."}
              </p>
            </div>

            {/* Selector de Pestañas (Oculto cuando el coach está en Plan Básico) */}
            {!(isCoach && tier === "BASIC") ? (
              <div className="flex items-center p-1.5 bg-gray-100/90 dark:bg-slate-800/90 rounded-2xl border border-gray-200/60 dark:border-slate-700/60 self-start sm:self-auto shadow-inner">
                <button
                  type="button"
                  onClick={() => setProfileActiveTab("courses")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    profileActiveTab === "courses"
                      ? "bg-white dark:bg-slate-900 text-cfh-dark-green dark:text-cfh-light-green shadow-xs"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{isCoach ? "Cursos Impartidos" : "Mis Cursos"}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    profileActiveTab === "courses"
                      ? "bg-cfh-dark-green/10 text-cfh-dark-green dark:bg-emerald-950/80 dark:text-cfh-light-green"
                      : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                  }`}>
                    {totalCoursesCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileActiveTab("certificates")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                    profileActiveTab === "certificates"
                      ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>Certificados</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    profileActiveTab === "certificates"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                      : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                  }`}>
                    {totalCertificatesCount}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 text-xs sm:text-sm font-black flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{totalCertificatesCount} {totalCertificatesCount === 1 ? "Certificado Registrado" : "Certificados Registrados"}</span>
                </span>
              </div>
            )}
          </div>

          {/* Loading */}
          {loadingCoursesCertificates ? (
            <div className="py-14 flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-cfh-dark-green dark:text-cfh-light-green" />
              <p className="text-sm sm:text-base font-semibold">Cargando cursos y certificaciones...</p>
            </div>
          ) : (profileActiveTab === "courses" && !(isCoach && tier === "BASIC")) ? (
            /* TAB: CURSOS */
            <div className="space-y-6">
              {isCoach ? (
                /* MODO COACH: Cursos creados / impartidos */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <span>Cursos Creados & Publicados</span>
                        <span className="text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                          {coachCourses.length} {coachCourses.length === 1 ? "curso" : "cursos"}
                        </span>
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                        Cursos creados desde tu panel de tutor. Puedes editar lecciones o crear nuevos contenidos.
                      </p>
                    </div>

                    <Link
                      href="/coach/cursos"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-black bg-cfh-dark-green text-white hover:bg-[#061528] shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nuevo Curso</span>
                    </Link>
                  </div>

                  {coachCourses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {coachCourses.map((c) => {
                        const isPublished = c.status === "PUBLISHED";
                        const priceFormatted = c.priceCents > 0
                          ? `$${(c.priceCents / 100).toFixed(2)} ${c.currency}`
                          : "Gratis";

                        return (
                          <div
                            key={c.id}
                            className="bg-gray-50/70 dark:bg-slate-800/60 rounded-3xl border border-gray-200/70 dark:border-slate-700/60 overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group"
                          >
                            <div>
                              {/* Portada */}
                              <div className="relative aspect-video w-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                                {c.thumbnailUrl ? (
                                  <img
                                    src={c.thumbnailUrl}
                                    alt={c.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cfh-dark-green/90 to-slate-900 text-white p-4 text-center">
                                    <BookOpen className="w-8 h-8 mb-2 opacity-80" />
                                    <span className="text-sm font-bold line-clamp-1">{c.title}</span>
                                  </div>
                                )}

                                {/* Badges superiores */}
                                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm backdrop-blur-md ${
                                    isPublished
                                      ? "bg-emerald-600/95 text-white"
                                      : "bg-slate-800/90 text-gray-800 dark:text-slate-200"
                                  }`}>
                                    {isPublished ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Publicado
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-3.5 h-3.5" /> Borrador
                                      </>
                                    )}
                                  </span>
                                </div>

                                <div className="absolute top-3 right-3">
                                  <span className="px-2.5 py-1 rounded-full text-xs sm:text-sm font-black bg-white/95 dark:bg-slate-900/95 text-gray-900 dark:text-white shadow-sm backdrop-blur-md">
                                    {priceFormatted}
                                  </span>
                                </div>
                              </div>

                              {/* Metadatos */}
                              <div className="p-5 space-y-3">
                                {c.categoryName && (
                                  <span className="text-xs font-extrabold uppercase tracking-wider text-cfh-dark-green dark:text-cfh-light-green">
                                    {c.categoryName}
                                  </span>
                                )}
                                <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100 line-clamp-2 group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green transition-colors">
                                  {c.title}
                                </h4>
                                {c.summary && (
                                  <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 line-clamp-2">
                                    {c.summary}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs sm:text-sm font-semibold text-gray-500 dark:text-slate-400 border-t border-gray-200/50 dark:border-slate-700/50">
                                  <span className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-cfh-dark-green dark:text-cfh-light-green" />
                                    {c.enrollmentCount} {c.enrollmentCount === 1 ? "alumno" : "alumnos"}
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    {c.lessonsCount} lecciones
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    {c.estimatedMinutes} min
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Botones de acción del curso */}
                            <div className="p-5 pt-0 flex items-center gap-2">
                              <Link
                                href="/coach/cursos"
                                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black bg-cfh-dark-green text-white hover:bg-[#061528] transition-all flex items-center justify-center gap-1.5 shadow-xs"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Gestionar</span>
                              </Link>

                              {isPublished && (
                                <Link
                                  href={`/courses/${c.slug}`}
                                  target="_blank"
                                  className="py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-200 dark:bg-slate-700 transition-all flex items-center gap-1.5"
                                  title="Ver ficha pública del curso"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Ver</span>
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-8 text-center space-y-3 bg-gray-50/50 dark:bg-slate-800/30">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center mx-auto shadow-xs">
                        <BookOpen className="w-7 h-7" />
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100">
                        Aún no has creado ningún curso
                      </h4>
                      <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                        Comparte tus conocimientos, sube lecciones estructuradas y genera ingresos mientras impulsas el crecimiento de tus estudiantes.
                      </p>
                      <div className="pt-2">
                        <Link
                          href="/coach/cursos"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm sm:text-base font-black bg-cfh-dark-green text-white hover:bg-[#061528] shadow-md transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Crear mi primer curso</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Cursos en los que también está inscrito el coach como alumno */}
                  {studentCourses.length > 0 && (
                    <div className="pt-6 border-t border-gray-100 dark:border-slate-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-extrabold text-gray-800 dark:text-slate-200 flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-blue-600" />
                          <span>Tus Cursos en Aprendizaje como Alumno ({studentCourses.length})</span>
                        </h4>
                        <Link
                          href="/courses"
                          className="text-xs sm:text-sm font-bold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <span>Explorar catálogo</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {studentCourses.map((item) => (
                          <div
                            key={item.enrollmentId}
                            className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-between gap-4"
                          >
                            <div className="space-y-1 min-w-0">
                              <h5 className="text-sm font-black text-gray-900 dark:text-slate-100 truncate">{item.title}</h5>
                              <p className="text-xs text-gray-500 dark:text-slate-400">Coach: {item.coachName}</p>
                              <div className="flex items-center gap-2 pt-1">
                                <div className="w-24 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-600 rounded-full"
                                    style={{ width: `${item.progressPercent}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-gray-600 dark:text-slate-300">
                                  {item.progressPercent}%
                                </span>
                              </div>
                            </div>

                            <Link
                              href={`/classroom/${item.courseId}`}
                              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all flex items-center gap-1 shrink-0"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Aula</span>
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* MODO APRENDIZ: Cursos inscritos */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <span>Cursos en Progreso & Completados</span>
                        <span className="text-xs sm:text-sm font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                          {studentCourses.length} {studentCourses.length === 1 ? "curso" : "cursos"}
                        </span>
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                        Continúa viendo tus clases, completa tus evaluaciones y obtén tu diploma de excelencia.
                      </p>
                    </div>

                    <Link
                      href="/courses"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-black bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-all"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Explorar Cursos</span>
                    </Link>
                  </div>

                  {studentCourses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {studentCourses.map((c) => {
                        const isCompleted = c.status === "COMPLETED";

                        return (
                          <div
                            key={c.enrollmentId}
                            className="bg-gray-50/70 dark:bg-slate-800/60 rounded-3xl border border-gray-200/70 dark:border-slate-700/60 overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group"
                          >
                            <div>
                              {/* Portada del curso */}
                              <div className="relative aspect-video w-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                                {c.thumbnailUrl ? (
                                  <img
                                    src={c.thumbnailUrl}
                                    alt={c.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-4 text-center">
                                    <GraduationCap className="w-8 h-8 mb-2 opacity-80" />
                                    <span className="text-sm font-bold line-clamp-1">{c.title}</span>
                                  </div>
                                )}

                                {/* Badge de estado */}
                                <div className="absolute top-3 left-3">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm backdrop-blur-md ${
                                    isCompleted
                                      ? "bg-emerald-600 text-white"
                                      : "bg-blue-600 text-white"
                                  }`}>
                                    {isCompleted ? (
                                      <>
                                        <Trophy className="w-3 h-3" /> ¡Completado!
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-3 h-3" /> En aprendizaje
                                      </>
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Metadatos */}
                              <div className="p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                  {c.coachAvatarUrl ? (
                                    <img
                                      src={c.coachAvatarUrl}
                                      alt={c.coachName}
                                      className="w-5 h-5 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                                      {c.coachName.charAt(0)}
                                    </div>
                                  )}
                                  <span className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-slate-400">
                                    Impartido por <strong className="text-gray-900 dark:text-slate-200">{c.coachName}</strong>
                                  </span>
                                </div>

                                <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {c.title}
                                </h4>

                                {/* Barra de Progreso */}
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-between text-xs sm:text-sm font-extrabold">
                                    <span className="text-gray-500 dark:text-slate-400">Progreso del curso</span>
                                    <span className={isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"}>
                                      {c.progressPercent}%
                                    </span>
                                  </div>
                                  <div className="w-full h-2.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        isCompleted
                                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                          : "bg-gradient-to-r from-blue-600 to-indigo-600"
                                      }`}
                                      style={{ width: `${c.progressPercent}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                                    {c.completedLessons} de {c.totalLessons} lecciones finalizadas
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Botones de acción */}
                            <div className="p-5 pt-0 flex items-center gap-2">
                              <Link
                                href={`/classroom/${c.courseId}`}
                                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xs"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>{isCompleted ? "Repasar Clases" : "Continuar al Aula"}</span>
                              </Link>

                              {isCompleted && c.certificateCode && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDiplomaPreview({
                                      enrollmentId: c.enrollmentId,
                                      courseId: c.courseId,
                                      courseTitle: c.title,
                                      courseSlug: c.slug,
                                      thumbnailUrl: c.thumbnailUrl,
                                      coachName: c.coachName,
                                      coachAvatarUrl: c.coachAvatarUrl,
                                      completedAt: c.completedAt || new Date().toISOString(),
                                      certificateCode: c.certificateCode!,
                                      pdfDownloadUrl: `/api/courses/${c.courseId}/certificate`,
                                    });
                                  }}
                                  className="py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                  title="Ver diploma oficial"
                                >
                                  <Award className="w-4 h-4 text-amber-600" />
                                  <span>Diploma</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-8 text-center space-y-3 bg-gray-50/50 dark:bg-slate-800/30">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
                        <GraduationCap className="w-7 h-7" />
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100">
                        No estás inscrito en ningún curso todavía
                      </h4>
                      <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                        Inscríbete en cursos prácticos diseñados por coaches profesionales y obtén certificados con valor curricular.
                      </p>
                      <div className="pt-2">
                        <Link
                          href="/courses"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm sm:text-base font-black bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-all"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>Explorar Catálogo de Cursos</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* TAB: CERTIFICADOS Y DIPLOMAS */
            <div className="space-y-8">
              {isCoach ? (
                /* MODO COACH: Únicamente Certificaciones y Títulos Profesionales del Coach */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green" />
                        <span>Certificaciones y Títulos Profesionales</span>
                        <span className="text-xs sm:text-sm font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {coachCertificates.length} {coachCertificates.length === 1 ? "título" : "títulos"}
                        </span>
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                        Credenciales, títulos universitarios y acreditaciones profesionales verificadas en tu perfil de coach.
                      </p>
                    </div>

                    <Link
                      href="/coach/onboarding?edit=true"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-black bg-white dark:bg-slate-800 text-cfh-dark-green dark:text-cfh-light-green border border-cfh-dark-green/30 dark:border-cfh-light-green/30 hover:bg-cfh-bg dark:hover:bg-slate-700 transition-all self-start sm:self-auto shadow-xs"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Gestionar Certificaciones</span>
                    </Link>
                  </div>

                  {coachCertificates.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {coachCertificates.map((cert) => {
                        const isPdf = cert.fileType === "pdf" || cert.fileName.toLowerCase().endsWith(".pdf");

                        return (
                          <div
                            key={cert.id}
                            className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200/80 dark:border-slate-700/80 p-4 flex flex-col justify-between hover:shadow-md transition-all group"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                                    isPdf
                                      ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                                  }`}
                                >
                                  {isPdf ? <FileText className="w-5 h-5" /> : <Award className="w-5 h-5" />}
                                </div>

                                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                                  {cert.fileType.toUpperCase()}
                                </span>
                              </div>

                              <div>
                                <h4 className="text-sm sm:text-base font-black text-gray-900 dark:text-slate-100 line-clamp-1 group-hover:text-cfh-dark-green dark:group-hover:text-cfh-light-green transition-colors">
                                  {cert.title}
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                  {cert.issuedBy || "Institución Acreditada"}
                                </p>
                              </div>
                            </div>

                            <div className="pt-4 flex items-center justify-between border-t border-gray-100 dark:border-slate-700/60 mt-3">
                              <span className="text-xs text-gray-400">
                                {cert.fileSize ? `${Math.round(cert.fileSize / 1024)} KB` : "Documento"}
                              </span>

                              <button
                                type="button"
                                onClick={() => setSelectedCoachDocPreview(cert)}
                                className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-cfh-dark-green dark:text-cfh-light-green hover:underline cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver Documento</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-8 text-center space-y-3 bg-gray-50/50 dark:bg-slate-800/30">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center mx-auto shadow-xs">
                        <ShieldCheck className="w-7 h-7" />
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100">
                        Aún no has registrado certificaciones o títulos
                      </h4>
                      <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                        Sube tus diplomas, cédulas profesionales y certificaciones avaladas para validar tu experiencia y aumentar la confianza de tus alumnos.
                      </p>
                      <div className="pt-2">
                        <Link
                          href="/coach/onboarding?edit=true"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm sm:text-base font-black bg-cfh-dark-green text-white hover:bg-[#061528] shadow-md transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Subir títulos o diplomas profesionales</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* MODO APRENDIZ: Diplomas Oficiales Obtenidos por Cursos Completados */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        <span>Diplomas de Finalización Obtenidos</span>
                        <span className="text-xs sm:text-sm font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {studentCertificates.length} {studentCertificates.length === 1 ? "diploma" : "diplomas"}
                        </span>
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                        Certificados de honor emitidos oficialmente por Coaching From Home tras completar el 100% del programa.
                      </p>
                    </div>
                  </div>

                  {studentCertificates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {studentCertificates.map((cert) => {
                        const formattedDate = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(cert.completedAt));

                        return (
                          <div
                            key={cert.enrollmentId}
                            className="relative bg-gradient-to-br from-amber-50/40 via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 rounded-3xl border-2 border-amber-300/60 dark:border-amber-500/30 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all group overflow-hidden"
                          >
                            {/* Marca de agua decorativa */}
                            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 bg-radial from-amber-400/20 via-transparent to-transparent rounded-full pointer-events-none blur-xl" />

                            <div className="space-y-4 relative z-10">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-sm">
                                    <Trophy className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 block">
                                      Certificado de Finalización
                                    </span>
                                    <span className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 font-semibold">
                                      Coaching From Home
                                    </span>
                                  </div>
                                </div>

                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <ShieldCheck className="w-3 h-3" /> Verificado
                                </span>
                              </div>

                              <div>
                                <h4 className="text-lg sm:text-xl font-black text-gray-900 dark:text-slate-100 line-clamp-2">
                                  {cert.courseTitle}
                                </h4>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mt-1">
                                  Impartido por: <strong className="text-gray-900 dark:text-slate-200">{cert.coachName}</strong>
                                </p>
                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                                  Emitido el: {formattedDate}
                                </p>
                              </div>

                              {/* Código de verificación */}
                              <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-gray-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">
                                    Código de Autenticidad
                                  </span>
                                  <span className="text-sm font-mono font-black text-gray-900 dark:text-slate-100 tracking-wider">
                                    {cert.certificateCode}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleCopyCertCode(cert.certificateCode)}
                                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-gray-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
                                  title="Copiar código de verificación"
                                >
                                  {copiedCertCode === cert.certificateCode ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Acciones del diploma */}
                            <div className="pt-5 flex items-center gap-2 relative z-10">
                              <a
                                href={cert.pdfDownloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black bg-cfh-dark-green text-white hover:bg-[#061528] transition-all flex items-center justify-center gap-2 shadow-xs"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Descargar PDF</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => setSelectedDiplomaPreview(cert)}
                                className="py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Previsualizar certificado en pantalla"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800 p-8 text-center space-y-3 bg-gray-50/50 dark:bg-slate-800/30">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
                        <Award className="w-7 h-7" />
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-gray-900 dark:text-slate-100">
                        Aún no tienes diplomas de finalización
                      </h4>
                      <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 max-w-md mx-auto">
                        Al completar el 100% de las lecciones de cualquiera de tus cursos, se emitirá automáticamente tu certificado oficial avalado por la plataforma con código de verificación único.
                      </p>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setProfileActiveTab("courses")}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm sm:text-base font-black bg-cfh-dark-green text-white hover:bg-[#061528] shadow-md transition-all cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>Ir a mis cursos</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Foto de Perfil Ampliada (Lightbox - Principios Gestalt & Usabilidad) */}
      <AnimatePresence>
        {showEnlargedAvatar && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md cursor-pointer overflow-y-auto overscroll-contain"
            onClick={() => setShowEnlargedAvatar(false)}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl border border-white/20 dark:border-slate-800 relative cursor-default overflow-hidden flex flex-col items-center text-center my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header con información y botón cerrar */}
              <div className="flex items-center justify-between w-full pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-left">
                  <span className="font-extrabold text-gray-900 dark:text-slate-100 text-base">{userName}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    isCoach ? "bg-cfh-dark-green text-white" : "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
                  }`}>
                    {isCoach ? "Coach" : "Aprendiz"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEnlargedAvatar(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-900 dark:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Cerrar vista previa"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Imagen Grande con Aspect Ratio Perfecto */}
              <div className="my-5 w-64 h-64 sm:w-80 sm:h-80 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border-4 border-white dark:border-slate-800 ring-2 ring-gray-100 dark:ring-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center relative">
                <img
                  src={displayAvatar}
                  alt={userName}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(userName)}`;
                  }}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Footer con Acciones */}
              <div className="flex items-center justify-between w-full pt-3 border-t border-gray-100 dark:border-slate-800 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEnlargedAvatar(false);
                    setShowPhotoModal(true);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-cfh-dark-green text-white hover:bg-[#061528] shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Cambiar foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnlargedAvatar(false)}
                  className="py-2.5 px-5 rounded-xl text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal para Subir/Cambiar Foto de Perfil */}
      <AnimatePresence>
        {showPhotoModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto overscroll-contain"
            onClick={() => setShowPhotoModal(false)}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 md:p-10 max-w-2xl sm:max-w-3xl lg:max-w-4xl w-full shadow-2xl border border-gray-100 dark:border-slate-800 space-y-6 relative my-auto cursor-default max-h-[92vh] overflow-y-auto overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cfh-light-green/20 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Actualizar Foto de Perfil</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-800 dark:text-slate-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <ImageUploader
                value={avatarUrl}
                onChange={(url, file) => handleSavePhoto(url, file)}
                label="Selecciona o sube tu nueva foto"
                description="Formatos admitidos: JPG, PNG, WebP (máx 5MB). Al seleccionar una foto o avatar se guardará automáticamente."
              />

              {savingPhoto && (
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-cfh-dark-green dark:text-cfh-light-green py-2">
                  <div className="w-4 h-4 border-2 border-cfh-dark-green dark:border-cfh-light-green border-t-transparent rounded-full animate-spin" />
                  <span>Guardando tu foto...</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  disabled={savingPhoto}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Previsualización Digital del Diploma de Alumno */}
      <AnimatePresence>
        {selectedDiplomaPreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md cursor-pointer overflow-y-auto overscroll-contain"
            onClick={() => setSelectedDiplomaPreview(null)}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#FCFAF5] dark:bg-slate-900 rounded-3xl p-6 sm:p-10 max-w-2xl w-full shadow-2xl border-4 border-double border-amber-500/40 dark:border-amber-500/30 relative cursor-default overflow-hidden flex flex-col text-center my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Botón cerrar */}
              <button
                type="button"
                onClick={() => setSelectedDiplomaPreview(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-amber-100/60 dark:bg-slate-800 hover:bg-amber-200/80 dark:hover:bg-slate-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Cerrar vista previa"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Marca de agua decorativa / Escudo */}
              <div className="flex flex-col items-center justify-center space-y-2 pt-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-white flex items-center justify-center shadow-lg ring-4 ring-amber-200 dark:ring-amber-900/50">
                  <Trophy className="w-8 h-8" />
                </div>
                <span className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-amber-800 dark:text-amber-400">
                  Coaching From Home
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight font-serif">
                  Certificado de Finalización
                </h3>
              </div>

              <div className="my-6 space-y-4 text-gray-700 dark:text-slate-300">
                <p className="text-xs sm:text-sm uppercase tracking-widest text-gray-500 dark:text-slate-400 font-bold">
                  Se certifica que
                </p>

                <p className="text-2xl sm:text-3xl font-black text-cfh-dark-green dark:text-cfh-light-green tracking-tight font-serif border-b border-amber-300/60 dark:border-amber-700/60 pb-2 inline-block max-w-md mx-auto">
                  {userName}
                </p>

                <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                  ha completado satisfactoriamente y con mérito el programa de capacitación práctica en el curso:
                </p>

                <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-slate-100">
                  “{selectedDiplomaPreview.courseTitle}”
                </p>

                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                  Impartido y avalado por el mentor: <strong className="text-gray-900 dark:text-slate-200">{selectedDiplomaPreview.coachName}</strong>
                </p>
              </div>

              {/* Sello de autenticidad & Código de validación */}
              <div className="p-4 rounded-2xl bg-amber-100/50 dark:bg-slate-800/80 border border-amber-300/60 dark:border-amber-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                <div>
                  <span className="text-xs uppercase font-black text-amber-800 dark:text-amber-400 tracking-wider block">
                    Código Oficial de Verificación
                  </span>
                  <span className="text-sm sm:text-base font-mono font-black text-gray-900 dark:text-slate-100">
                    {selectedDiplomaPreview.certificateCode}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 block mt-0.5">
                    Fecha de emisión: {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(selectedDiplomaPreview.completedAt))}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyCertCode(selectedDiplomaPreview.certificateCode)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs font-bold text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  {copiedCertCode === selectedDiplomaPreview.certificateCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar código</span>
                    </>
                  )}
                </button>
              </div>

              {/* Botones de acción del modal */}
              <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                <a
                  href={selectedDiplomaPreview.pdfDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto flex-1 py-3 px-6 rounded-2xl text-xs sm:text-sm font-black bg-cfh-dark-green text-white hover:bg-[#061528] shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Diploma Oficial (PDF)</span>
                </a>

                <button
                  type="button"
                  onClick={() => setSelectedDiplomaPreview(null)}
                  className="w-full sm:w-auto py-3 px-6 rounded-2xl text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Visor de Documento de Coach */}
      <AnimatePresence>
        {selectedCoachDocPreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md cursor-pointer overflow-y-auto overscroll-contain"
            onClick={() => setSelectedCoachDocPreview(null)}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-3xl w-full shadow-2xl border border-gray-100 dark:border-slate-800 relative cursor-default flex flex-col max-h-[90vh] my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-cfh-light-green/20 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-gray-900 dark:text-slate-100 truncate">
                      {selectedCoachDocPreview.title}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                      {selectedCoachDocPreview.issuedBy || "Acreditación profesional"} • {selectedCoachDocPreview.fileType.toUpperCase()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCoachDocPreview(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-500 dark:text-slate-400 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Visor de contenido */}
              <div className="my-4 flex-1 overflow-auto rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 flex items-center justify-center min-h-[300px]">
                {selectedCoachDocPreview.fileType === "pdf" || selectedCoachDocPreview.fileName.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={selectedCoachDocPreview.fileUrl}
                    title={selectedCoachDocPreview.title}
                    className="w-full h-[60vh] rounded-2xl border-0"
                  />
                ) : (
                  <img
                    src={selectedCoachDocPreview.fileUrl}
                    alt={selectedCoachDocPreview.title}
                    className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-xs"
                  />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800 gap-3">
                <a
                  href={selectedCoachDocPreview.fileUrl}
                  download={selectedCoachDocPreview.fileName || "certificado"}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-5 rounded-xl text-xs sm:text-sm font-black bg-cfh-dark-green text-white hover:bg-[#061528] transition-all flex items-center gap-2 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo</span>
                </a>

                <button
                  type="button"
                  onClick={() => setSelectedCoachDocPreview(null)}
                  className="py-2.5 px-5 rounded-xl text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-all cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Editar Perfil                                               */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showEditProfileModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm cursor-pointer overflow-y-auto overscroll-contain"
            onClick={() => setShowEditProfileModal(false)}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white dark:bg-[#10192D] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-slate-700/80 cursor-default my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Editar Perfil</h3>
                </div>
                <button onClick={() => setShowEditProfileModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Nombre completo</label>
                  <input
                    type="text"
                    value={editProfileName}
                    onChange={(e) => setEditProfileName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#162038] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Tu nombre..."
                  />
                </div>
                {isCoach && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Titular / Headline</label>
                    <input
                      type="text"
                      value={editProfileHeadline}
                      onChange={(e) => setEditProfileHeadline(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#162038] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Coach Profesional..."
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Sobre mí / Biografía</label>
                  <textarea
                    rows={4}
                    value={editProfileBio}
                    onChange={(e) => setEditProfileBio(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#162038] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    placeholder="Cuéntanos sobre ti..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 bg-slate-100 dark:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {savingProfile ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Cambiar Contraseña                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm cursor-pointer overflow-y-auto overscroll-contain"
            onClick={() => setShowChangePasswordModal(false)}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white dark:bg-[#10192D] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-slate-700/80 cursor-default my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Cambiar contraseña</h3>
                </div>
                <button onClick={() => setShowChangePasswordModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Contraseña actual */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Contraseña actual</label>
                  <div className="relative">
                    <input
                      type={showPwdCurrent ? "text" : "password"}
                      value={pwdCurrent}
                      onChange={(e) => setPwdCurrent(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#162038] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdCurrent((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                    >
                      {showPwdCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Nueva contraseña */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Nueva contraseña</label>
                  <div className="relative">
                    <input
                      type={showPwdNew ? "text" : "password"}
                      value={pwdNew}
                      onChange={(e) => setPwdNew(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#162038] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                    >
                      {showPwdNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Confirmar nueva contraseña</label>
                  <div className="relative">
                    <input
                      type={showPwdConfirm ? "text" : "password"}
                      value={pwdConfirm}
                      onChange={(e) => setPwdConfirm(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }}
                      className="w-full bg-slate-50 dark:bg-[#162038] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Repite la nueva contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwdConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                    >
                      {showPwdConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="flex items-center gap-2 text-rose-500 text-xs font-semibold bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 bg-slate-100 dark:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={savingPassword}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {savingPassword ? "Guardando..." : "Actualizar contraseña"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Notificaciones                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showNotificationsModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm cursor-pointer overflow-y-auto overscroll-contain"
            onClick={() => setShowNotificationsModal(false)}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white dark:bg-[#10192D] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-slate-700/80 cursor-default max-h-[85vh] flex flex-col my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] sm:text-xs font-black flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">Notificaciones</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      disabled={markingRead}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {markingRead ? "Marcando..." : "Marcar todas como leídas"}
                    </button>
                  )}
                  <button onClick={() => setShowNotificationsModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lista */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
                {loadingNotifications ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
                      <Bell className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Sin notificaciones</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Cuando tengas novedades, aparecerán aquí.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                        n.readAt
                          ? "opacity-60 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40"
                          : "bg-slate-50 hover:bg-slate-100/80 dark:bg-[#162038] border border-slate-200/80 dark:border-slate-700/80"
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.readAt ? "bg-slate-400 dark:bg-slate-600" : "bg-blue-600 dark:bg-blue-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{n.title}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {new Date(n.createdAt).toLocaleDateString("es-MX", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                          })}
                        </p>
                      </div>
                      {n.link && (
                        <a
                          href={n.link}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                          onClick={() => setShowNotificationsModal(false)}
                        >
                          Ver
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Privacidad y Presencia                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm cursor-pointer overflow-y-auto overscroll-contain"
            onClick={() => setShowPrivacyModal(false)}
            onWheel={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white dark:bg-[#10192D] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-slate-700/80 cursor-default my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Privacidad</h3>
                </div>
                <button onClick={() => setShowPrivacyModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Vista previa del estado */}
              <div className="bg-slate-50 dark:bg-[#162038] rounded-xl p-4 mb-5 flex items-center gap-3 border border-slate-200/80 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 shrink-0">
                  <img src={displayAvatar} alt={userName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{userName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {showOnline ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Activo en la comunidad
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                        Ausente / No visible
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Toggle de presencia */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#162038] rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-200">Aparecer como activo</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Visible en la comunidad y en tu perfil</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSavePrivacy(!showOnline)}
                  disabled={savingPrivacy}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer disabled:opacity-50 shrink-0 ${
                    showOnline ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                      showOnline ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
                Esta configuración afecta tu visibilidad en la comunidad y en la barra lateral.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}



