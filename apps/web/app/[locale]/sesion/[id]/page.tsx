"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  MonitorUp,
  MessageSquare,
  PhoneOff,
  FileText,
  PenTool,
  Download,
  Send,
  ChevronLeft,
  Lock,
  Sparkles,
  FolderOpen,
  Users,
  UserCheck,
  RotateCcw,
  CheckCircle2,
  Star,
  ArrowRight,
  BookOpen,
  Clock,
  AlertTriangle,
  Bell,
  X,
} from 'lucide-react';
import { validateCommunitySafety } from '@/lib/communitySafety';
import { getBookingById, completeBookingSession, submitBookingReview, joinBookingSession } from '@/app/actions/bookings';
import { updateSessionNotes as saveSessionNotes, reportSessionProblem } from '@/app/actions/session';
import type { CoachTier } from '@prisma/client';

// Modales oficiales de herramientas de Coach
import { CoachWhiteboardModal } from '@/components/coach/CoachWhiteboardModal';
import { CoachStudentTrackingModal } from '@/components/coach/CoachStudentTrackingModal';
import { CoachResourcesModal } from '@/components/coach/CoachResourcesModal';
import { CoachAiCopilotModal } from '@/components/coach/CoachAiCopilotModal';
import { useTranslation } from '@/components/TranslationProvider';
import { useVideoCall } from '@/hooks/useVideoCall';
import { useCopilot } from '@/hooks/useCopilot';

export type SessionPerspective = 'STUDENT' | 'COACH';

interface TierFeatureConfig {
  name: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  accent: string;
  glow: string;
  tools: {
    whiteboard: boolean;
    resources: boolean;
    tracking: boolean;
    copilot: boolean;
  };
}

const TIER_FEATURES: Record<CoachTier, TierFeatureConfig> = {
  BASIC: {
    name: 'Coach Básico',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-400',
    badgeBorder: 'border-blue-500/30',
    accent: '#3B82F6',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]',
    tools: {
      whiteboard: false,
      resources: false,
      tracking: false,
      copilot: false,
    },
  },
  ELITE: {
    name: 'Coach Élite',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/30',
    accent: '#7C3AED',
    glow: 'shadow-[0_0_15px_rgba(124,58,237,0.3)]',
    tools: {
      whiteboard: true,
      resources: false,
      tracking: false,
      copilot: false,
    },
  },
  GOLD: {
    name: 'Coach Gold',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/30',
    accent: '#EAB308',
    glow: 'shadow-[0_0_15px_rgba(234,179,8,0.3)]',
    tools: {
      whiteboard: true,
      resources: true,
      tracking: true,
      copilot: false,
    },
  },
  PLATINUM: {
    name: 'Coach Platinum',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-300',
    badgeBorder: 'border-indigo-500/30',
    accent: '#6366F1',
    glow: 'shadow-[0_0_15px_rgba(99,102,241,0.35)]',
    tools: {
      whiteboard: true,
      resources: true,
      tracking: true,
      copilot: true,
    },
  },
  CURSOS_ONLY: {
    name: 'Coach Cursos',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    accent: '#10B981',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
    tools: {
      whiteboard: false,
      resources: false,
      tracking: false,
      copilot: false,
    },
  },
};

function Session1on1Content() {

  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = params?.id as string;

  const urlRole = searchParams.get('role');
  const urlTier = searchParams.get('tier');

  // Session Data & Identity
  const [bookingData, setBookingData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [perspective, setPerspective] = useState<SessionPerspective>('STUDENT');
  const [coachTier, setCoachTier] = useState<CoachTier>('ELITE');
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Sync role and tier from URL params if present
  useEffect(() => {
    if (urlRole) {
      setPerspective(urlRole.toLowerCase() === 'coach' ? 'COACH' : 'STUDENT');
    }
    if (urlTier) {
      const upper = urlTier.toUpperCase();
      if (upper in TIER_FEATURES) {
        setCoachTier(upper as CoachTier);
      }
    }
  }, [urlRole, urlTier]);

  // Post-Session & Rating State
  const [showPostSessionModal, setShowPostSessionModal] = useState(false);
  const [postSessionStep, setPostSessionStep] = useState<'review' | 'continuity'>('review');
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [completedBookingInfo, setCompletedBookingInfo] = useState<any>(null);
  const [notesSavedIndicator, setNotesSavedIndicator] = useState(false);

  // WebRTC Video Call Integration (DER-131)
  const videoRoomId =
    bookingId && bookingId !== 'demo' && bookingId !== '1' && bookingId !== '2'
      ? `cfh-${bookingId}`
      : 'cfh-demo';

  const effectiveUserId = currentUser?.id
    ? `${currentUser.id}_${(urlRole || perspective || 'student').toLowerCase()}`
    : null;

  const {
    connectionState,
    localStream,
    remoteStream,
    screenStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    remotePeer,
    isAdmitted,
    admitStudent,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    sendChatMessage,
    leaveCall,
  } = useVideoCall({
    roomId: videoRoomId,
    currentUser: currentUser && effectiveUserId
      ? {
          id: effectiveUserId,
          name: currentUser.name || (perspective === 'COACH' ? 'Coach' : 'Aprendiz'),
          role: perspective,
        }
      : null,
    enabled: !isLoadingSession && !!currentUser && !showPostSessionModal,
    onCustomData: (type, data) => {
        if (type === 'draw') {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          ctx.beginPath();
          ctx.moveTo(data.x0 * canvas.width, data.y0 * canvas.height);
          ctx.lineTo(data.x1 * canvas.width, data.y1 * canvas.height);
          ctx.strokeStyle = data.color;
          ctx.lineWidth = data.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        } else if (type === 'clear') {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      },
      onChatMessage: (incoming) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      },
    });



  const [isSwappedView, setIsSwappedView] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  // Joel's session flow states (DER-97)
  const [sessionStatus, setSessionStatus] = useState<'WAITING' | 'IN_PROGRESS' | 'ABSENT'>('IN_PROGRESS');
  const [elapsedWaitMinutes, setElapsedWaitMinutes] = useState(0);

  // Tabs
  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'whiteboard' | 'tools'>('chat');

  // Modals for Coach Tools
  const [isWhiteboardModalOpen, setIsWhiteboardModalOpen] = useState(false);
  const [isResourcesModalOpen, setIsResourcesModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isCopilotModalOpen, setIsCopilotModalOpen] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Array<{ id: string; sender: string; isMe: boolean; text: string; time: string; role?: string; type?: string; url?: string; title?: string }>>([
    {
      id: '1',
      sender: 'Coach',
      isMe: false,
      role: 'COACH',
      text: '¡Hola! Bienvenidos a la sesión en vivo en Coaching From Home. ¿Me escuchas y ves con claridad?',
      time: '10:00 AM',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat internally without moving the page/window
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  // Time & Duration Limit States (15 min for free intro, 60 min for regular)
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(15);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15 * 60);
  const [consumedSeconds, setConsumedSeconds] = useState<number>(0);
  const [sessionStartTimeMs, setSessionStartTimeMs] = useState<number>(Date.now());
  const [isCoachReported, setIsCoachReported] = useState(false);
  const [showFiveMinWarning, setShowFiveMinWarning] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [isTimeUpModalOpen, setIsTimeUpModalOpen] = useState(false);
  const demoEndMsRef = useRef<number | null>(null);

  // Notes States
  const [studentNotes, setStudentNotes] = useState(
    '# Mis Notas de la Sesión:\n- Objetivos principales a tratar hoy:\n- Dudas técnicas y feedback:\n- Tareas y siguientes pasos recomendados por el coach:'
  );

  const [coachNotes, setCoachNotes] = useState(
    '# Notas Privadas del Coach (Evaluación del Alumno):\n- Nivel de comprensión del tema:\n- Puntos fuertes demostrados:\n- Áreas de refuerzo para la próxima sesión:\n- Tareas asignadas:'
  );

  // Notas ahora se cargan desde la DB en loadBooking()

  const handleUpdateStudentNotes = (val: string) => {
    setStudentNotes(val);
    if (typeof window !== 'undefined' && bookingId) {
      localStorage.setItem(`cfh_notes_${bookingId}_student`, val);
      setNotesSavedIndicator(true);
      setTimeout(() => setNotesSavedIndicator(false), 2000);
    }
  };

  const handleUpdateCoachNotes = (val: string) => {
    setCoachNotes(val);
    if (typeof window !== 'undefined' && bookingId) {
      localStorage.setItem(`cfh_notes_${bookingId}_coach`, val);
      setNotesSavedIndicator(true);
      setTimeout(() => setNotesSavedIndicator(false), 2000);
    }
  };

  // Embedded Whiteboard Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#22c55e');
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  // Fullscreen Container & Video Element Refs
  const roomContainerRef = useRef<HTMLDivElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const hasAutoEndedRef = useRef(false);

  const handleImmediateSessionEnd = useCallback(async () => {
    if (hasAutoEndedRef.current) return;
    hasAutoEndedRef.current = true;

    setSecondsRemaining(0);
    setIsTimeUpModalOpen(false);
    setShowExitModal(false);

    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    // 1. Terminar inmediatamente la llamada WebRTC y apagar tracks
    try {
      leaveCall();
    } catch (e) {
      console.error("Error al desconectar llamada por límite de tiempo:", e);
    }

    // 2. Marcar la reserva como completada en la base de datos con fallback seguro
    if (bookingId && bookingId !== 'demo' && bookingId !== '1' && bookingId !== '2') {
      try {
        const res = await completeBookingSession(bookingId);
        if (res?.success && res.booking) {
          setCompletedBookingInfo(res.booking);
        } else if (bookingData) {
          setCompletedBookingInfo({
            id: bookingData.id,
            coachId: bookingData.coach?.id,
            coachProfileId: bookingData.coach?.profileId || bookingData.coach?.id,
            coachSlug: (bookingData.coach as any)?.slug || bookingData.coach?.id,
            coachName: bookingData.coach?.name || "Coach",
            studentId: bookingData.student?.id,
            studentName: bookingData.student?.name || "Aprendiz",
            isFreeIntro: bookingData.isFreeIntro,
          });
        }
      } catch (e) {
        console.error("Error al completar reserva automáticamente:", e);
        if (bookingData) {
          setCompletedBookingInfo({
            id: bookingData.id,
            coachId: bookingData.coach?.id,
            coachProfileId: bookingData.coach?.profileId || bookingData.coach?.id,
            coachSlug: (bookingData.coach as any)?.slug || bookingData.coach?.id,
            coachName: bookingData.coach?.name || "Coach",
            studentId: bookingData.student?.id,
            studentName: bookingData.student?.name || "Aprendiz",
            isFreeIntro: bookingData.isFreeIntro,
          });
        }
      }
    } else if (bookingData) {
      setCompletedBookingInfo({
        id: bookingData.id || 'demo',
        coachId: bookingData.coach?.id || 'coach-1',
        coachProfileId: bookingData.coach?.profileId || bookingData.coach?.id || 'coach-1',
        coachSlug: (bookingData.coach as any)?.slug || 'valeria-mendoza',
        coachName: bookingData.coach?.name || "Coach",
        studentId: bookingData.student?.id || 'student-1',
        studentName: bookingData.student?.name || "Aprendiz",
        isFreeIntro: bookingData.isFreeIntro,
      });
    }

    // 3. Enviar inmediatamente al modal de evaluación del docente
    setPostSessionStep('review');
    setShowPostSessionModal(true);
  }, [bookingId, bookingData, leaveCall]);

  // 1. Fetch Current User & Detect Role con Redirección si no está autenticado
  useEffect(() => {
    async function checkAuthUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          const user = data?.user || (data?.authenticated ? data?.user : null);
          if (user) {
            setCurrentUser(user);
            if (urlRole) {
              setPerspective(urlRole.toUpperCase() === 'COACH' ? 'COACH' : 'STUDENT');
            } else if (user.role === 'COACH') {
              setPerspective('COACH');
            } else {
              setPerspective('STUDENT');
            }
          } else if (bookingId && bookingId !== 'demo' && bookingId !== '1' && bookingId !== '2') {
            const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/?auth=login&callbackUrl=${redirectUrl}&redirect=${redirectUrl}`;
            return;
          }
        } else if (bookingId && bookingId !== 'demo' && bookingId !== '1' && bookingId !== '2') {
          const redirectUrl = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/?auth=login&callbackUrl=${redirectUrl}&redirect=${redirectUrl}`;
          return;
        }
      } catch (err) {
        console.error('Error verificando usuario actual:', err);
      }
    }
    checkAuthUser();
  }, [urlRole, bookingId]);

  // 2. Fetch Booking Details & Sincronizar Temporizador Persistente
  useEffect(() => {
    async function loadBooking() {
      if (!bookingId || bookingId === 'demo' || bookingId === '1' || bookingId === '2') {
        const dur = 15;
        setSessionDurationMinutes(dur);
        const storageKey = `cfh_demo_end_${bookingId || 'demo'}`;
        let endMs = 0;
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            endMs = parseInt(saved, 10);
            if (isNaN(endMs) || endMs < Date.now() - 3600000) {
              endMs = Date.now() + dur * 60 * 1000;
              localStorage.setItem(storageKey, endMs.toString());
            }
          } else {
            endMs = Date.now() + dur * 60 * 1000;
            localStorage.setItem(storageKey, endMs.toString());
          }
        }
        demoEndMsRef.current = endMs;
        const diffSec = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
        setSecondsRemaining(diffSec);
        setIsLoadingSession(false);
        return;
      }

      try {
        // Sincronizar ingreso y asegurar endAt persistido en la base de datos
        const joinRes = await joinBookingSession(bookingId).catch(() => null);
        const res = await getBookingById(bookingId);
        if (res.success && res.booking) {
          const effectiveEndAt = joinRes?.endAt || res.booking.endAt;
          const updatedBooking = { ...res.booking, endAt: effectiveEndAt };
          setBookingData(updatedBooking);
          if (updatedBooking.notes) setCoachNotes(updatedBooking.notes);
          if ((updatedBooking as any).studentNotes) setStudentNotes((updatedBooking as any).studentNotes);

          // Si la sesión ya finalizó, mostrar directamente la pantalla post-sesión y omitir videollamada
          if (joinRes?.isCompleted || res.booking.status === 'COMPLETED' || res.booking.completedAt) {
            setCompletedBookingInfo({
              id: res.booking.id,
              coachId: res.booking.coach?.id,
              coachProfileId: res.booking.coach?.id,
              coachSlug: (res.booking.coach as any)?.slug || res.booking.coach?.id,
              coachName: res.booking.coach?.name || "Coach",
              studentId: res.booking.student?.id,
              studentName: res.booking.student?.name || "Aprendiz",
              isFreeIntro: res.booking.isFreeIntro,
            });
            setShowPostSessionModal(true);
            setPostSessionStep('review');
            setIsLoadingSession(false);
            return;
          }

          const dur = res.booking.isFreeIntro ? 15 : (res.booking.durationMinutes || 60);
          setSessionDurationMinutes(dur);
          setConsumedSeconds((res.booking as any).consumedSeconds || 0);

          if (res.booking.status === 'NO_SHOW') {
            alert('Esta sesión ya no es válida.');
            window.location.href = '/dashboard';
            return;
          }

          if (res.booking.coach?.tier && !urlTier) {
            setCoachTier(res.booking.coach.tier);
          }
          if (!urlRole && currentUser?.id) {
            if (res.booking.coach?.id === currentUser.id) {
              setPerspective('COACH');
            } else if (res.booking.student?.id === currentUser.id) {
              setPerspective('STUDENT');
            }
          }
        }
      } catch (err) {
        console.error('Error cargando datos de la reserva:', err);
      } finally {
        setIsLoadingSession(false);
      }
    }
    loadBooking();
  }, [bookingId, currentUser, urlTier, handleImmediateSessionEnd]);

  // 3. Temporizador sincronizado con fecha de finalización real (no se reinicia al recargar)
  useEffect(() => {
    if (showPostSessionModal) return;

    const checkTimer = () => {
      // 1. Detección de ausencia del coach (30 min)
      if (!isCoachView && connectionState !== 'connected' && !isCoachReported) {
        const elapsedSinceStart = Math.floor((Date.now() - sessionStartTimeMs) / 1000);
        if (elapsedSinceStart >= 1800) {
           // UI Button will show
        }
      }

      // 2. Incrementar tiempo solo si están conectados
      if (connectionState === 'connected') {
        setConsumedSeconds(prev => {
          const next = prev + 1;
          const totalSec = sessionDurationMinutes * 60;
          const remaining = Math.max(0, totalSec - next);
          setSecondsRemaining(remaining);
          
          if (remaining <= 0) {
            handleImmediateSessionEnd();
          } else if (remaining <= 300 && !warningDismissed) {
            setShowFiveMinWarning(true);
          }
          
          // Sincronizar DB (simulado en client interval, ideal sería cada 15s)
          
          return next;
        });
      } else {
        const totalSec = sessionDurationMinutes * 60;
        setSecondsRemaining(Math.max(0, totalSec - consumedSeconds));
      }
    };
    const timer = setInterval(checkTimer, 1000);

    return () => clearInterval(timer);
  }, [showPostSessionModal, warningDismissed, bookingData?.endAt, handleImmediateSessionEnd]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleReportCoachAbsence = async () => {
    if (confirm('¿Estás seguro de reportar la ausencia del Coach? La sesión se cancelará y podrás reagendarla gratis.')) {
      setIsCoachReported(true);
      const res: any = { success: true };
      if (res.success) {
        alert('Coach reportado. Ahora puedes reagendar la sesión desde tu panel.');
        window.location.href = '/dashboard';
      } else {
        alert('Error: ' + res.error);
        setIsCoachReported(false);
      }
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (roomContainerRef.current?.requestFullscreen) {
          await roomContainerRef.current.requestFullscreen();
        } else if ((roomContainerRef.current as any)?.webkitRequestFullscreen) {
          await (roomContainerRef.current as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any)?.webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Error al cambiar a pantalla completa:', err);
    }
  };

  // Conectar streams WebRTC a los elementos de video y audio
  useEffect(() => {
    if (userVideoRef.current && localStream) {
      userVideoRef.current.srcObject = localStream;
      userVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isSwappedView, isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, isSwappedView, remotePeer?.isVideoOff]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (screenShareVideoRef.current && screenStream) {
      screenShareVideoRef.current.srcObject = screenStream;
      screenShareVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, isScreenSharing]);

  // Embedded Canvas Initialization
  useEffect(() => {
    if (activeTab === 'whiteboard' && TIER_FEATURES[coachTier]?.tools.whiteboard) {
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (rect) {
          canvas.width = rect.width;
          canvas.height = rect.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, coachTier]);

  const startCanvasDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length > 0 && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const drawOnCanvas = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length > 0 && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = brushSize;
    ctx.strokeStyle = isEraser ? '#ffffff' : drawColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopCanvasDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleResourceShared = (url: string, title: string) => {
    const newMsg = {
      id: Date.now().toString(),
      sender: 'Sistema',
      isMe: true, // para que no rebote
      role: 'SYSTEM',
      type: 'MATERIAL_SHARED',
      text: `El coach ha compartido un nuevo material: ${title}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      url,
      title
    };
    setMessages((prev) => [...prev, newMsg]);
    sendChatMessage(JSON.stringify({ type: 'MATERIAL_SHARED', url, title, text: newMsg.text }));
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const isCoach = perspective === 'COACH';
    const senderName = isCoach ? 'Coach (Tú)' : 'Aprendiz (Tú)';

    const newMsg = {
      id: Date.now().toString(),
      sender: senderName,
      isMe: true,
      role: isCoach ? 'COACH' : 'STUDENT',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    sendChatMessage(inputText.trim());
    setInputText('');
  };

  const downloadNotes = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isCoachView = perspective === 'COACH';
  const tierConfig = TIER_FEATURES[coachTier] || TIER_FEATURES.ELITE;

  const {
    isRecording,
    transcript,
    isProcessingChunk,
    isSummarizing,
    summaryData,
    generateSummary
  } = useCopilot(
    localStream || null,
    remoteStream || null,
    bookingId !== 'demo' && bookingId !== '1' && bookingId !== '2' ? bookingId : null,
    tierConfig?.tools?.copilot || false
  );

  // Participant details
  const coachName = isCoachView
    ? (currentUser?.name || bookingData?.coach?.name || 'Coach')
    : (bookingData?.coach?.name || 'Valeria Mendoza');
  const studentName = isCoachView
    ? (bookingData?.student?.name || 'Aprendiz')
    : (currentUser?.name || 'Aprendiz');
  const sessionHeadline = bookingData?.notes || (isCoachView ? `Sesión de 60 min (${tierConfig.name})` : (bookingData?.coach?.headline || 'Sesión de 60 min en vivo'));
  const coachAvatar = isCoachView
    ? (currentUser?.avatarUrl || bookingData?.coach?.avatarUrl || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=1200&h=800&fit=crop')
    : (bookingData?.coach?.avatarUrl || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=1200&h=800&fit=crop');
  const studentAvatar = bookingData?.student?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=300&fit=crop';

  const mainStageTitle = !isSwappedView
    ? (isCoachView ? studentName : coachName)
    : (isCoachView ? 'Tú (Coach)' : 'Tú (Aprendiz)');
  const mainStageSubtitle = !isSwappedView
    ? (isCoachView ? 'Aprendiz en vivo' : tierConfig.name)
    : 'Tu cámara';
  const mainStageAvatar = !isSwappedView
    ? (isCoachView ? studentAvatar : coachAvatar)
    : (isCoachView ? coachAvatar : studentAvatar);

  const pipTitle = !isSwappedView
    ? (isCoachView ? 'Tú (Coach)' : 'Tú (Aprendiz)')
    : (isCoachView ? studentName : coachName);
  const pipAvatar = !isSwappedView
    ? (isCoachView ? coachAvatar : studentAvatar)
    : (isCoachView ? studentAvatar : coachAvatar);

  // Pantallas de guardia si la sesión aún no fue confirmada o si fue cancelada
  if (bookingData && bookingData.status === "REQUESTED") {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>
        <h2 className="text-2xl font-black mb-2">Solicitud pendiente de confirmación</h2>
        <p className="text-sm text-gray-400 max-w-md mb-6 leading-relaxed">
          {isCoachView
            ? `El aprendiz ${bookingData.student?.name || 'ha solicitado'} esta sesión. Debes aceptarla en tu Portal de Coach antes de ingresar a la sala.`
            : `Tu sesión con el Coach ${bookingData.coach?.name || ''} aún está en revisión. Te notificaremos en cuanto tu coach la confirme.`}
        </p>
        <Link
          href={isCoachView ? "/coach/dashboard#agenda" : "/dashboard"}
          className="px-6 py-3 rounded-2xl bg-cfh-light-green text-cfh-dark-green font-black text-sm hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20"
        >
          {isCoachView ? "Ir a mi Agenda de Coach" : "Volver a Mi Aprendizaje"}
        </Link>
      </div>
    );
  }

  if (bookingData && bookingData.status === "CANCELED") {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <PhoneOff className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black mb-2">Sesión cancelada</h2>
        <p className="text-sm text-gray-400 max-w-md mb-6 leading-relaxed">
          Esta sesión ha sido cancelada o no está disponible. Puedes agendar una nueva asesoría en otro horario disponible.
        </p>
        <Link
          href={isCoachView ? "/coach/dashboard" : "/dashboard"}
          className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all"
        >
          Volver al panel
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={roomContainerRef}
      className={`bg-[#0B0F17] text-white flex flex-col select-none transition-all duration-300 fixed inset-0 z-50 h-screen w-screen overflow-hidden ${
        isFullscreen ? 'z-[9999]' : ''
      }`}
    >
      {/* Top Header Bar */}
      <header className="px-4 sm:px-6 py-3 flex items-center justify-between border-b border-white/10 bg-[#10131a] z-10 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={() => setShowExitModal(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Volver al panel"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-bold text-sm sm:text-base text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                {sessionHeadline}
              </h1>
              {/* Badge de Plan del Coach */}
              <span
                className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${tierConfig.badgeBg} ${tierConfig.badgeText} border ${tierConfig.badgeBorder} ${tierConfig.glow} shrink-0`}
              >
                {tierConfig.name}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              <span className={`flex items-center gap-1.5 font-semibold ${
                connectionState === 'connected'
                  ? 'text-emerald-400'
                  : connectionState === 'connecting' || connectionState === 'reconnecting'
                  ? 'text-amber-400'
                  : remotePeer
                  ? 'text-emerald-400'
                  : 'text-blue-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  connectionState === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionState === 'connecting' || connectionState === 'reconnecting'
                    ? 'bg-amber-400 animate-ping'
                    : remotePeer
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-blue-400'
                }`}></span>
                {connectionState === 'connected'
                  ? 'En vivo (Conectado)'
                  : connectionState === 'connecting'
                  ? 'Conectando...'
                  : connectionState === 'reconnecting'
                  ? 'Reconectando...'
                  : remotePeer
                  ? 'Participante conectado'
                  : 'Sala Lista'}
              </span>
              <span>•</span>
              <span className="hidden sm:inline">•</span>
              <span className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-0.5 rounded-lg text-xs transition-all duration-300 ${
                secondsRemaining <= 30
                  ? 'bg-red-500/25 text-red-300 border-2 border-red-500/80 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.55)]'
                  : secondsRemaining <= 300
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                  : 'text-cfh-light-green bg-white/5'
              }`}>
                {secondsRemaining <= 30 ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                <span>
                  {Math.floor(secondsRemaining / 60).toString().padStart(2, '0')}:{(secondsRemaining % 60).toString().padStart(2, '0')} {secondsRemaining <= 30 ? '¡Finalizando!' : 'min restantes'}
                </span>
                {bookingData?.isFreeIntro && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ml-1 ${
                    secondsRemaining <= 30
                      ? 'bg-red-500/40 text-white'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    Prueba Gratis
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>


        {/* Center/Right: Role Badge & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Badge de Rol Exclusivo (Separado para Coach o Aprendiz) */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold">
            {isCoachView ? (
              <>
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span className="text-purple-300">Sala de Coach</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-emerald-300">Sala de Aprendiz</span>
              </>
            )}
          </div>

          {/* Botón Pantalla Completa */}
          <button
            onClick={toggleFullscreen}
            className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isFullscreen
                ? 'bg-cfh-light-green/20 border-cfh-light-green text-cfh-light-green'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300 hover:text-white'
            }`}
            title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla Completa'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                <span className="hidden xl:inline">Salir</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                <span className="hidden xl:inline">Pantalla Completa</span>
              </>
            )}
          </button>

          {/* Toggle Sidebar */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isSidebarOpen
                ? 'bg-cfh-dark-green border-cfh-light-green/40 text-white'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title={isSidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Botón Finalizar */}
          <button
            onClick={() => setShowExitModal(true)}
            className="bg-red-500/90 hover:bg-red-600 text-white font-bold py-1.5 px-3 sm:px-4 text-xs sm:text-sm rounded-xl transition-all shadow-md hover:shadow-red-500/20 cursor-pointer flex items-center gap-1.5"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Finalizar</span>
          </button>
        </div>
      </header>

      {/* Banner Flotante: Alerta de Espera de 30 minutos y Segunda Oportunidad */}
      {(bookingData?.isSecondChance || bookingData?.rescheduledFromId) && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-200 px-4 py-2 flex items-center gap-2 text-xs font-medium z-20">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{t('SessionRoom.second_chance_alert')}</span>
        </div>
      )}
      <div className="bg-blue-500/10 border-b border-blue-500/20 text-blue-200 px-4 py-1.5 flex items-center gap-2 text-xs z-20">
        <Bell className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span>{t('SessionRoom.coach_waiting_notice')}</span>
      </div>

      {/* Banner Flotante: Alerta de 30 Segundos o 5 Minutos Restantes */}
      {secondsRemaining <= 30 && secondsRemaining > 0 && !showPostSessionModal ? (
        <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between shadow-xl z-20 animate-pulse">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
            <AlertTriangle className="w-4 h-4 text-white animate-bounce" />
            <span>🚨 ¡Atención! Quedan {secondsRemaining} segundos para finalizar la llamada. La sesión terminará de inmediato.</span>
          </div>
          <span className="text-xs bg-black/30 font-extrabold px-2.5 py-0.5 rounded-md">
            00:{secondsRemaining.toString().padStart(2, '0')}
          </span>
        </div>
      ) : showFiveMinWarning && !warningDismissed ? (
        <div className="bg-amber-500/90 text-black px-4 py-2.5 flex items-center justify-between shadow-lg z-20 transition-all">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <Clock className="w-4 h-4 text-black animate-spin" />
            <span>⚠️ ¡Atención! Quedan 5 minutos para finalizar la llamada ({bookingData?.isFreeIntro ? 'Prueba gratuita de 15 min' : 'Sesión regular'}).</span>
          </div>
          <button
            onClick={() => {
              setShowFiveMinWarning(false);
              setWarningDismissed(true);
            }}
            className="text-xs bg-black/20 hover:bg-black/40 text-black font-extrabold px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      ) : null}

      {/* Modal de Tiempo Finalizado */}
      {isTimeUpModalOpen && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#161a24] border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-3xl flex items-center justify-center mx-auto border border-amber-500/20">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white">{t('SessionRoom.session_ended')}</h3>
              <p className="text-xs text-gray-400 mt-2">
                Se ha completado el límite establecido de <strong className="text-white">{sessionDurationMinutes} minutos</strong> {bookingData?.isFreeIntro ? 'de tu llamada de prueba' : 'de tu sesión'}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleImmediateSessionEnd()}
              className="w-full py-3.5 bg-cfh-light-green hover:bg-emerald-500 text-cfh-text font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Ir a la conclusión y evaluación
            </button>
          </div>
        </div>
      )}


      {/* Main Call Body Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Elemento de audio remoto para asegurar voz bidireccional en tiempo real */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Main Video Viewport */}
        <main className="flex-1 flex flex-col p-2 sm:p-4 min-w-0 relative justify-between overflow-hidden">
          {/* Main Video Box */}
          <div
            className={`flex-1 w-full bg-black rounded-2xl sm:rounded-3xl overflow-hidden relative border-2 transition-all duration-500 shadow-2xl flex items-center justify-center ${tierConfig.badgeBorder}`}
          >
            {/* Aviso Urgente de 30 Segundos Restantes (Rojo Intenso y Destacado) */}
            <AnimatePresence>
              {secondsRemaining <= 30 && secondsRemaining > 0 && !showPostSessionModal && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] sm:w-auto bg-[#260909]/95 border-2 border-red-500 rounded-2xl px-5 py-3.5 shadow-[0_10px_35px_rgba(239,68,68,0.6)] backdrop-blur-xl flex items-center gap-3.5 text-white"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/25 text-red-400 flex items-center justify-center shrink-0 border border-red-500/50 animate-pulse">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <div className="text-left flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-red-400">
                        🚨 ¡Últimos {secondsRemaining} segundos!
                      </span>
                      <span className="text-[10px] font-black uppercase bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                        Por finalizar
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-gray-200 mt-0.5 leading-snug">
                      La videollamada se cerrará de inmediato y te dirigirá a la <strong>evaluación del docente</strong>.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Aviso Flotante de 5 Minutos Restantes (En Escenario y Pantalla Completa) */}
            <AnimatePresence>
              {showFiveMinWarning && secondsRemaining > 30 && !warningDismissed && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] sm:w-auto bg-[#18150a]/95 border-2 border-amber-500/80 rounded-2xl px-4 py-3 shadow-[0_10px_35px_rgba(245,158,11,0.45)] backdrop-blur-xl flex items-center gap-3.5 text-white"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
                    <Clock className="w-5 h-5 animate-spin" />
                  </div>
                  <div className="text-left flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-amber-300">
                        ⚠️ Quedan 5 minutos para finalizar la llamada
                      </span>
                      <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                        {bookingData?.isFreeIntro ? 'Prueba 15 min' : 'Sesión'}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-gray-300 mt-0.5 leading-snug">
                      {bookingData?.isFreeIntro
                        ? 'Tu llamada de prueba gratuita de 15 minutos está por concluir. Aprovechen para resolver las dudas finales.'
                        : 'Tu sesión concluirá automáticamente en 5 minutos. Concluyan los puntos clave de la reunión.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFiveMinWarning(false);
                      setWarningDismissed(true);
                    }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                  >
                    Entendido
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 1. Transmisión de pantalla local activa */}
            {isScreenSharing ? (
              <div className="w-full h-full bg-[#080d14] relative flex items-center justify-center">
                <video
                  ref={screenShareVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-black"
                />
                <div className="absolute top-4 left-4 bg-black/85 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-cfh-light-green/40 text-white shadow-lg">
                  <MonitorUp className="w-4 h-4 text-cfh-light-green animate-pulse" />
                  <span>Estás compartiendo tu pantalla</span>
                  <button
                    onClick={stopScreenShare}
                    className="ml-2 px-2.5 py-1 bg-red-500/30 hover:bg-red-500/50 text-red-300 text-[11px] font-bold rounded-lg border border-red-500/40 transition-colors cursor-pointer"
                  >
                    Detener
                  </button>
                </div>
              </div>
            ) : remotePeer?.isScreenSharing && remoteStream ? (
              /* 2. Pantalla compartida remota recibida */
              <div className="w-full h-full bg-[#080d14] relative flex items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
                <div className="absolute top-4 left-4 bg-black/85 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-purple-500/40 text-white shadow-lg">
                  <MonitorUp className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span>{remotePeer.name} está compartiendo pantalla</span>
                </div>
              </div>
            ) : isSwappedView ? (
              /* 3. Vista invertida: Cámara propia en escenario principal */
              <div className="w-full h-full relative flex items-center justify-center bg-gray-950">
                {isVideoOff ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-24 h-24 rounded-full bg-cfh-dark-green text-white flex items-center justify-center text-3xl font-bold shadow-xl border-2 border-cfh-light-green">
                      {isCoachView ? 'C' : 'A'}
                    </div>
                    <p className="text-xs text-gray-400">Tu cámara está desactivada</p>
                  </div>
                ) : localStream ? (
                  <video
                    ref={userVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <img
                    src={mainStageAvatar}
                    alt={mainStageTitle}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute bottom-4 left-4 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-white/10 text-white">
                  <span>{mainStageTitle}</span>
                  {isMuted && <span className="text-red-400 text-[10px] font-bold">• Silenciado</span>}
                </div>
              </div>
            ) : remoteStream && !remotePeer?.isVideoOff ? (
              /* 4. Escenario principal por defecto con video remoto en vivo */
              <div className="w-full h-full relative flex items-center justify-center bg-black">
                <video
                  ref={(el) => {
                    remoteVideoRef.current = el;
                    if (el && remoteStream && el.srcObject !== remoteStream) {
                      el.srcObject = remoteStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Floating Info Overlay */}
                <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 border border-white/10 shadow-lg text-white">
                  <span>{mainStageTitle}</span>
                  <span className={`text-xs font-extrabold ${tierConfig.badgeText}`}>
                    ({mainStageSubtitle})
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {remotePeer?.isAudioMuted && (
                    <span className="flex items-center gap-1 text-red-400 text-xs font-semibold ml-1">
                      <MicOff className="w-3 h-3" /> Silenciado
                    </span>
                  )}
                </div>
              </div>
            ) : remotePeer?.isVideoOff && remoteStream ? (
              /* 5. Par conectado pero con su cámara apagada */
              <div className="w-full h-full relative flex flex-col items-center justify-center bg-gray-950 p-6 text-center">
                <img
                  src={mainStageAvatar}
                  alt={mainStageTitle}
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white/10 shadow-2xl mb-3"
                />
                <h4 className="text-base font-bold text-white">{mainStageTitle}</h4>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 justify-center">
                  <VideoOff className="w-3.5 h-3.5 text-gray-500" />
                  Cámara desactivada por el participante
                </p>
                <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 border border-white/10 shadow-lg text-white">
                  <span>{mainStageTitle}</span>
                  <span className={`text-xs font-extrabold ${tierConfig.badgeText}`}>
                    ({mainStageSubtitle})
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  {remotePeer?.isAudioMuted && (
                    <span className="flex items-center gap-1 text-red-400 text-xs font-semibold ml-1">
                      <MicOff className="w-3 h-3" /> Silenciado
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* 6. Esperando la entrada del participante / Estableciendo conexión WebRTC */
              <div className="w-full h-full relative flex flex-col items-center justify-center bg-gradient-to-b from-gray-950 via-[#0B0F17] to-gray-950 p-6 text-center">
                <div className="relative mb-5">
                  <img
                    src={mainStageAvatar}
                    alt={mainStageTitle}
                    className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white/15 shadow-2xl"
                  />
                  <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-[#10131a] border border-white/20">
                    <span className="flex h-3 w-3 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${remotePeer ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${remotePeer ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    </span>
                  </div>
                </div>

                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                  remotePeer
                    ? (remotePeer.isAdmitted || isCoachView
                        ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                        : 'bg-amber-500/20 border border-amber-400/40 text-amber-300')
                    : 'bg-white/5 border border-white/10 text-gray-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    remotePeer
                      ? (remotePeer.isAdmitted || isCoachView ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse')
                      : 'bg-amber-400 animate-pulse'
                  }`}></span>
                  {remotePeer
                    ? (remotePeer.isAdmitted || isCoachView
                        ? `¡${remotePeer.name || (isCoachView ? studentName : coachName)} está en llamada! Conectando audio y video...`
                        : `${remotePeer.name || studentName} está en sala de espera`)
                    : connectionState === 'connecting'
                    ? 'Estableciendo videollamada P2P encriptada...'
                    : `Esperando a que ${isCoachView ? studentName : coachName} se una...`}
                </div>

                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  {mainStageTitle}
                </h3>
                <p className="text-xs text-gray-400 max-w-sm mt-1">
                  {remotePeer
                    ? (remotePeer.isAdmitted || isCoachView
                        ? '¡Ambos participantes están conectados en la sala! Sincronizando transmisión en vivo.'
                        : 'El aprendiz está en la sala de espera. Haz clic en "Permitir Acceso" para iniciar la videollamada.')
                    : isCoachView
                    ? 'La sala privada está abierta y lista. En cuanto el aprendiz ingrese, podrás darle acceso a la videollamada.'
                    : 'Tu sesión privada con el coach está lista. Esperando a que el coach esté en línea.'}
                </p>

                <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500">
                  <Lock className="w-3.5 h-3.5 text-cfh-light-green" />
                  <span>Videollamada privada WebRTC protegida de extremo a extremo</span>
                </div>

                {/* Floating Info Overlay */}
                <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 border border-white/10 shadow-lg text-white">
                  <span>{mainStageTitle}</span>
                  <span className={`text-xs font-extrabold ${tierConfig.badgeText}`}>
                    ({mainStageSubtitle})
                  </span>
                  {remotePeer ? (
                    <>
                      <span className={`w-2 h-2 rounded-full ${remotePeer.isAdmitted || isCoachView ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`}></span>
                      <span className={`text-[10px] ${remotePeer.isAdmitted || isCoachView ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-normal'}`}>
                        {remotePeer.isAdmitted || isCoachView ? 'En llamada' : 'En sala de espera'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                      <span className="text-[10px] text-amber-300 font-normal">En espera</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Quick Fullscreen Button in Corner */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 left-4 p-2.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/10 transition-all shadow-md cursor-pointer hover:scale-105"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla Completa'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* PiP (Picture in Picture) Floating Box */}
            <div
              onClick={() => setIsSwappedView(!isSwappedView)}
              className="absolute top-4 right-4 w-32 sm:w-44 lg:w-52 aspect-video bg-gray-900 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl hover:border-cfh-light-green transition-all cursor-pointer group"
              title="Haz clic para intercambiar cámaras"
            >
              {!isSwappedView ? (
                /* PiP muestra la cámara propia */
                isVideoOff ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-cfh-dark-green text-white flex items-center justify-center text-sm sm:text-base font-bold">
                      {isCoachView ? 'C' : 'A'}
                    </div>
                  </div>
                ) : localStream ? (
                  <video
                    ref={userVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <img
                    src={pipAvatar}
                    alt={pipTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                )
              ) : (
                /* PiP muestra el video remoto si está invertido */
                remoteStream && !remotePeer?.isVideoOff ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={pipAvatar}
                    alt={pipTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                )
              )}

              {/* PiP Label */}
              <div className="absolute bottom-1.5 left-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 text-white">
                {pipTitle}
                {isMuted && !isSwappedView && <MicOff className="w-2.5 h-2.5 text-red-400" />}
                {remotePeer?.isAudioMuted && isSwappedView && <MicOff className="w-2.5 h-2.5 text-red-400" />}
              </div>

              {/* Hover Swap Indicator */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[11px] font-bold text-white transition-opacity">
                Cambiar
              </div>
            </div>
          </div>

          {/* Floating Controls Bar */}
          <div className="mt-3 sm:mt-4 py-2 px-3 sm:px-5 bg-[#12141a]/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl flex items-center justify-center gap-2 sm:gap-4 w-fit mx-auto flex-wrap">
            {/* Micrófono */}
            <button
              onClick={toggleAudio}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
                isMuted
                  ? 'bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
              }`}
              title={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Cámara */}
            <button
              onClick={toggleVideo}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
                isVideoOff
                  ? 'bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
              }`}
              title={isVideoOff ? 'Activar cámara' : 'Apagar cámara'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {/* Compartir Pantalla */}
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
                isScreenSharing
                  ? 'bg-cfh-light-green text-cfh-dark-green font-bold shadow-cfh-light-green/30'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
              }`}
              title={isScreenSharing ? 'Dejar de compartir pantalla' : 'Compartir Pantalla'}
            >
              <MonitorUp className="w-5 h-5" />
            </button>

            {/* Accesos directos a herramientas para el Coach */}
            {isCoachView && (
              <>
                <div className="h-6 w-px bg-white/20 mx-1 hidden sm:block"></div>

                {/* Botón Pizarra Rápida */}
                <button
                  onClick={() => {
                    if (tierConfig.tools.whiteboard) {
                      setIsWhiteboardModalOpen(true);
                    } else {
                      setActiveTab('whiteboard');
                    }
                  }}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
                    tierConfig.tools.whiteboard
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30'
                      : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed opacity-60'
                  }`}
                  title={tierConfig.tools.whiteboard ? 'Abrir Pizarra Interactiva' : 'Pizarra (Requiere Plan Élite)'}
                >
                  <PenTool className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Botón Materiales */}
                <button
                  onClick={() => setIsResourcesModalOpen(true)}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 flex items-center justify-center transition-all shadow-md cursor-pointer"
                  title="Compartir Material Didáctico"
                >
                  <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Botón Seguimiento */}
                <button
                  onClick={() => {
                    if (tierConfig.tools.tracking) {
                      setIsTrackingModalOpen(true);
                    } else {
                      setActiveTab('tools');
                    }
                  }}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
                    tierConfig.tools.tracking
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30'
                      : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed opacity-60'
                  }`}
                  title={tierConfig.tools.tracking ? 'Seguimiento del Alumno' : 'Seguimiento (Requiere Plan Gold)'}
                >
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Botón Copiloto IA */}
                <button
                  onClick={() => {
                    if (tierConfig.tools.copilot) {
                      setIsCopilotModalOpen(true);
                    } else {
                      setActiveTab('tools');
                    }
                  }}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
                    tierConfig.tools.copilot
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30'
                      : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed opacity-60'
                  }`}
                  title={tierConfig.tools.copilot ? 'Copiloto IA' : 'Copiloto IA (Exclusivo Platinum)'}
                >
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <div className="h-6 w-px bg-white/20 mx-1 hidden sm:block"></div>
              </>
            )}

            {/* Pantalla Completa Botón */}
            <button
              onClick={toggleFullscreen}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
                isFullscreen
                  ? 'bg-cfh-light-green/20 text-cfh-light-green border border-cfh-light-green/40'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
              }`}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Hacer pantalla completa'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Toggle Panel Lateral */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer ${
                isSidebarOpen
                  ? 'bg-cfh-dark-green text-white border border-cfh-light-green/30'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
              }`}
              title={isSidebarOpen ? 'Ocultar panel lateral' : 'Abrir panel lateral'}
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Finalizar llamada */}
            <button
              onClick={() => setShowExitModal(true)}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/30 cursor-pointer"
              title="Finalizar llamada"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </main>

        {/* Right Collapsible Interactive Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="w-full lg:w-[380px] bg-[#10131a] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col h-[340px] lg:h-auto shrink-0 overflow-hidden relative"
            >
              {/* Sidebar Tabs */}
              <div className="flex border-b border-white/10 bg-[#0c0e14] overflow-x-auto custom-scrollbar shrink-0">
                {/* Chat Tab (Both) */}
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-3 px-3 text-xs font-bold text-center transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'chat'
                      ? 'text-white border-b-2 border-cfh-light-green bg-white/5'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat
                </button>

                {/* Coach-only: Tools Tab */}
                {isCoachView ? (
                  <button
                    onClick={() => setActiveTab('tools')}
                    className={`flex-1 py-3 px-3 text-xs font-bold text-center transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === 'tools'
                        ? 'text-white border-b-2 border-cfh-light-green bg-white/5'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Herramientas
                  </button>
                ) : null}

                {/* Whiteboard Tab (Both) */}
                <button
                  onClick={() => setActiveTab('whiteboard')}
                  className={`flex-1 py-3 px-3 text-xs font-bold text-center transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'whiteboard'
                      ? 'text-white border-b-2 border-cfh-light-green bg-white/5'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  Pizarra
                </button>

                {/* Notes Tab (Student notes or Coach assessment notes) */}
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex-1 py-3 px-3 text-xs font-bold text-center transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'notes'
                      ? 'text-white border-b-2 border-cfh-light-green bg-white/5'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {isCoachView ? 'Evaluación' : 'Notas'}
                </button>
              </div>

              {/* Tab Content Container */}
              <div className="flex-1 overflow-hidden relative flex flex-col">
                {/* 1. CHAT TAB */}
                {activeTab === 'chat' && (
                  <div className="flex-1 flex flex-col h-full justify-between overflow-hidden">
                    {/* Chat Messages */}
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex flex-col gap-1 ${m.isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <span className="font-semibold">{m.sender}</span>
                            {m.role && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 font-bold">
                                {m.role}
                              </span>
                            )}
                            <span>•</span>
                            <span>{m.time}</span>
                          </div>
                          <div
                            className={`p-3 rounded-2xl text-xs sm:text-sm max-w-[85%] leading-relaxed ${
                              m.isMe
                                ? 'bg-cfh-dark-green text-white rounded-tr-xs shadow-md border border-cfh-light-green/30'
                                : 'bg-[#1a1f2c] text-gray-200 rounded-tl-xs border border-white/5'
                            }`}
                          >
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Chat Input */}
                    <form
                      onSubmit={handleSendMessage}
                      className="p-3 border-t border-white/10 bg-[#0d1017] flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={
                          isCoachView
                            ? `Mensaje para ${studentName}...`
                            : 'Escribe un mensaje en vivo...'
                        }
                        className="flex-1 bg-[#1a1f2c] border border-white/10 rounded-xl py-2.5 px-3.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cfh-light-green placeholder-gray-500"
                      />
                      <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="p-2.5 rounded-xl bg-cfh-dark-green text-white hover:bg-cfh-dark-green/80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border border-cfh-light-green/40"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}

                {/* 2. COACH TOOLS TAB */}
                {activeTab === 'tools' && isCoachView && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                      {isRecording && (
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
                            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                            Copiloto IA escuchando...
                          </div>
                          <div className="text-[10px] text-indigo-400/80">
                            {transcript?.length || 0} chars
                          </div>
                        </div>
                      )}

                    {/* Header del Plan Actual */}
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-gray-400 font-medium">Plan Activo</div>
                        <div className={`text-sm font-bold ${tierConfig.badgeText}`}>{tierConfig.name}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${tierConfig.badgeBg} ${tierConfig.badgeText} border ${tierConfig.badgeBorder}`}>
                        {coachTier}
                      </span>
                    </div>

                    {/* Lista de Herramientas */}
                    <div className="space-y-2.5">
                      {/* 1. Pizarra Interactiva */}
                      <div className="p-3.5 rounded-2xl bg-[#141822] border border-white/5 hover:border-white/15 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                              <PenTool className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">Pizarra Interactiva</h4>
                              <p className="text-[10px] text-gray-400">Diagramas y esquemas en vivo</p>
                            </div>
                          </div>
                          {tierConfig.tools.whiteboard ? (
                            <button
                              onClick={() => setIsWhiteboardModalOpen(true)}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Abrir
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                              <Lock className="w-3 h-3" /> Élite+
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 2. Material Didáctico */}
                      <div className="p-3.5 rounded-2xl bg-[#141822] border border-white/5 hover:border-white/15 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                              <FolderOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">Material Didáctico</h4>
                              <p className="text-[10px] text-gray-400">Compartir guías, PDFs y recursos</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setIsResourcesModalOpen(true)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Gestionar
                          </button>
                        </div>
                      </div>

                      {/* 3. Seguimiento Analítico de Alumnos */}
                      <div className="p-3.5 rounded-2xl bg-[#141822] border border-white/5 hover:border-white/15 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">Seguimiento de Alumno</h4>
                              <p className="text-[10px] text-gray-400">Historial y progreso analítico</p>
                            </div>
                          </div>
                          {tierConfig.tools.tracking ? (
                            <button
                              onClick={() => setIsTrackingModalOpen(true)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Ver
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              <Lock className="w-3 h-3" /> Gold+
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 4. Copiloto IA */}
                      <div className="p-3.5 rounded-2xl bg-[#141822] border border-white/5 hover:border-white/15 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">Copiloto IA</h4>
                              <p className="text-[10px] text-gray-400">Resumen y plan de acción instantáneo</p>
                            </div>
                          </div>
                          {tierConfig.tools.copilot ? (
                            <button
                              onClick={() => setIsCopilotModalOpen(true)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Generar
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                              <Lock className="w-3 h-3" /> Platinum
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Resumen pedagógico */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cfh-dark-green/40 to-[#121622] border border-cfh-light-green/20">
                      <h4 className="text-xs font-bold text-cfh-light-green mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Consejo de Coaching
                      </h4>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        Dedica los últimos 5 minutos de la llamada a recapitular los acuerdos y tareas clave para que el aprendiz descargue sus notas con claridad.
                      </p>
                    </div>
                  </div>

                )}
                {/* 3. WHITEBOARD TAB */}
                {activeTab === 'whiteboard' && (
                  <div className="flex-1 flex flex-col h-full p-3 justify-between overflow-hidden">
                    {!tierConfig.tools.whiteboard ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#141822] rounded-2xl border border-white/5">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 border border-purple-500/20">
                          <Lock className="w-7 h-7" />
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1.5">Pizarra no disponible</h4>
                        <p className="text-xs text-gray-400 max-w-xs mb-4 leading-relaxed">
                          La pizarra interactiva colaborativa está disponible a partir del plan <strong>Élite</strong>, <strong>Gold</strong> y <strong>Platinum</strong>.
                        </p>
                        {isCoachView && (
                          <button
                            onClick={() => setCoachTier('ELITE')}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
                          >
                            Probar con Plan Élite
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col h-full justify-between gap-2 overflow-hidden">
                        {/* Canvas Toolbar */}
                        <div className="flex items-center justify-between bg-[#141822] p-2 rounded-xl border border-white/10 shrink-0">
                          <div className="flex items-center gap-1.5">
                            {['#1f2937', '#22c55e', '#3b82f6', '#ef4444', '#a855f7'].map((c) => (
                              <button
                                key={c}
                                onClick={() => {
                                  setDrawColor(c);
                                  setIsEraser(false);
                                }}
                                style={{ backgroundColor: c }}
                                className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                                  !isEraser && drawColor === c ? 'scale-125 border-white' : 'border-transparent'
                                }`}
                              />
                            ))}
                            <button
                              onClick={() => setIsEraser(!isEraser)}
                              className={`p-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                                isEraser ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'
                              }`}
                              title="Borrador"
                            >
                              Borrador
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={clearCanvas}
                              className="p-1 text-gray-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                              title="Limpiar pizarra"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setIsWhiteboardModalOpen(true)}
                              className="p-1 text-gray-400 hover:text-white rounded transition-colors cursor-pointer"
                              title="Expandir a pantalla completa"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Drawing Canvas Area */}
                        <div className="flex-1 bg-white rounded-xl overflow-hidden relative cursor-crosshair border border-white/10 shadow-inner">
                          <canvas
                            ref={canvasRef}
                            onMouseDown={startCanvasDrawing}
                            onMouseMove={drawOnCanvas}
                            onMouseUp={stopCanvasDrawing}
                            onMouseLeave={stopCanvasDrawing}
                            onTouchStart={startCanvasDrawing}
                            onTouchMove={drawOnCanvas}
                            onTouchEnd={stopCanvasDrawing}
                            className="w-full h-full block"
                          />
                        </div>

                        <div className="text-[10px] text-gray-400 text-center shrink-0">
                          Pizarra compartida en vivo ({tierConfig.name})
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. NOTES TAB */}
                {activeTab === 'notes' && (
                  <div className="flex-1 flex flex-col h-full p-4 justify-between overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-300">
                        {isCoachView ? 'Cuaderno Pedagógico del Coach' : 'Tus notas de aprendizaje'}
                      </span>
                      <div className="flex items-center gap-3">
                        {notesSavedIndicator && (
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 animate-pulse">
                            <CheckCircle2 className="w-3 h-3" />
                            Guardado
                          </span>
                        )}
                        <button
                          onClick={() =>
                            isCoachView
                              ? downloadNotes(coachNotes, `Evaluacion_${studentName}.md`)
                              : downloadNotes(studentNotes, `Notas_Sesion_${coachName}.md`)
                          }
                          className="flex items-center gap-1 text-[11px] font-bold text-cfh-light-green hover:underline cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Guardar .md
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={isCoachView ? coachNotes : studentNotes}
                      onChange={(e) =>
                        isCoachView ? handleUpdateCoachNotes(e.target.value) : handleUpdateStudentNotes(e.target.value)
                      }
                      className="flex-1 w-full bg-[#161a24] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-gray-200 focus:outline-none focus:border-cfh-light-green resize-none custom-scrollbar font-mono leading-relaxed"
                      placeholder={
                        isCoachView
                          ? 'Anota observaciones sobre el desempeño del alumno...'
                          : 'Escribe aquí tus apuntes durante la clase...'
                      }
                    />
                    <p className="text-[10px] text-gray-500 mt-2">
                      {isCoachView
                        ? 'Tus notas se guardan automáticamente en tu navegador.'
                        : 'Tus notas se respaldan automáticamente para que no se pierdan.'}
                    </p>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Modal de Admisión para el Coach cuando el aprendiz solicita unirse */}
      {isCoachView && remotePeer && !remotePeer.isAdmitted && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121622] border border-emerald-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400">
              <UserCheck className="w-8 h-8" />
            </div>
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-2">
              Solicitud de Ingreso a la Sala
            </span>
            <h3 className="text-xl font-extrabold text-white mb-2">
              {remotePeer.name || studentName} quiere unirse a la llamada
            </h3>
            <p className="text-xs text-gray-300 mb-6 leading-relaxed">
              El aprendiz se encuentra en la sala de espera aguardando tu autorización para comenzar la sesión de 60 min.
            </p>
            <button
              type="button"
              onClick={() => admitStudent(remotePeer.id)}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/25 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Permitir Acceso / Admitir</span>
            </button>
          </div>
        </div>
      )}

      {/* Pantalla de Sala de Espera para el Aprendiz antes de ser admitido */}
      {!isCoachView && !isAdmitted && !showPostSessionModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#0B0F17] text-white">
          <div className="bg-[#131722] border border-white/10 rounded-3xl p-6 sm:p-10 max-w-lg w-full text-center shadow-2xl relative">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5 text-emerald-400 shadow-inner">
              <div className="relative">
                <Video className="w-9 h-9" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Sala de espera activa
            </div>

            <h2 className="text-2xl font-black text-white mb-2">
              {studentName} quiere unirse a la llamada
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto mb-6 leading-relaxed">
              Has solicitado unirte a la sesión con <strong className="text-emerald-400">{coachName}</strong>.{' '}
              {remotePeer
                ? 'Tu coach ya está en la sala. Espera un momento mientras aprueba tu acceso.'
                : 'Esperando a que tu coach ingrese a la sala de videollamada. En cuanto se conecte, le aparecerá tu solicitud para admitirte.'}
            </p>

            {/* Vista previa local de cámara/micrófono del estudiante */}
            <div className="relative aspect-video w-full max-w-sm mx-auto bg-black rounded-2xl overflow-hidden border border-white/15 mb-6 shadow-md">
              {localStream && !isVideoOff ? (
                <video
                  ref={(el) => {
                    if (el && localStream && el.srcObject !== localStream) {
                      el.srcObject = localStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-400">
                  <div className="w-12 h-12 rounded-full bg-cfh-dark-green text-white flex items-center justify-center font-bold text-lg mb-2">
                    {studentName.charAt(0)}
                  </div>
                  <span className="text-xs">Cámara desactivada</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px]">
                <span>Tu vista previa</span>
                {isMuted && <span className="text-red-400 text-[10px] font-bold">• Silenciado</span>}
              </div>
            </div>

            {/* Controles de prueba en espera */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                type="button"
                onClick={toggleAudio}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-white/10 text-white border-white/10 hover:bg-white/15'
                }`}
                title={isMuted ? "Activar micrófono" : "Silenciar micrófono"}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={toggleVideo}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isVideoOff
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-white/10 text-white border-white/10 hover:bg-white/15'
                }`}
                title={isVideoOff ? "Activar cámara" : "Desactivar cámara"}
              >
                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[11px] text-gray-400 mb-4">
              En cuanto el coach te dé acceso, la llamada comenzará automáticamente.
            </p>

            <button
              type="button"
              onClick={() => {
                try { leaveCall(); } catch (e) {}
                window.location.href = '/dashboard';
              }}
              className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-white/5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Volver a Mi Aprendizaje</span>
            </button>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {viewingPdfUrl && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-md">
          <div className="bg-[#161a24] border border-white/10 rounded-2xl w-full max-w-5xl h-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden relative">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0b0f17]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-500" />
                Material de la Sesión
              </h3>
              <button
                onClick={() => setViewingPdfUrl(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 w-full bg-black relative" onContextMenu={(e) => e.preventDefault()}>
              <iframe 
                src={viewingPdfUrl} 
                className="w-full h-full border-none"
                title="Material de Sesión"
              />
              {/* Overlay to prevent right-click slightly if not native pdf */}
              <div className="absolute top-0 right-0 w-16 h-12 bg-transparent z-10" title="Descarga deshabilitada"></div>
            </div>
          </div>
        </div>
      )}

      {/* Report Problem Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161a24] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Reportar un problema</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Describe la falla técnica o mal comportamiento. Solo registramos esto como intermediarios; un administrador revisará el reporte.
            </p>
            <textarea 
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full h-24 bg-[#1a1f2c] border border-white/10 rounded-xl p-3 text-xs text-white resize-none mb-6 focus:border-amber-500 outline-none"
              placeholder="Detalla lo ocurrido..."
            />
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={!reportReason.trim() || isSubmittingReport}
                onClick={async () => {
                  if (bookingId && bookingId !== 'demo') {
                    setIsSubmittingReport(true);
                    try {
                      await reportSessionProblem(bookingId, reportReason);
                      alert('Reporte enviado correctamente.');
                      setShowReportModal(false);
                      setReportReason('');
                    } catch (err) {
                      alert('Error al enviar el reporte.');
                    } finally {
                      setIsSubmittingReport(false);
                    }
                  } else {
                    alert('No disponible en modo demo.');
                  }
                }}
                className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingReport ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Exit Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161a24] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <PhoneOff className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">¿Finalizar sesión?</h3>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Vas a concluir la videollamada con <strong>{isCoachView ? studentName : coachName}</strong>. La sesión se registrará como completada.
            </p>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                  }
                  leaveCall();
                  setShowExitModal(false);

                  // Marcar la sesión como completada en la BD con fallback seguro
                  if (bookingId && bookingId !== 'demo' && bookingId !== '1' && bookingId !== '2') {
                    try {
                      const res = await completeBookingSession(bookingId);
                      if (res?.success && res.booking) {
                        setCompletedBookingInfo(res.booking);
                      } else if (bookingData) {
                        setCompletedBookingInfo({
                          id: bookingData.id,
                          coachId: bookingData.coach?.id,
                          coachProfileId: bookingData.coach?.profileId || bookingData.coach?.id,
                          coachSlug: (bookingData.coach as any)?.slug || bookingData.coach?.id,
                          coachName: bookingData.coach?.name || "Coach",
                          studentId: bookingData.student?.id,
                          studentName: bookingData.student?.name || "Aprendiz",
                          isFreeIntro: bookingData.isFreeIntro,
                        });
                      }
                    } catch (e) {
                      console.error("Error al completar reserva:", e);
                      if (bookingData) {
                        setCompletedBookingInfo({
                          id: bookingData.id,
                          coachId: bookingData.coach?.id,
                          coachProfileId: bookingData.coach?.profileId || bookingData.coach?.id,
                          coachSlug: (bookingData.coach as any)?.slug || bookingData.coach?.id,
                          coachName: bookingData.coach?.name || "Coach",
                          studentId: bookingData.student?.id,
                          studentName: bookingData.student?.name || "Aprendiz",
                          isFreeIntro: bookingData.isFreeIntro,
                        });
                      }
                    }
                  } else if (bookingData) {
                    setCompletedBookingInfo({
                      id: bookingData.id || 'demo',
                      coachId: bookingData.coach?.id || 'coach-1',
                      coachProfileId: bookingData.coach?.profileId || bookingData.coach?.id || 'coach-1',
                      coachSlug: (bookingData.coach as any)?.slug || 'valeria-mendoza',
                      coachName: bookingData.coach?.name || "Coach",
                      studentId: bookingData.student?.id || 'student-1',
                      studentName: bookingData.student?.name || "Aprendiz",
                      isFreeIntro: bookingData.isFreeIntro,
                    });
                  }

                  // Desplegar modal post-sesión de evaluación
                  setPostSessionStep('review');
                  setShowPostSessionModal(true);
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Sí, finalizar sesión
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                Permanecer en la clase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Post-Sesión Oficial (Calificación, Reseña y Continuidad) */}
      {showPostSessionModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#161a24] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-left">
            {/* Botón de cierre para salir de forma segura al panel correspondiente */}
            <button
              type="button"
              onClick={() => {
                try { leaveCall(); } catch (e) {}
                window.location.href = isCoachView ? '/coach/dashboard' : '/dashboard';
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer z-10"
              title="Cerrar y salir al panel"
            >
              <X className="w-5 h-5" />
            </button>

            {isCoachView ? (
              /* VISTA POST SESIÓN PARA EL COACH */
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white">¡Sesión de 60 min Finalizada!</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Tu sesión con <strong className="text-white">{studentName}</strong> ha sido registrada como <span className="text-emerald-400 font-bold">Completada</span> en tu historial docente.
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Aprendiz:</span>
                    <span className="font-bold text-white">{studentName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Estado:</span>
                    <span className="font-bold text-emerald-400">Completada</span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Tus notas de evaluación:</span>
                    <button
                      type="button"
                      onClick={() => downloadNotes(coachNotes, `Evaluacion_${studentName}.md`)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-cfh-light-green hover:underline cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar .md
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    try { leaveCall(); } catch (e) {}
                    window.location.href = '/coach/dashboard';
                  }}
                  className="w-full py-3.5 bg-cfh-light-green hover:bg-emerald-500 text-cfh-text font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Volver a mi Agenda de Coach</span>
                </button>
              </div>
            ) : (
              /* VISTA POST SESIÓN PARA EL APRENDIZ */
              postSessionStep === 'review' ? (
                /* PASO 1: EVALUACIÓN Y CALIFICACIÓN */
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-3xl flex items-center justify-center mx-auto border border-amber-500/20">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-white">{t('SessionRoom.leave_rating')}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Califica tu experiencia con <strong className="text-white">{coachName}</strong> para apoyar su reputación y ayudar a otros alumnos.
                    </p>
                  </div>

                  {/* Selector de 5 estrellas interactivo y completamente fluido */}
                  <div className="py-2">
                    <div
                      className="flex items-center justify-center gap-2"
                      onMouseLeave={() => setHoveredRating(null)}
                    >
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFilled = hoveredRating !== null ? star <= hoveredRating : (reviewRating > 0 && star <= reviewRating);
                        return (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setHoveredRating(star)}
                            onClick={() => setReviewRating(star)}
                            className="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-white/5 cursor-pointer focus:outline-none transition-colors"
                          >
                            <Star
                              className={`w-8 h-8 transition-colors duration-150 ${
                                isFilled
                                  ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]'
                                  : 'text-gray-600 hover:text-gray-400'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="h-6 flex items-center justify-center mt-2">
                      <p className="text-xs font-bold text-amber-400 transition-opacity duration-150">
                        {(hoveredRating ?? reviewRating) === 0 && (
                          <span className="text-gray-500 font-normal">Toca las estrellas para calificar</span>
                        )}
                        {(hoveredRating ?? reviewRating) === 1 && "★☆☆☆☆ - Puede mejorar"}
                        {(hoveredRating ?? reviewRating) === 2 && "★★☆☆☆ - Regular"}
                        {(hoveredRating ?? reviewRating) === 3 && "★★★☆☆ - Buena clase"}
                        {(hoveredRating ?? reviewRating) === 4 && "★★★★☆ - Muy buena tutoría"}
                        {(hoveredRating ?? reviewRating) === 5 && "★★★★★ - ¡Excelente tutoría!"}
                      </p>
                    </div>
                  </div>

                  {/* Comentario de reseña opcional */}
                  <div className="text-left">
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Comentario o reseña (opcional):
                    </label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="¿Qué fue lo que más te gustó o qué aprendiste en esta sesión?"
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-cfh-light-green resize-none placeholder-gray-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => downloadNotes(studentNotes, `Mis_Notas_Sesion_${coachName}.md`)}
                      className="inline-flex items-center gap-1.5 text-cfh-light-green hover:underline cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar mis notas (.md)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostSessionStep('continuity')}
                      className="text-gray-400 hover:text-gray-300 cursor-pointer"
                    >
                      Omitir calificación
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isSubmittingReview || reviewRating === 0}
                    onClick={async () => {
                      if (reviewRating === 0) return;
                      setIsSubmittingReview(true);
                      if (bookingId && bookingId !== 'demo' && bookingId !== '1' && bookingId !== '2') {
                        try {
                          await submitBookingReview(bookingId, reviewRating, reviewComment);
                        } catch (e) {
                          console.error("Error al enviar reseña:", e);
                        }
                      }
                      setIsSubmittingReview(false);
                      setPostSessionStep('continuity');
                    }}
                    className="w-full py-3.5 bg-cfh-light-green hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-cfh-text font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{isSubmittingReview ? "Guardando reseña..." : "Enviar calificación y continuar"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* PASO 2: CONTINUIDAD Y PAGO DE CURSO O CLASES REGULARES */
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-white">¿Deseas continuar aprendiendo?</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      Continúa fortaleciendo tus habilidades con <strong className="text-white">{coachName}</strong> agendando tu próxima clase regular o inscribiéndote en sus cursos.
                    </p>
                  </div>

                  {/* Tarjeta del Coach */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left flex items-center gap-4">
                    <img
                      src={coachAvatar}
                      alt={coachName}
                      className="w-14 h-14 rounded-full object-cover border border-white/20 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{coachName}</h4>
                      <p className="text-xs text-gray-400 truncate">{sessionHeadline}</p>
                      <span className="inline-block text-[11px] font-bold text-cfh-light-green mt-1">
                        Mentor verificado en Coaching From Home
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    {/* Botón Principal: Reservar próxima clase / Ver cursos del coach */}
                    <button
                      type="button"
                      onClick={() => {
                        try { leaveCall(); } catch (e) {}
                        const targetCoachId = completedBookingInfo?.coachSlug || completedBookingInfo?.coachProfileId || bookingData?.coach?.profileId || bookingData?.coach?.id || coachName;
                        window.location.href = `/coaches/${targetCoachId}?book=1`;
                      }}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-xl shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Agendar próxima clase / Ver cursos</span>
                    </button>

                    {/* Botón Secundario: Ir a Mi Aprendizaje */}
                    <button
                      type="button"
                      onClick={() => {
                        try { leaveCall(); } catch (e) {}
                        window.location.href = '/dashboard';
                      }}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                    >
                      Ir a Mi Aprendizaje
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* MODALES OFICIALES DE HERRAMIENTAS DE COACH */}
      <CoachWhiteboardModal
        isOpen={isWhiteboardModalOpen}
        onClose={() => setIsWhiteboardModalOpen(false)}
        tierName={tierConfig.name}
      />

      <CoachResourcesModal
        isOpen={isResourcesModalOpen}
        onClose={() => setIsResourcesModalOpen(false)}
        tierName={tierConfig.name}
      />

      <CoachStudentTrackingModal
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        tierName={tierConfig.name}
      />

      <CoachAiCopilotModal
          isOpen={isCopilotModalOpen}
          onClose={() => setIsCopilotModalOpen(false)}
          tierName={tierConfig.name}
          isSummarizing={isSummarizing}
          summaryData={summaryData}
          onGenerate={generateSummary}
          transcriptLength={transcript?.length || 0}
        />
    </div>
  );
}

export default function Session1on1Page() {
  return (
    <Suspense fallback={<div className="bg-[#0B0F17] w-screen h-screen flex items-center justify-center text-white text-sm font-bold">Cargando sala...</div>}>
      <Session1on1Content />
    </Suspense>
  );
}
