"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { findContactData, contactMessage } from "@/lib/chat";
import { useTranslation } from "@/components/TranslationProvider";
import AutoTranslate from "@/components/AutoTranslate";
import { getPusherClient } from "@/lib/pusher-client";
import { Calendar, AlertTriangle, X, ShieldAlert, Check, CheckCheck } from "lucide-react";

export interface ConversationItem {
  id: string;
  studentId: string;
  coachId: string;
  lastMessageAt: string;
  createdAt: string;
  otherUser: {
    id: string;
    name: string;
    avatarUrl: string | null;
    headline: string;
  };
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  readAt?: string | null;
  sender?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export default function MessagesClient({ currentUserId, activeRole = "STUDENT" }: { currentUserId: string; activeRole?: string }) {
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  const cookieRole = isMounted && typeof document !== "undefined"
    ? document.cookie.split("; ").find((r) => r.startsWith("cfh_active_role="))?.split("=")[1]
    : null;
  const effectiveActiveRole = cookieRole || activeRole;

  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const initialConvId = searchParams?.get("conversationId") || null;

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConvId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const notifyTyping = useCallback(() => {
    if (!selectedConversationId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      fetch(`/api/conversations/${selectedConversationId}/typing`, {
        method: "POST",
      }).catch(() => {});
    }
  }, [selectedConversationId]);

  const chatFeedRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTo({
        top: chatFeedRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  const renderHeadline = (headline: string) => {
    if (!headline) return "";
    const lower = headline.trim().toLowerCase();
    if (lower === "estudiante" || lower === "aprendiz" || lower === "student" || lower === "alumno") {
      return t("Profile.student_role", "Aprendiz");
    }
    if (lower === "coach") {
      return t("Profile.coach_role", "Coach");
    }
    return <AutoTranslate text={headline} fallback={headline} />;
  };

  // 1. Fetch conversations list
  const fetchConversations = async (isBackground = false) => {
    if (!isBackground) setLoadingList(true);
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        const list = data.conversations || [];
        setConversations(list);

        // Auto-select first conversation if none selected
        if (!selectedConversationId && list.length > 0) {
          setSelectedConversationId(list[0].id);
        }
      }
    } catch (err) {
      console.error("Error cargando conversaciones:", err);
    } finally {
      if (!isBackground) setLoadingList(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    fetchConversations();
  }, []);

  // 2. Real-Time Listener: User channel for conversation list updates & reordering
  useEffect(() => {
    if (!currentUserId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const userChannelName = `user-${currentUserId}`;
    const userChannel = pusher.subscribe(userChannelName);

    userChannel.bind("conversation-updated", (data: { conversationId: string; lastMessage: any; lastMessageAt: string }) => {
      setConversations((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === data.conversationId);
        if (existingIdx === -1) {
          // New conversation appeared, fetch to get full otherUser metadata
          fetchConversations(true);
          return prev;
        }

        const updated = [...prev];
        const target = updated[existingIdx];
        if (!target) return prev;

        const updatedItem: ConversationItem = {
          ...target,
          lastMessage: data.lastMessage,
          lastMessageAt: data.lastMessageAt || new Date().toISOString(),
        };

        // Move active conversation to top of list
        updated.splice(existingIdx, 1);
        return [updatedItem, ...updated];
      });
    });

    return () => {
      userChannel.unbind_all();
      pusher.unsubscribe(userChannelName);
    };
  }, [currentUserId]);

  // Función para sincronizar la lectura de notificaciones con la campana
  const markConversationRead = useCallback(async (convId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId }),
      });
      window.dispatchEvent(new Event("refresh-notifications"));
    } catch {
      // Ignorar errores de red en segundo plano
    }
  }, []);

  // 3. Fetch messages for active conversation
  const fetchMessages = useCallback(async (convId: string, isBackground = false) => {
    if (!isBackground) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const incoming: ChatMessage[] = data.messages || [];
        setMessages((prev) => {
          // Si no hay cambios, no mutar para evitar re-renderizados innecesarios
          if (
            prev.length === incoming.length &&
            prev[prev.length - 1]?.id === incoming[incoming.length - 1]?.id
          ) {
            return prev;
          }
          // Si llegaron mensajes nuevos, scroll suave al fondo
          if (incoming.length > prev.length) {
            setTimeout(() => scrollToBottom(isBackground ? "smooth" : "auto"), 50);
          }
          return incoming;
        });
        // Notificar a la campana del header que los mensajes ya están leídos
        window.dispatchEvent(new Event("refresh-notifications"));
      }
    } catch (err) {
      if (!isBackground) console.error("Error cargando mensajes:", err);
    } finally {
      if (!isBackground) setLoadingMessages(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    if (selectedConversationId) {
      markConversationRead(selectedConversationId);
      fetchMessages(selectedConversationId, false);

      // Polling en segundo plano cada 2.5s para sincronizar mensajes en tiempo real
      const msgInterval = setInterval(() => {
        fetchMessages(selectedConversationId, true);
      }, 2500);

      return () => clearInterval(msgInterval);
    }
  }, [selectedConversationId, fetchMessages, markConversationRead]);

  // Polling de respaldo para actualizar la lista de chats cada 4s
  useEffect(() => {
    const convInterval = setInterval(() => {
      fetchConversations(true);
    }, 4000);

    return () => clearInterval(convInterval);
  }, []);

  // 4. Real-Time Listener: Conversation channel for instant new-message updates without polling
  useEffect(() => {
    if (!selectedConversationId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `conversation-${selectedConversationId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("new-message", (incoming: ChatMessage) => {
      setOtherUserTyping(null);
      setMessages((prev) => {
        // A. Prevent duplicate render if exact message ID already exists
        if (prev.some((m) => m.id === incoming.id)) {
          return prev;
        }

        // B. Reconcile temporary optimistic message from sender
        if (incoming.senderId === currentUserId) {
          const tempIdx = prev.findIndex(
            (m) => m.id.startsWith("temp-") && m.content === incoming.content
          );
          if (tempIdx !== -1) {
            const copy = [...prev];
            copy[tempIdx] = incoming;
            return copy;
          }
        }

        // C. Clean append for new incoming message
        return [...prev, incoming];
      });

      // Si el mensaje es recibido mientras tenemos la conversación abierta, marcar como leído de inmediato
      if (incoming.senderId !== currentUserId) {
        markConversationRead(selectedConversationId);
      }

      // Smooth auto-scroll upon receiving new message
      setTimeout(() => scrollToBottom("smooth"), 50);
    });

    // Evento de lectura en tiempo real (Doble check)
    channel.bind("messages-read", (data: { readBy: string; readAt: string }) => {
      if (data.readBy !== currentUserId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === currentUserId && !m.readAt
              ? { ...m, readAt: data.readAt }
              : m
          )
        );
      }
    });

    // Evento de usuario escribiendo
    channel.bind("user-typing", (data: { userId: string; userName: string }) => {
      if (data.userId !== currentUserId) {
        setOtherUserTyping(data.userName);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setOtherUserTyping(null);
        }, 3000);
      }
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [selectedConversationId, currentUserId, scrollToBottom, markConversationRead]);

  // 4. Send message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConversationId || isSending) return;

    const textToSend = inputText.trim();
    setPolicyError(null);

    // Client-side contact findings check
    const findings = findContactData(textToSend);
    if (findings.length > 0) {
      const labels: Record<string, string> = {
        email: "correo electrónico",
        phone: "números de teléfono (dígitos o escritos con palabras)",
        link: "enlaces externos",
        social: "redes sociales",
      };
      const violationDesc = findings.map((item) => labels[item] || item).join(", ");
      setPolicyError(
        `⛔ Acción no permitida: Está estrictamente prohibido compartir números de teléfono, correos o datos de contacto externos (${violationDesc}). Si vuelves a intentarlo, tu cuenta será suspendida automáticamente.`
      );
      return;
    }

    setIsSending(true);

    // Optimistic UI message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      content: textToSend,
      createdAt: new Date().toISOString(),
      senderId: currentUserId,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      const res = await fetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textToSend }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error) {
          setPolicyError(errData.error);
        }
        if (errData.isSuspended) {
          // Si el usuario alcanzó 2 strikes y fue suspendido, recargar para activar FullScreenSuspensionScreen
          setTimeout(() => window.location.reload(), 2000);
        }
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
        }
        fetchConversations(true);
      }
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
      setTimeout(() => scrollToBottom("smooth"), 100);
    }
  };

  const activeConversation = conversations.find((c) => c.id === selectedConversationId);

  const filteredConversations = conversations.filter((c) =>
    c.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.otherUser.headline.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-[1500px] mx-auto px-2 sm:px-4 md:px-6 py-2 md:py-3 h-[calc(100dvh-5.5rem)] min-h-[500px] flex flex-col justify-center">
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex flex-col md:flex-row h-full max-h-full">
        {/* Left Column: Conversations List */}
        <div className={`w-full md:w-80 lg:w-[400px] border-r border-gray-100 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 shrink-0 ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-slate-100 mb-5 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </span>
              {t("Messages.title", "Mensajes")}
            </h1>
            <div className="relative">
              <input
                type="text"
                placeholder={t("Messages.search_placeholder", "Buscar conversación...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-gray-900 dark:text-slate-100 transition-all placeholder-gray-400 dark:placeholder-slate-500"
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-3.5 text-gray-400 dark:text-slate-500"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="p-6 text-center text-sm font-medium text-gray-400 dark:text-slate-500">{t("Messages.loading_conversations", "Cargando conversaciones...")}</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <h4 className="font-bold text-base text-gray-900 dark:text-slate-100 mb-2">{t("Messages.no_messages_title", "Aún no hay mensajes")}</h4>
                
                {effectiveActiveRole === "STUDENT" ? (
                  <>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-[250px]">
                      {t("Messages.no_messages_desc", "Envía un mensaje a un coach desde su perfil para iniciar una charla.")}
                    </p>
                    <Link
                      href="/coaches"
                      className="px-6 py-3 bg-cfh-dark-green text-white text-sm font-bold rounded-full hover:bg-cfh-light-green shadow-md transition-colors"
                    >
                      {t("Messages.explore_coaches", "Explorar Coaches")}
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-slate-400 max-w-[250px]">
                    Cuando un estudiante se ponga en contacto contigo, su mensaje aparecerá aquí.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredConversations.map((conv) => {
                  const isSelected = conv.id === selectedConversationId;
                  const formattedTime = conv.lastMessage?.createdAt
                    ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "";

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversationId(conv.id)}
                      className={`w-full p-4 flex items-center gap-4 text-left transition-all rounded-2xl ${
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-transparent shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-900"
                          : "bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-850 border border-transparent"
                      }`}
                    >
                      <div className="relative shrink-0">
                        {conv.otherUser.avatarUrl ? (
                          <img
                            src={conv.otherUser.avatarUrl}
                            alt={conv.otherUser.name}
                            className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xl flex items-center justify-center">
                            {conv.otherUser.name.charAt(0)}
                          </div>
                        )}
                        <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <h3 className="font-bold text-base text-gray-900 dark:text-slate-100 truncate">
                            {conv.otherUser.name}
                          </h3>
                          {formattedTime && (
                            <span className="text-xs sm:text-sm text-gray-400 dark:text-slate-500 shrink-0 font-medium">
                              {formattedTime}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-semibold truncate mb-1 ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-slate-400'}`}>
                          {renderHeadline(conv.otherUser.headline)}
                        </p>
                        <p className={`text-sm truncate ${isSelected ? 'text-gray-700 dark:text-slate-300' : 'text-gray-500 dark:text-slate-400'}`}>
                          {conv.lastMessage?.content || t("Messages.start_conversation", "Inicia la conversación...")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Chat Area */}
        <div className={`flex-1 bg-[#F8FAFC] dark:bg-slate-950 flex flex-col relative ${!selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
          {activeConversation ? (
            <>
              {/* Chat Top Header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                  {/* Mobile Back Button */}
                  <button 
                    className="md:hidden p-2 -ml-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 bg-gray-50 dark:bg-slate-800 rounded-full"
                    onClick={() => setSelectedConversationId(null)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>

                  <div className="relative">
                    {activeConversation.otherUser.avatarUrl ? (
                      <img
                        src={activeConversation.otherUser.avatarUrl}
                        alt={activeConversation.otherUser.name}
                        className="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-lg">
                        {activeConversation.otherUser.name.charAt(0)}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                  </div>
                  <div>
                    <h2 className="font-extrabold text-lg text-gray-900 dark:text-slate-100 leading-tight">
                      {activeConversation.otherUser.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mt-0.5">{renderHeadline(activeConversation.otherUser.headline)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {effectiveActiveRole === "STUDENT" && activeConversation.otherUser && (
                    <Link
                      href={`/coaches/${activeConversation.otherUser.id}?book=true`}
                      className="text-xs font-extrabold text-white bg-cfh-dark-green hover:bg-[#061528] transition-all flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full shadow-sm cursor-pointer shrink-0"
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{t("Messages.book_session", "Agendar Sesión")}</span>
                    </Link>
                  )}
                  <Link
                    href={`/coaches/${activeConversation.otherUser.id}`}
                    className="text-xs font-bold text-cfh-dark-green dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full border border-gray-200 dark:border-slate-700 shadow-sm shrink-0"
                  >
                    <span className="hidden sm:inline">{t("Messages.view_profile", "Ver Perfil")}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  </Link>
                </div>
              </div>

              {/* Chat Messages Feed */}
              <div ref={chatFeedRef} className="flex-1 p-6 overflow-y-auto space-y-6">
                {loadingMessages ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-slate-500">
                    <span className="w-8 h-8 border-4 border-emerald-100 dark:border-slate-800 border-t-emerald-500 rounded-full animate-spin"></span>
                    <span className="text-sm font-medium">{t("Messages.loading_messages", "Cargando mensajes...")}</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 dark:text-slate-500">
                    <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-full shadow-sm flex items-center justify-center text-emerald-500 mb-5 border border-gray-100 dark:border-slate-800">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <h4 className="font-bold text-lg text-gray-900 dark:text-slate-100 mb-2">{t("Messages.start_chat_title", "¡Comienza la conversación!")}</h4>
                    <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm">
                      {t("Messages.start_chat_desc", "Escribe tu primer mensaje. Preséntate o haz preguntas sobre los horarios, temarios y metodología.")}
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.senderId === currentUserId;
                    const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    
                    // Add extra spacing between groups of messages from different senders
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isDifferentSender = prevMsg && prevMsg.senderId !== msg.senderId;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${isDifferentSender ? "mt-8" : "mt-2"}`}
                      >
                        <div
                          className={`max-w-[85%] md:max-w-md px-5 py-3.5 text-base leading-relaxed shadow-sm ${
                            isMe
                              ? "bg-cfh-dark-green text-white rounded-[24px] rounded-br-[4px]"
                              : "bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-100 dark:border-slate-700 rounded-[24px] rounded-bl-[4px]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <span className="text-xs sm:text-sm text-gray-400 dark:text-slate-500 font-medium mt-1.5 px-2 flex items-center gap-1.5">
                          {timeStr}
                          {isMe && (
                            msg.readAt ? (
                              <span title="Leído" className="text-emerald-500 dark:text-emerald-400 inline-flex items-center">
                                <CheckCheck className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span title="Enviado" className="text-gray-400 dark:text-slate-500 inline-flex items-center">
                                <Check className="w-3.5 h-3.5" />
                              </span>
                            )
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Indicador de "Escribiendo..." */}
              {otherUserTyping && (
                <div className="mx-6 mb-2 px-3.5 py-1.5 rounded-full bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 inline-flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 w-fit animate-in fade-in slide-in-from-bottom-1 shadow-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
                  </div>
                  <span className="font-semibold">{otherUserTyping} está escribiendo...</span>
                </div>
              )}

              {/* Warning Policy Notice (Estilo Comunidad / Strikes) */}
              {policyError && (
                <div className="mx-4 sm:mx-6 mb-3 p-3.5 sm:p-4 rounded-2xl bg-rose-50/95 dark:bg-rose-950/70 border-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100 flex items-start gap-3 shadow-md animate-in fade-in slide-in-from-bottom-2">
                  <div className="w-8 h-8 rounded-full bg-rose-500/20 dark:bg-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs sm:text-sm uppercase tracking-wide text-rose-700 dark:text-rose-300">
                        Aviso de Seguridad de la Plataforma
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-200/70 dark:bg-rose-900/60 text-[10px] font-black text-rose-800 dark:text-rose-200 uppercase">
                        Acción Prohibida
                      </span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm font-medium leading-relaxed text-rose-800 dark:text-rose-200">
                      {policyError}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPolicyError(null)}
                    className="p-1 rounded-lg text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer shrink-0"
                    title="Cerrar advertencia"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 z-10">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder={t("Messages.type_message_placeholder", "Escribe un mensaje...")}
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      if (policyError) setPolicyError(null);
                      notifyTyping();
                    }}
                    className="w-full pl-6 pr-16 py-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full text-base text-gray-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-cfh-dark-green dark:focus:border-cfh-light-green focus:ring-4 focus:ring-cfh-dark-green/10 transition-all placeholder-gray-400 dark:placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="absolute right-2 top-2 bottom-2 aspect-square bg-cfh-dark-green hover:bg-cfh-light-green disabled:opacity-50 disabled:hover:bg-cfh-dark-green text-white rounded-full transition-all flex items-center justify-center shadow-md cursor-pointer"
                  >
                    {isSending ? (
                      <span className="w-5 h-5 border-[2.5px] border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 dark:bg-slate-950">
              <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-slate-800 flex items-center justify-center text-emerald-500 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <h3 className="font-extrabold text-2xl text-gray-900 dark:text-slate-100 mb-3">{t("Messages.your_messages", "Tus Mensajes")}</h3>
              <p className="text-base text-gray-500 dark:text-slate-400 max-w-[320px] leading-relaxed">
                {t("Messages.select_conversation_desc", "Selecciona una conversación de la columna izquierda para leer y responder mensajes en tiempo real.")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
