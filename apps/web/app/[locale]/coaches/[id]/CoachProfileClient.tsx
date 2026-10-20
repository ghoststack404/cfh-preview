"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CreditCard, ShieldCheck, ArrowLeft, Lock, Calendar, Bot, Pencil, UserCheck, LayoutDashboard, X, Award, Camera, Image as ImageIcon, Upload, Check, Loader2, Eye } from "lucide-react";
import BookingCalendar from "@/components/BookingCalendar";
import { getAvailableSlots, createBooking, checkFreeIntroEligibility, checkCoachDirectMessagingEligibility } from "@/app/actions/bookings";
import { updateCoachBanner } from "@/app/actions/onboarding";
import { useAuthModal } from "@/context/AuthModalContext";
import { useScrollLock } from "@/lib/scroll-lock";
import { findContactData, contactMessage } from "@/lib/chat";

import { CoachCertificatesGallery, CoachCertificate } from "@/features/coach-certifications";
import { getPusherClient } from "@/lib/pusher-client";

import { useTranslation } from "@/components/TranslationProvider";
import { translateCategory, translateReviewDate, translateCoachName, translateCoachHeadline } from "@/lib/i18n-helpers";
import CategoryBadge from "@/components/CategoryBadge";

export interface CoachProfileData {
  id: string;
  userId?: string;
  slug?: string;
  name: string;
  email?: string;
  avatarUrl: string;
  headline: string;
  biography: string;
  introVideoUrl: string;
  bannerUrl?: string | null;

  yearsExperience: number;
  hourlyRate: number;
  currency: string;
  level: string;
  tier?: string;
  createdAt?: string;
  averageRating: number;
  reviewCount: number;
  completedSessionCount: number;
  timezone: string;
  language: string;
  freeIntroEnabled: boolean;
  freeIntroMinutes: number;
  freeIntroWeekdays?: number[];
  regularWeekdays?: number[];
  showCertificates?: boolean;
  certificates?: CoachCertificate[];
  categories: string[];
  reviews: Array<{
    id: string;
    authorName: string;
    authorAvatar: string;
    rating: number;
    comment: string;
    date: string;
  }>;
  courses?: Array<{
    id: string;
    title: string;
    slug: string;
    thumbnailUrl?: string | null;
    price: number;
    currency: string;
  }>;
}

interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
}

const BANNER_PRESETS = [
  {
    id: "tech",
    name: "Tecnología & Código",
    url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "business",
    name: "Negocios & Liderazgo",
    url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "creative",
    name: "Diseño & Creatividad",
    url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "wellness",
    name: "Bienestar & Desarrollo Personal",
    url: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "education",
    name: "Educación & Mentoría",
    url: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "minimal",
    name: "Minimalista Dark Studio",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80",
  },
];

function formatTenure(dateString?: string, fallbackYears: number = 0): string {
  if (!dateString) {
    if (fallbackYears > 0) return `${fallbackYears} ${fallbackYears === 1 ? "año" : "años"}`;
    return "1 semana";
  }
  const start = new Date(dateString);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - start.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30.4375);
  const diffYears = Math.floor(diffDays / 365.25);

  if (diffYears >= 1) {
    return `${diffYears} ${diffYears === 1 ? "año" : "años"}`;
  }
  if (diffMonths >= 1) {
    return `${diffMonths} ${diffMonths === 1 ? "mes" : "meses"}`;
  }
  if (diffWeeks >= 1) {
    return `${diffWeeks} ${diffWeeks === 1 ? "semana" : "semanas"}`;
  }
  return "1 semana";
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return null;
}

export default function CoachProfileClient({
  coach,
  initialEligibleForFreeIntro = true,
  initialFreeIntroReason = null,
  initialIsSecondChance = false,
  initialCurrentUser = null,
  initialActiveRole = null,
}: {
  coach: CoachProfileData;
  initialEligibleForFreeIntro?: boolean;
  initialFreeIntroReason?: string | null;
  initialIsSecondChance?: boolean;
  initialCurrentUser?: any;
  initialActiveRole?: string | null;
}) {
  const searchParams = useSearchParams();
  const { openRegisterWithRole, openLogin } = useAuthModal();
  const { t, locale } = useTranslation();
  const profile = coach;
  const certifiedLabel = profile.categories && profile.categories.length === 1 && profile.categories[0]
    ? `Coach certificado en ${translateCategory(profile.categories[0], t) || profile.categories[0]}`
    : "Coach certificado";
  const [currentUser, setCurrentUser] = useState<any>(initialCurrentUser || null);
  const [activeRole, setActiveRole] = useState<string | null>(initialActiveRole || null);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  // Banner state
  const [bannerUrl, setBannerUrl] = useState<string | null>(coach.bannerUrl || null);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectBanner = async (newUrl: string) => {
    setIsSavingBanner(true);
    setBannerUploadError(null);
    try {
      const res = await updateCoachBanner(newUrl);
      if (res.success) {
        setBannerUrl(newUrl);
        setIsBannerModalOpen(false);
      } else {
        setBannerUploadError(res.error || "No se pudo actualizar la foto de portada");
      }
    } catch (err: any) {
      setBannerUploadError(err?.message || "Error al actualizar la foto de portada");
    } finally {
      setIsSavingBanner(false);
    }
  };

  const handleUploadBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setBannerUploadError("Solo se permiten imágenes (JPG, PNG o WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBannerUploadError("El tamaño máximo permitido para la imagen es 5 MB.");
      return;
    }

    setIsSavingBanner(true);
    setBannerUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Error al subir la imagen");
      }

      await handleSelectBanner(data.url);
    } catch (err: any) {
      setBannerUploadError(err?.message || "Error al procesar la imagen de portada");
      setIsSavingBanner(false);
    }
  };

  const handleRemoveBanner = async () => {
    setIsSavingBanner(true);
    setBannerUploadError(null);
    try {
      const res = await updateCoachBanner("");
      if (res.success) {
        setBannerUrl(null);
        setIsBannerModalOpen(false);
      } else {
        setBannerUploadError(res.error || "No se pudo remover la portada");
      }
    } catch (err: any) {
      setBannerUploadError(err?.message || "Error al remover la portada");
    } finally {
      setIsSavingBanner(false);
    }
  };

  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [requirePaymentModalOpen, setRequirePaymentModalOpen] = useState(false);
  
  // Chat state
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatPolicyWarning, setChatPolicyWarning] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Booking state
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isEligibleForFreeIntro, setIsEligibleForFreeIntro] = useState(initialEligibleForFreeIntro);
  const [freeIntroReason, setFreeIntroReason] = useState<string | null>(initialFreeIntroReason);
  const [isSecondChance, setIsSecondChance] = useState(initialIsSecondChance);
  const typeParam = searchParams?.get("type");
  const [bookingType, setBookingType] = useState<"free_intro" | "regular">(
    typeParam === "regular"
      ? "regular"
      : typeParam === "free" && coach.freeIntroEnabled
      ? "free_intro"
      : coach.freeIntroEnabled
      ? "free_intro"
      : "regular"
  );
  const [bookingStep, setBookingStep] = useState<"details" | "payment">("details");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("888");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [bookingNotes, setBookingNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

  const fetchWalletCards = () => {
    setIsLoadingCards(true);
    fetch("/api/wallet/payment-methods")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const cards = data?.paymentMethods || data?.cards || [];
        if (Array.isArray(cards) && cards.length > 0) {
          setSavedCards(cards);
          const defaultCard = cards.find((c: any) => c.isDefault) || cards[0];
          setSelectedCardId(defaultCard.id);
        }
      })
      .catch((err) => console.error("Error loading wallet cards:", err))
      .finally(() => setIsLoadingCards(false));
  };

  useEffect(() => {
    if (isBookingOpen || bookingStep === "payment") {
      fetchWalletCards();
    }
  }, [isBookingOpen, bookingStep, currentUser]);

  const handleCloseBooking = () => {
    setIsBookingOpen(false);
    setBookingSuccess(false);
    setBookingStep("details");
    setBookingError("");
  };

  const isAnyModalOpen = isBookingOpen || isMessageOpen || requirePaymentModalOpen || authPromptOpen || isPlayingVideo;
  useScrollLock(isAnyModalOpen);

  // Keyboard shortcut (Escape)
  useEffect(() => {
    if (!isAnyModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isBookingOpen) handleCloseBooking();
        if (isMessageOpen) setIsMessageOpen(false);
        if (requirePaymentModalOpen) setRequirePaymentModalOpen(false);
        if (authPromptOpen) setAuthPromptOpen(false);
        if (isPlayingVideo) setIsPlayingVideo(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAnyModalOpen, isBookingOpen, isMessageOpen, requirePaymentModalOpen, authPromptOpen, isPlayingVideo]);

  // Check auth
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const user = data?.user || (data?.authenticated ? data?.user : null);
        if (user) {
          setCurrentUser(user);
          setCardHolder(user.name || "");
        }
      })
      .catch(() => {});
  }, []);

  const isOwnerCoach = Boolean(
    currentUser && (
      (coach.userId && currentUser.id === coach.userId) ||
      (coach.email && currentUser.email === coach.email) ||
      (currentUser.coachProfile?.id && currentUser.coachProfile.id === coach.id) ||
      (currentUser.coachProfile?.slug && coach.slug && currentUser.coachProfile.slug === coach.slug)
    )
  );

  useEffect(() => {
    const cookieRole = typeof document !== "undefined"
      ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
      : null;
    if (cookieRole) {
      setActiveRole(cookieRole);
    } else if (currentUser?.activeRole || currentUser?.role) {
      setActiveRole(currentUser.activeRole || currentUser.role);
    }
  }, [currentUser]);

  const isCoachMode = activeRole === "COACH";

  // Messaging permission state
  const [canMessageCoach, setCanMessageCoach] = useState<boolean | null>(null);

  // Verificar si el alumno tiene derecho a enviar mensaje (ha pagado sesión o curso)
  useEffect(() => {
    async function checkMessaging() {
      if (coach?.id && currentUser) {
        const res = await checkCoachDirectMessagingEligibility(coach.id);
        setCanMessageCoach(res.canMessage);
      } else {
        setCanMessageCoach(null);
      }
    }
    checkMessaging();
  }, [coach.id, currentUser]);

  // Verificar elegibilidad de prueba gratuita para este coach
  useEffect(() => {
    async function checkEligibility() {
      if (coach?.id) {
        const res = await checkFreeIntroEligibility(coach.id);
        setIsEligibleForFreeIntro(res.eligible);
        if ((res as any).isSecondChance) {
          setIsSecondChance(true);
        }
        if (!res.eligible) {
          if (res.reason) setFreeIntroReason(res.reason);
          setBookingType("regular");
        }
      }
    }
    checkEligibility();
  }, [coach.id, currentUser]);

  // Auto-open booking modal if navigated with ?book=1 or ?book=true
  useEffect(() => {
    const bookParam = searchParams?.get("book");
    const typeQuery = searchParams?.get("type");
    if (bookParam === "1" || bookParam === "true") {
      if (currentUser) {
        if (typeQuery === "regular") {
          setBookingType("regular");
        } else if (typeQuery === "free" || (coach.freeIntroEnabled && isEligibleForFreeIntro)) {
          setBookingType("free_intro");
        }
        setIsBookingOpen(true);
      }
    }
  }, [searchParams, currentUser, coach.freeIntroEnabled, isEligibleForFreeIntro]);

  useEffect(() => {
    async function fetchTimes() {
      if (!selectedDate) return;
      setIsLoadingTimes(true);
      setSelectedTime(null);
      const isFree = bookingType === "free_intro";
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      const res = await getAvailableSlots(coach.id, dateStr, isFree);
      if (res.success && res.slots) {
        setAvailableTimes(res.slots);
      } else {
        setAvailableTimes([]);
      }
      setIsLoadingTimes(false);
    }
    fetchTimes();
  }, [selectedDate, coach.id, bookingType]);

  const handleOpenBooking = (type: "free_intro" | "regular" = "regular") => {
    if (isCoachMode && !isOwnerCoach) {
      alert("Estás navegando en Modo Coach. Para reservar mentorías como alumno, cambia a Modo Aprendiz.");
      return;
    }
    if (!currentUser) {
      setAuthPromptOpen(true);
      return;
    }
    if (type === "free_intro" && !isEligibleForFreeIntro) {
      setBookingType("regular");
    } else {
      setBookingType(type);
    }
    setBookingStep("details");
    setSelectedTime(null);
    setIsBookingOpen(true);
  };

  const handleOpenMessage = async () => {
    if (isCoachMode && !isOwnerCoach) {
      alert("Estás navegando en Modo Coach. Para enviar mensajes como alumno, cambia a Modo Aprendiz.");
      return;
    }
    if (!currentUser) {
      setAuthPromptOpen(true);
      return;
    }

    // Verificar si el usuario ha pagado
    if (canMessageCoach === false) {
      setRequirePaymentModalOpen(true);
      return;
    }

    // Si aún está en null (cargando), verificar de inmediato
    if (canMessageCoach === null) {
      const check = await checkCoachDirectMessagingEligibility(coach.id);
      setCanMessageCoach(check.canMessage);
      if (!check.canMessage) {
        setRequirePaymentModalOpen(true);
        return;
      }
    }

    setIsMessageOpen(true);
    setLoadingChat(true);
    setChatPolicyWarning(null);

    try {
      // Find or create conversation
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachId: coach.id }),
      });

      if (res.ok) {
        const data = await res.json();
        const conv = data.conversation;
        if (conv?.id) {
          setConversationId(conv.id);
          // Fetch existing messages
          const msgRes = await fetch(`/api/conversations/${conv.id}/messages`);
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            setChatMessages(msgData.messages || []);
            setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setIsMessageOpen(false);
          setCanMessageCoach(false);
          setRequirePaymentModalOpen(true);
        }
      }
    } catch (err) {
      console.error("Error iniciando chat con coach:", err);
    } finally {
      setLoadingChat(false);
    }
  };

  // Real-time listener for incoming messages via Pusher WebSockets
  useEffect(() => {
    if (!isMessageOpen || !conversationId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `conversation-${conversationId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("new-message", (incoming: ChatMessage) => {
      setChatMessages((prev) => {
        // Deduplicate
        if (prev.some((m) => m.id === incoming.id)) return prev;

        // Reconcile optimistic message sent by current user
        if (incoming.senderId === currentUser?.id) {
          const tempIdx = prev.findIndex(
            (m) => m.id.startsWith("temp-") && m.content === incoming.content
          );
          if (tempIdx !== -1) {
            const copy = [...prev];
            copy[tempIdx] = incoming;
            return copy;
          }
        }

        return [...prev, incoming];
      });

      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [isMessageOpen, conversationId, currentUser?.id]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !conversationId || isSendingMessage) return;

    const textToSend = messageText.trim();
    setChatPolicyWarning(null);

    const findings = findContactData(textToSend);
    if (findings.length > 0) {
      setChatPolicyWarning(contactMessage(findings));
      return;
    }

    setIsSendingMessage(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      content: textToSend,
      createdAt: new Date().toISOString(),
      senderId: currentUser.id,
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);
    setMessageText("");
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textToSend }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) {
          setChatPolicyWarning(errData.error);
        }
        setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else {
        const data = await res.json();
        if (data.message) {
          setChatMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
        }
      }
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSendingMessage(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const handleBook = async (useSavedCard: boolean = false) => {
    if (!selectedDate || !selectedTime) return;
    setIsBooking(true);
    setBookingError("");
    const isFree = bookingType === "free_intro";
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    try {
      const res = await createBooking(coach.id, dateStr, selectedTime, bookingNotes, isFree);
      if (!res.success) {
        setBookingError(res.error || "Ocurrió un error al agendar.");
        setIsBooking(false);
        return;
      }

      if (isFree) {
        setBookingSuccess(true);
        setIsEligibleForFreeIntro(false);
        setFreeIntroReason("Ya has utilizado tu sesión de prueba gratuita de 15 minutos con este coach.");
        setBookingType("regular");
        setIsBooking(false);
        return;
      }

      const bookingId = res.bookingId;
      if (!bookingId) {
        setBookingSuccess(true);
        setIsBooking(false);
        return;
      }

      const bodyData: any = {};
      if (useSavedCard && selectedCardId) {
        bodyData.paymentMethodId = selectedCardId;
      }

      const stripeRes = await fetch(`/api/bookings/${bookingId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) {
        setBookingError(stripeData.error || "Error al conectar con la pasarela de pagos.");
        setIsBooking(false);
        return;
      }

      if (stripeData.url) {
        window.location.href = stripeData.url;
      } else {
        setBookingSuccess(true);
        setIsBooking(false);
      }
    } catch (err: any) {
      console.error("Error al procesar reserva:", err);
      setBookingError("Error de red al procesar el pago.");
      setIsBooking(false);
    }
  };

  const renderCoachPlanBadge = (tier?: string) => {
    const normalized = (tier || "BASIC").toUpperCase();
    switch (normalized) {
      case "PLATINUM":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-purple-500/20 via-fuchsia-500/20 to-indigo-500/20 text-purple-700 dark:text-purple-300 border border-purple-400/50 shadow-xs">
            <span className="text-sm">💎</span>
            <span>Plan Platinum VIP</span>
          </span>
        );
      case "GOLD":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/50 shadow-xs">
            <span className="text-sm">👑</span>
            <span>Plan Gold</span>
          </span>
        );
      case "ELITE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-sky-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/50 shadow-xs">
            <span className="text-sm">🏆</span>
            <span>Plan Élite</span>
          </span>
        );
      case "CURSOS_ONLY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r from-teal-500/20 via-cyan-500/20 to-emerald-500/20 text-teal-700 dark:text-teal-300 border border-teal-400/50 shadow-xs">
            <span className="text-sm">🎓</span>
            <span>Solo Cursos</span>
          </span>
        );
      case "BASIC":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
            <span className="text-sm">🌱</span>
            <span>Plan Básico</span>
          </span>
        );
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier?.toUpperCase()) {
      case "ELITE":
        return "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60";
      case "EXPERT":
        return "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60";
      case "FEATURED":
        return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60";
      case "NEW":
        return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60";
      default:
        return "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-700";
    }
  };

  const ratingBreakdown = [
    { stars: 5, percentage: 88 },
    { stars: 4, percentage: 9 },
    { stars: 3, percentage: 2 },
    { stars: 2, percentage: 1 },
    { stars: 1, percentage: 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20 text-gray-900 dark:text-slate-100 transition-colors">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Banner de Modo Coach / Vista Previa de Perfil */}
        {isOwnerCoach && (
          <div className="bg-cfh-dark-green text-white px-6 py-4 rounded-3xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg border border-emerald-900/40">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm sm:text-base">Vista Previa de Aprendiz</span>
                  <span className="text-xs uppercase tracking-wider font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Así te ven los alumnos
                  </span>
                </div>
                <p className="text-xs text-emerald-100/80">
                  Esta es la vista pública que tienen los alumnos cuando exploran tu perfil para agendar clases o comprar cursos.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(true)}
                className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-300" />
                <span>Cambiar Portada</span>
              </button>
              <Link
                href="/coach/onboarding?edit=true"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all border border-white/20 flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar Perfil
              </Link>
              <Link
                href="/coach/availability"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all border border-white/20 flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                Gestionar Horarios
              </Link>
              <Link
                href="/coach/dashboard"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Volver al Panel
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header Hero Card — Rediseño Profesional */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              {/* Banner de portada profesional */}
              <div className="relative h-44 sm:h-56 md:h-64 overflow-hidden bg-slate-900 group">
                {bannerUrl ? (
                  <>
                    <img
                      src={bannerUrl}
                      alt={`Portada de ${coach.name}`}
                      className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
                  </>
                ) : (
                  <div className="w-full h-full relative bg-gradient-to-br from-slate-950 via-[#062420] to-slate-900">
                    <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px]" />
                    <div className="absolute -top-12 -left-12 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-8 -right-8 w-72 h-72 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  </div>
                )}

                {/* Botón flotante para cambiar foto de portada (solo visible para el Coach dueño) */}
                {isOwnerCoach && (
                  <button
                    type="button"
                    onClick={() => setIsBannerModalOpen(true)}
                    className="absolute top-3.5 right-3.5 z-10 px-3.5 py-2 rounded-xl bg-black/65 hover:bg-black/85 backdrop-blur-md text-white text-xs font-bold border border-white/20 shadow-lg flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cambiar foto de portada</span>
                  </button>
                )}
              </div>

              <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                {/* Avatar superpuesto sobre el banner */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-5">
                  <div className="relative shrink-0">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-4 border-white dark:border-slate-900 shadow-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                      <img
                        src={coach.avatarUrl}
                        alt={coach.name}
                        className="w-full h-full object-cover max-w-full max-h-full"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(coach.name)}&background=081B33&color=A7D4B6&bold=true`;
                        }}
                      />
                    </div>
                    <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow border-2 border-white dark:border-slate-900 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {t("CoachProfile.active_status", "Activo")}
                    </span>
                  </div>
                  {/* Tarifa + Plan activo (solo se muestra el plan activo real) */}
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span className="font-black text-lg sm:text-2xl text-gray-900 dark:text-white">
                      ${coach.hourlyRate} <span className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-slate-400">{coach.currency}/hr</span>
                    </span>
                    {renderCoachPlanBadge(coach.tier)}
                  </div>
                </div>

                {/* Info principal */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                      {translateCoachName(coach.name, t)}
                      <svg className="w-6 h-6 text-cfh-light-green shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </h1>
                    {profile.showCertificates && profile.certificates && profile.certificates.length > 0 && (
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm font-extrabold shadow-xs">
                        <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{certifiedLabel}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <p className="text-base font-bold text-cfh-dark-green dark:text-cfh-light-green break-words [overflow-wrap:anywhere] min-w-0">{translateCoachHeadline(coach.headline, t)}</p>
                    {isOwnerCoach && (
                      <Link
                        href="/coach/onboarding?edit=true"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Editar información</span>
                      </Link>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-3 pt-1">
                    <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-xl font-bold text-base border border-amber-200 dark:border-amber-800/60">
                      <svg className="w-4 h-4 text-amber-500 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>{coach.averageRating.toFixed(1)}</span>
                      <span className="text-gray-500 dark:text-slate-400 font-normal text-xs">({t("CoachProfile.reviews_count", { count: coach.reviewCount })})</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-xl font-bold text-base border border-blue-200 dark:border-blue-800/60">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      <span>{t("CoachProfile.students_count", { count: coach.completedSessionCount })}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 px-3 py-1.5 rounded-xl font-bold text-base border border-violet-200 dark:border-violet-800/60">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span>{formatTenure(coach.createdAt, coach.yearsExperience)} como coach</span>
                    </div>
                  </div>

                  {/* Categorías con distintivo visual temático */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {coach.categories.map((cat, idx) => (
                      <CategoryBadge key={idx} category={translateCategory(cat, t)} size="md" />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>


            {/* Video de Introducción */}
            {(coach.introVideoUrl || isOwnerCoach) && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-slate-800 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                    {t("CoachProfile.intro_video_title", "Video de Presentación")}
                  </h2>
                  {isOwnerCoach && coach.introVideoUrl && (
                    <Link
                      href="/coach/onboarding?edit=true"
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Cambiar video</span>
                    </Link>
                  )}
                </div>

                {coach.introVideoUrl ? (
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-inner">
                    {getEmbedUrl(coach.introVideoUrl) ? (
                      <iframe
                        src={getEmbedUrl(coach.introVideoUrl)!}
                        title="Video de presentación"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={coach.introVideoUrl}
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full h-full object-contain bg-black"
                      />
                    )}
                  </div>
                ) : isOwnerCoach ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-sm font-bold text-gray-700 dark:text-slate-300">Aún no has agregado un video de presentación</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 mb-4">Un video corto aumenta la confianza de tus futuros alumnos.</p>
                    <Link href="/coach/onboarding?edit=true" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">
                      Subir video de presentación
                    </Link>
                  </div>
                ) : null}
              </motion.div>
            )}

            {/* Acerca de mí */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-4 break-words">{t("CoachProfile.about_title", `Acerca de ${coach.name}`, { name: coach.name })}</h2>
              <div
                className={`text-gray-700 dark:text-slate-300 leading-relaxed text-base sm:text-lg break-words [overflow-wrap:anywhere] ${
                  isBioExpanded
                    ? "max-h-72 overflow-y-auto pr-2 custom-scrollbar"
                    : "line-clamp-5 overflow-hidden"
                }`}
              >
                <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{coach.biography}</p>
              </div>
              {coach.biography && (coach.biography.length > 260 || coach.biography.split("\n").length > 4) && (
                <button
                  type="button"
                  onClick={() => setIsBioExpanded((prev) => !prev)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <span>{isBioExpanded ? "Ver menos" : "Ver más"}</span>
                </button>
              )}
            </div>

            {/* Certificaciones y Títulos Profesionales */}
            {coach.showCertificates && coach.certificates && coach.certificates.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <CoachCertificatesGallery
                  certificates={coach.certificates}
                  showCertificates={coach.showCertificates}
                />
              </div>
            )}

            {/* Reseñas */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-6">{t("CoachProfile.student_reviews_title", "Reseñas de Aprendices")}</h2>
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {coach.reviews.map((rev) => (
                  <div key={rev.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={rev.authorAvatar} alt={rev.authorName} className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-200 dark:ring-slate-700 shrink-0" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 dark:text-white text-base truncate">{rev.authorName}</h4>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{translateReviewDate(rev.date, locale, t)}</p>
                        </div>
                      </div>
                      <div className="text-amber-400 text-sm shrink-0">{"★".repeat(rev.rating)}</div>
                    </div>
                    <p className="text-base text-gray-700 dark:text-slate-300 mt-2 break-words [overflow-wrap:anywhere]">{rev.comment}</p>

                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column / Sticky Booking & Messaging Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-200 dark:border-slate-800 shadow-xl relative">
                {coach.freeIntroEnabled && (
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold px-4 py-1.5 rounded-full mb-4 inline-flex items-center gap-1.5 shadow-sm">
                    <span>✨</span>
                    <span>{t("CoachProfile.free_intro_badge", `1ra Sesión Gratis (${coach.freeIntroMinutes || 15} min)`, { min: coach.freeIntroMinutes || 15 })}</span>
                  </div>
                )}

                <div className="flex items-baseline justify-between mb-6">
                  <div>
                    <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">${coach.hourlyRate}</span>
                    <span className="text-sm text-gray-500 dark:text-slate-400 font-medium ml-1">{t("CoachProfile.per_hour", `${coach.currency} / hora`, { currency: coach.currency })}</span>
                  </div>
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 font-bold px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                    {t("CoachProfile.guarantee_100", "Garantía 100%")}
                  </span>
                </div>


                {isOwnerCoach ? (
                  <div className="space-y-4 mb-6">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                        <UserCheck className="w-4 h-4" />
                        <span>Este es tu Perfil Público</span>
                      </div>
                      <p className="text-emerald-700 dark:text-emerald-400/90 leading-relaxed">
                        Los alumnos consultan tus datos, horarios y reservan sesiones desde esta página. Los ingresos van directo a tu cuenta.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <Link
                        href="/coach/availability"
                        className="w-full py-3.5 bg-cfh-dark-green hover:bg-[#061528] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Calendar className="w-4 h-4" />
                        Gestionar mis Horarios
                      </Link>

                      <Link
                        href="/coach/onboarding?edit=true"
                        className="w-full py-2.5 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar Biografía y Tarifas
                      </Link>
                    </div>
                  </div>
                ) : isCoachMode ? (
                  <div className="space-y-4 mb-6">
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Modo Coach Activo</span>
                      </div>
                      <p className="text-amber-700 dark:text-amber-400/90 leading-relaxed">
                        Estás navegando en Modo Coach. Para reservar mentorías o agendar clases con este coach como alumno, cambia a Modo Aprendiz desde el menú de tu perfil.
                      </p>
                    </div>

                    <Link
                      href="/coach/dashboard"
                      className="w-full py-3.5 bg-cfh-dark-green hover:bg-[#061528] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Volver a mi Panel de Coach
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {coach.freeIntroEnabled && isEligibleForFreeIntro ? (
                      <>
                        <button
                          onClick={() => handleOpenBooking("free_intro")}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-600/20 hover:shadow-xl transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          {t("CoachProfile.book_free_call", `Agendar Llamada Gratuita (${coach.freeIntroMinutes || 15} min)`, { min: coach.freeIntroMinutes || 15 })}
                        </button>
                        <button
                          onClick={() => handleOpenBooking("regular")}
                          className="w-full py-3 bg-cfh-dark-green hover:bg-[#061528] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {t("CoachProfile.book_regular_session", "Reservar Clase Regular (60 min)")}
                        </button>
                      </>
                    ) : (
                      <>
                        {coach.freeIntroEnabled && !isEligibleForFreeIntro && (
                          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{t("CoachProfile.free_intro_already_used", "Ya has disfrutado tu prueba gratuita con este coach.")}</span>
                          </div>
                        )}
                        <button
                          onClick={() => handleOpenBooking("regular")}
                          className="w-full py-4 bg-cfh-dark-green hover:bg-[#061528] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-cfh-dark-green/20 hover:shadow-xl transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {t("CoachProfile.book_regular_session", "Reservar Clase Regular (60 min)")}
                        </button>
                      </>
                    )}

                    {canMessageCoach ? (
                      <button
                        onClick={handleOpenMessage}
                        className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 hover:border-cfh-dark-green dark:hover:border-cfh-light-green text-cfh-dark-green dark:text-cfh-light-green font-bold text-sm rounded-2xl transition-all hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {t("CoachProfile.send_direct_message", "Enviar Mensaje Directo")}
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenMessage}
                        className="w-full py-3 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-500 dark:text-slate-400 font-semibold text-xs sm:text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer group"
                        title={t("CoachProfile.direct_message_locked_tooltip", "Disponible después de reservar una clase o adquirir un curso")}
                      >
                        <Lock className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors" />
                        <span>{t("CoachProfile.direct_message", "Mensaje Directo")}</span>
                        <span className="text-xs bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded-md border border-transparent dark:border-amber-800/40">{t("CoachProfile.upon_payment", "Al pagar")}</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-2 pt-5 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400">
                  <p className="flex items-center gap-2">✓ {t("CoachProfile.feature_video_call", "Sesiones en vivo de 60 minutos por videollamada integrada")}</p>
                  <p className="flex items-center gap-2">
                    ✓ {t("CoachProfile.feature_direct_chat", "Chat directo con el coach (habilitado al pagar)")}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Booking Modal */}
      {isBookingOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseBooking();
            }
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl relative flex flex-col max-h-[92vh] border border-gray-100 dark:border-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Fijo (Siempre visible aunque se haga scroll) */}
            <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                {bookingStep === "payment" && !bookingSuccess && (
                  <button
                    type="button"
                    onClick={() => setBookingStep("details")}
                    className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Volver a fechas"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {bookingSuccess
                      ? (bookingType === "regular" ? t("CoachProfile.success_title_regular", "¡Pago y Reserva Confirmados!") : t("CoachProfile.success_title_free", "¡Solicitud de Reserva Enviada!"))
                      : bookingStep === "payment"
                      ? t("CoachProfile.step_payment", "Confirmación y Pago Seguro")
                      : bookingType === "free_intro"
                      ? t("CoachProfile.free_intro_session", "Llamada de Prueba Gratuita")
                      : t("CoachProfile.regular_session", "Agendar Sesión en vivo de 60 minutos", { rate: `$${coach.hourlyRate}` })}
                  </h3>
                  <p className="text-xs sm:text-sm sm:text-xs text-gray-500 dark:text-slate-400">
                    {bookingSuccess
                      ? (bookingType === "regular" ? t("CoachProfile.success_desc_regular", { name: coach.name, price: coach.hourlyRate, currency: coach.currency }) : t("CoachProfile.success_desc_free", { name: coach.name }))
                      : bookingStep === "payment"
                      ? t("CoachProfile.regular_session_subtitle", { name: coach.name })
                      : bookingType === "free_intro"
                      ? t("CoachProfile.free_intro_subtitle", { name: coach.name, min: coach.freeIntroMinutes || 15 })
                      : t("CoachProfile.regular_session_subtitle", { name: coach.name })}
                  </p>

                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseBooking}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo desplazable con Scroll */}
            <div className="overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 flex-1 space-y-4">
              {!bookingSuccess ? (
                bookingStep === "details" ? (
                  <div>
                    {coach.freeIntroEnabled && (
                      isEligibleForFreeIntro ? (
                        <>
                          {isSecondChance && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-2.5 mb-3 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
                              <span>✨</span>
                              <span><strong>Segunda Oportunidad:</strong> Puedes reagendar tu sesión de prueba gratuita tras la inasistencia previa. Toma en cuenta que ya no se permitirán terceras oportunidades.</span>
                            </div>
                          )}
                          <div className="flex rounded-xl bg-gray-100 dark:bg-slate-800 p-1 mb-4">
                            <button
                              type="button"
                              onClick={() => setBookingType("free_intro")}
                              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                bookingType === "free_intro"
                                  ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                                  : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                              }`}
                            >
                              {t("CoachProfile.free_intro_tab", `Prueba Gratis (${coach.freeIntroMinutes || 15}m)`, { min: coach.freeIntroMinutes || 15 })}
                            </button>
                            <button
                              type="button"
                              onClick={() => setBookingType("regular")}
                              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                bookingType === "regular"
                                  ? "bg-white dark:bg-slate-700 text-cfh-dark-green dark:text-cfh-light-green shadow-xs"
                                  : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                              }`}
                            >
                              {t("CoachProfile.regular_session_tab", "Sesiones en vivo de 60 minutos")}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-2.5 mb-4 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{t("CoachProfile.free_intro_already_used_notice", "Ya has disfrutado tu prueba gratuita con este coach. Mostrando horarios para sesiones en vivo de 60 minutos.")}</span>
                        </div>
                      )
                    )}

                    <div className="space-y-4">
                      {(() => {
                        const allowedWeekdays = bookingType === "free_intro"
                          ? (coach.freeIntroWeekdays && coach.freeIntroWeekdays.length > 0 ? coach.freeIntroWeekdays : [1, 2, 3, 4, 5])
                          : (coach.regularWeekdays && coach.regularWeekdays.length > 0 ? coach.regularWeekdays : [1, 2, 3, 4, 5]);
                        return (
                          <BookingCalendar
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                            selectedTime={selectedTime}
                            onTimeSelect={setSelectedTime}
                            availableTimes={availableTimes}
                            isLoadingTimes={isLoadingTimes}
                            coachTimezone={coach.timezone || "America/Mexico_City"}
                            allowedWeekdays={allowedWeekdays}
                          />
                        );
                      })()}

                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">{t("CoachProfile.notes_label", "¿En qué te gustaría enfocarte en esta sesión?")}</label>
                        <textarea
                          rows={3}
                          value={bookingNotes}
                          onChange={(e) => setBookingNotes(e.target.value)}
                          placeholder={t("CoachProfile.notes_placeholder", "Cuéntale al coach tus objetivos o dudas principales...")}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cfh-dark-green/20 resize-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      
                      {bookingError && <p className="text-red-500 text-xs font-bold">{bookingError}</p>}

                      {/* Botones de acción: Cancelar y Confirmar */}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleCloseBooking}
                          className="flex-1 py-3 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer text-center"
                        >
                          {t("CoachProfile.close", "Cancelar")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedDate || !selectedTime) return;
                            if (bookingType === "regular") {
                              setBookingStep("payment");
                            } else {
                              handleBook(false);
                            }
                          }}
                          disabled={!selectedDate || !selectedTime || isBooking}
                          className="flex-[2] py-3 px-4 bg-cfh-dark-green text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg hover:bg-[#061528] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isBooking ? (
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          ) : bookingType === "regular" ? (
                            <>
                              <CreditCard className="w-4 h-4 shrink-0" />
                              <span>{t("CoachProfile.continue_button", "Continuar")} (${coach.hourlyRate}.00 {coach.currency})</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 shrink-0" />
                              <span>{t("CoachProfile.confirm_and_book", "Confirmar Reserva")}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* PASO 2: PAGO SEGURO PARA CLASE REGULAR */
                  <div>
                    {/* Resumen del Pedido */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 rounded-2xl p-4 mb-4 space-y-2 text-xs text-gray-600 dark:text-slate-300">
                      <div className="flex justify-between font-medium">
                        <span>{t("CoachProfile.summary_coach", "Coach / Mentor:")}</span>
                        <span className="text-gray-900 dark:text-white font-bold">{coach.name}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>{t("CoachProfile.summary_datetime", "Fecha y Hora:")}</span>
                        <span className="text-gray-900 dark:text-white font-bold">
                          {selectedDate?.toLocaleDateString(locale === "EN" ? "en-US" : "es-ES", { weekday: "short", day: "numeric", month: "short" })} {locale === "EN" ? "at" : "a las"} {selectedTime}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>{t("CoachProfile.summary_duration", "Duración:")}</span>
                        <span className="text-gray-900 dark:text-white font-bold">{t("CoachProfile.summary_duration_val", "60 minutos")}</span>
                      </div>
                      {bookingNotes && (
                        <div className="pt-1 text-xs sm:text-sm text-gray-500 dark:text-slate-400 truncate">
                          <span className="font-semibold">Nota:</span> "{bookingNotes}"
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-baseline text-sm font-extrabold text-gray-900 dark:text-white">
                        <span>{t("CoachProfile.summary_total", "Total a pagar:")}</span>
                        <span className="text-lg text-emerald-700 dark:text-emerald-400 font-black">${coach.hourlyRate}.00 {coach.currency}</span>
                      </div>
                    </div>

                    {isLoadingCards ? (
                      <div className="py-6 flex justify-center">
                        <div className="w-6 h-6 border-2 border-cfh-light-green border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : savedCards.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">Métodos de pago guardados</h4>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                          {savedCards.map((card) => {
                            const isSelected = selectedCardId === card.id;
                            return (
                              <div
                                key={card.id}
                                onClick={() => setSelectedCardId(card.id)}
                                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                  isSelected
                                    ? "border-cfh-dark-green dark:border-cfh-light-green bg-cfh-light-green/10 dark:bg-cfh-dark-green/20"
                                    : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    isSelected ? "border-cfh-dark-green dark:border-cfh-light-green" : "border-gray-300 dark:border-slate-600"
                                  }`}>
                                    {isSelected && <div className="w-2 h-2 rounded-full bg-cfh-dark-green dark:bg-cfh-light-green" />}
                                  </div>
                                  <span className="text-xs font-black uppercase text-gray-700 dark:text-slate-200">
                                    {card.brand.toUpperCase()} •••• {card.last4}
                                  </span>
                                  <span className="text-[11px] text-gray-400">
                                    (Vence {String(card.expMonth).padStart(2, "0")}/{card.expYear})
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => handleBook(true)}
                          disabled={isBooking || !selectedCardId}
                          className="w-full mt-2 py-3 px-4 bg-cfh-dark-green hover:bg-[#061528] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isBooking ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Procesando pago...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4" />
                              <span>Pagar con tarjeta guardada (${coach.hourlyRate}.00 {coach.currency})</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {bookingError && <p className="text-red-500 text-xs font-bold mb-3">{bookingError}</p>}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setBookingStep("details")}
                        className="flex-1 py-3 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer text-center"
                      >
                        {t("CoachProfile.close", "Volver")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBook(false)}
                        disabled={isBooking}
                        className={`flex-[2] py-3 px-4 font-extrabold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                          savedCards.length > 0
                            ? "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700"
                            : "bg-cfh-dark-green hover:bg-[#061528] text-white shadow-lg"
                        }`}
                      >
                        {isBooking ? (
                          <>
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                            <span>{t("Checkout.processing_payment", "Procesando pago seguro...")}</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 text-cfh-light-green shrink-0" />
                            <span>{savedCards.length > 0 ? "+ Pagar con Stripe / Otra tarjeta" : t("CoachProfile.pay_and_confirm", `Pagar $${coach.hourlyRate}.00 y Confirmar`, { price: coach.hourlyRate, currency: coach.currency })}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                /* PANTALLA DE ÉXITO */
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    ✓
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {bookingType === "regular" ? t("CoachProfile.success_title_regular", "¡Pago y Reserva Confirmados!") : t("CoachProfile.success_title_free", "¡Solicitud de Reserva Enviada!")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                    {bookingType === "regular"
                      ? t("CoachProfile.success_desc_regular", { name: coach.name, price: coach.hourlyRate, currency: coach.currency })
                      : t("CoachProfile.success_desc_free", { name: coach.name })}
                  </p>
                  <div className="flex flex-col gap-2.5">
                    <Link
                      href={`/${locale}/dashboard#agenda`}
                      className="w-full py-3 bg-cfh-dark-green text-white font-bold text-sm rounded-xl text-center hover:bg-[#061528] transition-colors cursor-pointer"
                    >
                      {t("CoachProfile.view_in_agenda", "Ver en mi Agenda de Aprendiz")}
                    </Link>
                    <button
                      type="button"
                      onClick={handleCloseBooking}
                      className="w-full py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      {t("CoachProfile.close", "Cerrar")}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Live Direct Chat Modal with Coach */}
      {isMessageOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsMessageOpen(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden flex flex-col h-[600px] border border-gray-100 dark:border-slate-800">
            {/* Chat Modal Header */}
            <div className="p-4 px-6 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={coach.avatarUrl}
                    alt={coach.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-slate-700"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(coach.name)}&background=081B33&color=A7D4B6&bold=true`;
                    }}
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight flex items-center gap-1.5">
                    {t("CoachProfile.chat_modal_title", `Chat con ${translateCoachName(coach.name, t)}`, { name: translateCoachName(coach.name, t) })}
                  </h3>
                  <p className="text-xs sm:text-sm text-cfh-dark-green dark:text-cfh-light-green font-semibold truncate max-w-[200px]">
                    {translateCoachHeadline(coach.headline, t)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {conversationId && (
                  <Link
                    href={`/messages?conversationId=${conversationId}`}
                    className="p-1.5 text-gray-400 hover:text-cfh-dark-green dark:hover:text-cfh-light-green hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Abrir en pantalla completa"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
                  </Link>
                )}
                <button
                  onClick={() => setIsMessageOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Chat Modal Messages Body */}
            <div className="flex-1 p-5 overflow-y-auto overscroll-contain space-y-3 bg-slate-50/50 dark:bg-slate-950/50">
              {loadingChat ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400 dark:text-slate-500">
                  {t("CoachProfile.chat_loading", "Cargando conversación...")}
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 dark:text-slate-500">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center text-cfh-dark-green dark:text-cfh-light-green mb-3 border border-gray-100 dark:border-slate-700">
                    💬
                  </div>
                  <h4 className="font-bold text-sm text-gray-800 dark:text-slate-200 mb-1">{t("CoachProfile.start_conversation_title", "Inicia la conversación")}</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs">
                    {t("CoachProfile.start_conversation_desc", `Pregúntale a ${coach.name} sobre temas específicos, horarios o dudas antes de agendar.`, { name: coach.name })}
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser?.id;
                  const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div
                        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                          isMe
                            ? "bg-cfh-dark-green text-white rounded-br-xs"
                            : "bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-200 dark:border-slate-700 rounded-bl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500 font-medium mt-0.5 px-1">{timeStr}</span>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Policy Notice */}
            {chatPolicyWarning && (
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-medium flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{chatPolicyWarning}</span>
              </div>
            )}

            {/* Chat Modal Input */}
            <form onSubmit={handleSendChatMessage} className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder={t("CoachProfile.chat_placeholder", "Escribe un mensaje para el coach...")}
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  if (chatPolicyWarning) setChatPolicyWarning(null);
                }}
                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-cfh-dark-green transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!messageText.trim() || isSendingMessage}
                className="bg-cfh-dark-green hover:bg-[#061528] disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 text-xs sm:text-sm shrink-0 cursor-pointer"
              >
                {isSendingMessage ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span>{t("CoachProfile.send_button", "Enviar")}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Auth Requirement Modal */}
      <AnimatePresence>
        {authPromptOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAuthPromptOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center border border-gray-100 dark:border-slate-800"
            >
              <button
                onClick={() => setAuthPromptOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 cursor-pointer"
              >
                ✕
              </button>

              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-cfh-dark-green dark:text-cfh-light-green rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-900/60 shadow-sm font-bold text-2xl">
                🔒
              </div>

              <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
                {t("CoachesDirectory.login_to_book", "Inicia sesión para continuar")}
              </h3>

              <p className="text-sm text-gray-600 dark:text-slate-300 mb-6 leading-relaxed">
                {t("CoachProfile.auth_prompt_desc", `Para chatear o agendar una sesión con ${coach.name}, debes iniciar sesión o crear tu cuenta de Aprendiz.`, { name: coach.name })}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setAuthPromptOpen(false);
                    openRegisterWithRole("STUDENT");
                  }}
                  className="w-full py-3.5 bg-cfh-light-green text-cfh-dark-green font-extrabold text-sm rounded-xl shadow-md hover:bg-cfh-dark-green hover:text-white transition-all cursor-pointer"
                >
                  {t("CoachesDirectory.register_student_btn", "Crear Cuenta de Aprendiz")}
                </button>

                <button
                  onClick={() => {
                    setAuthPromptOpen(false);
                    openLogin();
                  }}
                  className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 font-bold text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                >
                  {t("CoachesDirectory.login_btn", "Ya tengo cuenta (Iniciar Sesión)")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Requirement Modal for Direct Messages */}
      <AnimatePresence>
        {requirePaymentModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRequirePaymentModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center border border-gray-100 dark:border-slate-800"
            >
              <button
                onClick={() => setRequirePaymentModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 cursor-pointer"
              >
                ✕
              </button>

              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800/60 shadow-sm">
                <Lock className="w-8 h-8" />
              </div>

              <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
                {t("CoachProfile.exclusive_student_chat", "Chat Exclusivo para Aprendices")}
              </h3>

              <p className="text-sm text-gray-600 dark:text-slate-300 mb-6 leading-relaxed">
                {t("CoachProfile.exclusive_student_chat_desc", `Para enviar mensajes directos a ${coach.name}, necesitas haber reservado una clase regular o adquirido uno de sus cursos.`, { name: coach.name })}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setRequirePaymentModalOpen(false);
                    handleOpenBooking("regular");
                  }}
                  className="w-full py-3.5 bg-cfh-dark-green hover:bg-[#061528] text-white font-extrabold text-sm rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {t("CoachProfile.book_regular_session", "Reservar Clase Regular (60 min)")} (${coach.hourlyRate} USD)
                </button>

                <button
                  onClick={() => setRequirePaymentModalOpen(false)}
                  className="w-full py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {t("CoachProfile.understood_return", "Entendido, volver")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Personalización de Portada */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-950 dark:text-white">
                    Personalizar Foto de Portada
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Elige una imagen profesional para el encabezado de tu perfil público.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bannerUploadError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 font-semibold">
                {bannerUploadError}
              </div>
            )}

            {/* Subir archivo propio */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                Subir tu propia imagen (JPG, PNG o WebP, máx 5MB)
              </label>
              <input
                ref={bannerFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUploadBannerFile}
                className="hidden"
              />
              <button
                type="button"
                disabled={isSavingBanner}
                onClick={() => bannerFileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-gray-600 dark:text-slate-300 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all cursor-pointer group disabled:opacity-50"
              >
                {isSavingBanner ? (
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400 group-hover:text-emerald-500 transition-colors" />
                )}
                <span className="text-sm font-bold">
                  {isSavingBanner ? "Guardando portada..." : "Haz clic para seleccionar una imagen de tu dispositivo"}
                </span>
                <span className="text-xs text-gray-400">Resolución recomendada: 1600 × 500 px</span>
              </button>
            </div>

            {/* Galería de temas predefinidos profesionales */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-3">
                O elige uno de nuestros fondos profesionales de alta resolución:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BANNER_PRESETS.map((preset) => {
                  const isSelected = bannerUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={isSavingBanner}
                      onClick={() => handleSelectBanner(preset.url)}
                      className={`relative group rounded-2xl overflow-hidden aspect-[16/9] border-2 transition-all cursor-pointer text-left ${
                        isSelected
                          ? "border-emerald-500 ring-2 ring-emerald-500/50 shadow-md scale-102"
                          : "border-gray-200 dark:border-slate-800 hover:border-emerald-400/60"
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                      <span className="absolute bottom-2 left-2 right-2 text-[11px] font-bold text-white line-clamp-1 leading-tight">
                        {preset.name}
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botones de acción del modal */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
              {bannerUrl ? (
                <button
                  type="button"
                  disabled={isSavingBanner}
                  onClick={handleRemoveBanner}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Restaurar estilo por defecto
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


