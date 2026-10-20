"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import PremiumFeatureLock from "@/components/PremiumFeatureLock";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Sparkles,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  Clock,
  Send,
  User,
  ArrowLeft,
} from "lucide-react";
import {
  getCoachAiBotConfig,
  saveCoachAiBotConfig,
  simulateCoachAiReply,
  CoachAiBotConfig,
  CoachProfileContext,
  FaqItem,
} from "@/app/actions/ai-bot";

const TONE_OPTIONS = [
  {
    id: "friendly",
    label: "Cercano y Amigable",
    desc: "Cálido, empático, motivador y accesible para cualquier alumno.",
  },
  {
    id: "professional",
    label: "Profesional y Directo",
    desc: "Formal, conciso, enfocado a metas claras y lenguaje corporativo.",
  },
  {
    id: "enthusiastic",
    label: "Entusiasta y Enérgico",
    desc: "Lleno de energía, enfocado en el alto rendimiento y superación.",
  },
  {
    id: "academic",
    label: "Académico y Metódico",
    desc: "Estructurado, orientado al rigor pedagógico y plan de estudio.",
  },
] as const;

export default function CoachAiBotPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Estados del Bot
  const [enabled, setEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [tone, setTone] = useState<"friendly" | "professional" | "enthusiastic" | "academic">("friendly");
  const [availabilityMode, setAvailabilityMode] = useState<"always" | "offline_only" | "disabled">("always");
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [profileContext, setProfileContext] = useState<CoachProfileContext | null>(null);

  // Simulador de Chat interactivo
  const [simulatedMessages, setSimulatedMessages] = useState<
    { sender: "bot" | "user"; text: string; isFallback?: boolean }[]
  >([]);
  const [simulatedInput, setSimulatedInput] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await getCoachAiBotConfig();
        if (!res.success) {
          if (res.needsOnboarding) {
            router.push("/coach/onboarding");
            return;
          }
          setNotification({ type: "error", message: res.error || "No se pudo cargar la configuración." });
          return;
        }

        if (res.profileContext) {
          setProfileContext(res.profileContext);
        }

        if (res.config) {
          setEnabled(res.config.enabled);
          setWelcomeMessage(res.config.welcomeMessage);
          setTone(res.config.tone);
          setAvailabilityMode(res.config.availabilityMode);
          setFaqs(res.config.faqs);

          // Inicializar simulación con el mensaje de bienvenida
          setSimulatedMessages([
            { sender: "bot", text: res.config.welcomeMessage },
          ]);
        }
      } catch (err: any) {
        setNotification({ type: "error", message: err?.message || "Error al conectar." });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const handleAddFaq = () => {
    if (faqs.length >= 10) {
      setNotification({ type: "error", message: "Puedes agregar un máximo de 10 preguntas frecuentes." });
      return;
    }
    const newFaq: FaqItem = {
      id: `faq-${Date.now()}`,
      question: "",
      answer: "",
    };
    setFaqs([...faqs, newFaq]);
  };

  const handleUpdateFaq = (index: number, field: "question" | "answer", val: string) => {
    const next = [...faqs];
    if (!next[index]) return;
    next[index] = { ...next[index], [field]: val };
    setFaqs(next);
  };

  const handleRemoveFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);

    // Validaciones
    if (welcomeMessage.trim().length < 5) {
      setNotification({ type: "error", message: "El mensaje de bienvenida debe tener al menos 5 caracteres." });
      setSaving(false);
      return;
    }

    for (let i = 0; i < faqs.length; i++) {
      const f = faqs[i];
      if (!f || !f.question.trim() || !f.answer.trim()) {
        setNotification({
          type: "error",
          message: `La FAQ #${i + 1} tiene campos vacíos. Completa la pregunta y respuesta.`,
        });
        setSaving(false);
        return;
      }
    }

    try {
      const res = await saveCoachAiBotConfig({
        enabled,
        welcomeMessage: welcomeMessage.trim(),
        tone,
        availabilityMode,
        faqs: faqs.map((f) => ({
          id: f.id,
          question: f.question.trim(),
          answer: f.answer.trim(),
        })),
      });

      if (res.success) {
        setNotification({ type: "success", message: "¡Configuración del Asistente Virtual guardada exitosamente!" });
        setTimeout(() => setNotification(null), 4000);
      } else {
        setNotification({ type: "error", message: res.error || "No se pudo guardar la configuración." });
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err?.message || "Error al guardar." });
    } finally {
      setSaving(false);
    }
  };

  // Enviar mensaje en el simulador usando RAG en tiempo real
  const handleSendSimulated = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = simulatedInput.trim();
    if (!query) return;

    const newMsgs = [...simulatedMessages, { sender: "user" as const, text: query }];
    setSimulatedMessages(newMsgs);
    setSimulatedInput("");

    try {
      const res = await simulateCoachAiReply({ incomingText: query, overrideTone: tone });
      if (res.success) {
        setSimulatedMessages((prev) => [
          ...prev,
          { sender: "bot", text: res.replyText, isFallback: res.isFallback },
        ]);
      } else {
        setSimulatedMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: res.replyText || "Esa información no la tengo a la mano, pero ya le dejé la pregunta notificada al Coach para que te responda directamente por este chat.",
            isFallback: true,
          },
        ]);
      }
    } catch {
      setSimulatedMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Esa información no la tengo a la mano, pero ya le dejé la pregunta notificada al Coach para que te responda directamente por este chat.",
          isFallback: true,
        },
      ]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cfh-bg dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-500 dark:text-slate-400">Cargando Asistente Virtual...</p>
        </div>
      </div>
    );
  }

  return (
    <PremiumFeatureLock 
      feature="hasAiCopilot" 
      title="Copiloto de Inteligencia Artificial" 
      description="Tu plan actual no incluye el Copiloto IA. Mejora al Plan Élite para entrenar a tu propio bot y dejar que responda dudas frecuentes de tus alumnos 24/7."
    >
      <div className="min-h-screen bg-cfh-bg dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Breadcrumb & Volver */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/coach/dashboard"
                className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md">
                    Innovación IA
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">•</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Panel del Coach</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2 mt-0.5">
                  <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  Asistente Virtual IA & Auto-responder
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-black bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{saving ? "Guardando..." : "Guardar Asistente"}</span>
              </button>
            </div>
          </div>

          {/* Notificaciones flotantes / Banner */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm ${
                  notification.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                }`}
              >
                {notification.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span className="flex-1">{notification.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

        {/* Contenedor Principal: 2 Columnas (Configuración y Simulador en Vivo) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Formulario de Configuración (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Tarjeta 1: Estado y Disponibilidad del Bot */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-800 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Estado y Disponibilidad
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                    Decide cuándo debe activarse tu asistente para responder a los alumnos
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Selector de Modo de Disponibilidad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAvailabilityMode("always")}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    availabilityMode === "always"
                      ? "border-purple-600 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 shadow-xs"
                      : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Siempre Activo</span>
                    <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Responde al instante preguntas frecuentes en cualquier momento (24/7).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAvailabilityMode("offline_only")}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    availabilityMode === "offline_only"
                      ? "border-purple-600 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 shadow-xs"
                      : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Solo Fuera de Horario</span>
                    <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Se activa únicamente en tus horas no disponibles o durante clases activas.
                  </p>
                </button>
              </div>
            </div>

            {/* Tarjeta 2: Mensaje de Bienvenida y Tono de Voz */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-800 space-y-5">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Mensaje de Bienvenida
                </h2>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  El primer mensaje automático que verá el alumno al abrir el chat contigo
                </p>
              </div>

              <div>
                <textarea
                  rows={3}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="Ej: ¡Hola! Soy el asistente virtual de Coach. Cuéntame qué metas quieres alcanzar..."
                  className="w-full p-4 text-sm rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
                />
                <div className="flex justify-between items-center text-xs sm:text-sm text-gray-400 dark:text-slate-400 mt-1">
                  <span>Recomendación: Sé cálido y menciona tu especialidad.</span>
                  <span>{welcomeMessage.length}/500</span>
                </div>
              </div>

              {/* Tono de Respuesta */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-2">
                  Tono de Comunicación del Bot
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TONE_OPTIONS.map((t) => {
                    const isSelected = tone === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTone(t.id);
                          if (simulatedMessages.length <= 1) {
                            const toneGreetings: Record<string, string> = {
                              friendly: `¡Hola! Soy el Asistente Virtual de tu Coach. Estoy aquí para resolver tus dudas sobre horarios, tarifas y acompañarte en tus metas. ¿Qué te gustaría consultar?`,
                              professional: `Estimado(a) alumno(a), soy el Asistente del Coach. Quedo a su disposición para coordinar detalles sobre disponibilidad horaria, tarifas y metodología. ¿En qué puedo orientarle?`,
                              enthusiastic: `¡Hola! ¡Qué gran energía! Soy el Asistente Virtual de tu Coach y estoy listo para acompañarte a acelerar tu éxito. ¿Arrancamos revisando horarios o precios?`,
                              academic: `Saludos cordiales. Asistente pedagógico del docente a su disposición para orientarle respecto al cronograma lectivo, aranceles y metodología didáctica. ¿Cuál es su consulta?`,
                            };
                            setSimulatedMessages([{ sender: "bot", text: toneGreetings[t.id] || welcomeMessage }]);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                          isSelected
                            ? "border-purple-600 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 shadow-xs ring-2 ring-purple-600/10"
                            : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/80"
                        }`}
                      >
                        <span className="text-xs font-bold text-gray-900 dark:text-white block mb-0.5">{t.label}</span>
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 leading-tight block">{t.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tarjeta 3: Preguntas Frecuentes (FAQ / Auto-responder) */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-800 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Preguntas Frecuentes (FAQ) & Respuestas Rápidas
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                    Cuando un alumno pregunte algo similar, el bot contestará con estas respuestas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddFaq}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar FAQ</span>
                </button>
              </div>

              {faqs.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">No has configurado preguntas frecuentes todavía.</p>
                  <button
                    type="button"
                    onClick={handleAddFaq}
                    className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors"
                  >
                    Agregar primera FAQ
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {faqs.map((faq, index) => (
                    <div
                      key={faq.id}
                      className="p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                          FAQ #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFaq(index)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Eliminar FAQ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-300 mb-1">
                          Pregunta esperada del alumno:
                        </label>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => handleUpdateFaq(index, "question", e.target.value)}
                          placeholder="Ej: ¿Qué material necesito para la primera clase?"
                          className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-300 mb-1">
                          Respuesta automática que dará el bot:
                        </label>
                        <textarea
                          rows={2}
                          value={faq.answer}
                          onChange={(e) => handleUpdateFaq(index, "answer", e.target.value)}
                          placeholder="Ej: Solo necesitas tu computadora con micrófono, cámara y muchas ganas de aprender."
                          className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Simulador de Chat Interactivo (5 cols) */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col h-[640px]">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Simulador de Chat</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        En vivo
                      </span>
                      <span className="text-xs bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-200/80 dark:border-purple-800">
                        {TONE_OPTIONS.find((t) => t.id === tone)?.label}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSimulatedMessages([
                      { sender: "bot", text: welcomeMessage || "¡Hola! ¿En qué puedo ayudarte?" },
                    ])
                  }
                  className="text-xs sm:text-sm font-bold text-gray-400 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Reiniciar
                </button>
              </div>

              {/* Banner de Sincronización RAG del Perfil */}
              {profileContext && (
                <div className="mb-3 p-2.5 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800 rounded-2xl text-xs sm:text-sm text-purple-950 dark:text-purple-200 flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    Perfil conectado en vivo (RAG): {profileContext.hourlyRate}
                  </span>
                  <span className="text-xs bg-purple-200/60 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-full font-bold">
                    Sincronizado
                  </span>
                </div>
              )}

              {/* Mensajes del Simulador */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {simulatedMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 ${
                      msg.sender === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        msg.sender === "user"
                          ? "bg-cfh-dark-green text-white"
                          : "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                      }`}
                    >
                      {msg.sender === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl ${
                        msg.sender === "user"
                          ? "bg-cfh-dark-green text-white rounded-tr-xs"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-100 rounded-tl-xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      {msg.isFallback && (
                        <div className="mt-2 pt-1.5 border-t border-amber-200/80 dark:border-amber-700/80 flex items-center gap-1 text-[10.5px] font-bold text-amber-900 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/40 px-2 py-1 rounded-md border border-amber-300 dark:border-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          [Pendiente de respuesta humana / Derivado de Bot]
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Preguntas sugeridas de prueba de perfil */}
              <div className="pt-2 pb-2 border-t border-gray-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimulatedInput("¿Cuáles son tus horarios?")}
                  className="text-xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-2 py-1 rounded-lg font-bold transition-colors"
                >
                  📅 Horarios
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedInput("¿Cuánto cobras por sesión?")}
                  className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2 py-1 rounded-lg font-bold transition-colors"
                >
                  💰 Precios
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedInput("¿Ofreces clase de prueba gratis?")}
                  className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2 py-1 rounded-lg font-bold transition-colors"
                >
                  🎁 Prueba gratis
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedInput("¿Cuál es tu experiencia y metodología?")}
                  className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2 py-1 rounded-lg font-bold transition-colors"
                >
                  🎓 Bio
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedInput("¿Haces asesoría presencial en mi empresa?")}
                  className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-2 py-1 rounded-lg font-bold transition-colors"
                  title="Prueba de Zero-Hallucination Fallback"
                >
                  ❓ Fuera de contexto
                </button>
              </div>

              {/* Input del simulador */}
              <form onSubmit={handleSendSimulated} className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={simulatedInput}
                  onChange={(e) => setSimulatedInput(e.target.value)}
                  placeholder="Escribe como si fueras un alumno..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-600"
                />
                <button
                  type="submit"
                  className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PremiumFeatureLock>
  );
}


