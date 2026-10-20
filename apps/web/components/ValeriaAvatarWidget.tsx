"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from './TranslationProvider';
import { MessageCircle, Send, X, RotateCcw, ArrowRight, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface MessageAction {
  label: string;
  href: string;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
  actions?: MessageAction[];
}

export default function ValeriaAvatarWidget() {
  const { t, locale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Inicializar mensajes y sugerencias con traducciones reactivas
  useEffect(() => {
    const welcomeText = t(
      'Valeria.welcome',
      '¡Hola! Soy Valeria, tu asesora virtual de Coaching from Home ✨ ¿En qué área profesional o habilidad te gustaría enfocarte hoy?'
    );

    setMessages([
      {
        role: 'assistant',
        text: welcomeText,
        actions: [
          { label: t('Valeria.quick_find_coach', 'Buscar un coach'), href: '/coaches' },
          { label: t('Valeria.quick_courses', 'Cursos disponibles'), href: '/cursos' }
        ]
      }
    ]);

    setSuggestions([
      t('Valeria.quick_how_it_works', '¿Cómo funciona?'),
      t('Valeria.quick_find_coach', 'Buscar un coach'),
      t('Valeria.quick_free_trial', 'Prueba gratis 15 min'),
      t('Valeria.quick_courses', 'Cursos disponibles')
    ]);
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isListening]);

  // Fallback local en caso de desconexión o falla de red
  const simulateResponse = (userQuery: string): { reply: string; actions?: MessageAction[]; suggestions?: string[] } => {
    const q = userQuery.toLowerCase();
    if (q.includes('cómo funciona') || q.includes('como funciona') || q.includes('how it works')) {
      return {
        reply: '¡Es muy sencillo! Puedes explorar nuestro directorio de coaches certificados, agendar una sesión de 60 min en vivo (incluso con una prueba gratuita de 15 min), o inscribirte en cursos digitales creados por expertos.',
        actions: [
          { label: 'Buscar Coaches', href: '/coaches' },
          { label: 'Ver Cursos', href: '/cursos' }
        ],
        suggestions: ['Prueba gratis 15 min', 'Tarifas de coaches', '¿Cómo pagar?']
      };
    }
    if (q.includes('coach') || q.includes('mentor') || q.includes('carrera')) {
      return {
        reply: '¡Contamos con coaches especializados en Tecnología, Negocios, Idiomas y Liderazgo! Puedes visitar la sección de Coaches para filtrar por especialidad, ver sus videos de presentación y agendar.',
        actions: [{ label: 'Directorio de Coaches', href: '/coaches' }],
        suggestions: ['Prueba gratis 15 min', '¿Cómo agendar?', 'Cursos disponibles']
      };
    }
    if (q.includes('curso') || q.includes('aprender') || q.includes('course')) {
      return {
        reply: 'En la pestaña Cursos encontrarás formación completa y práctica con acceso de por vida, materiales descargables en PDF y certificados de finalización.',
        actions: [{ label: 'Explorar Cursos', href: '/cursos' }],
        suggestions: ['¿Tienen certificados?', 'Ver coaches', 'Prueba gratis 15 min']
      };
    }
    if (q.includes('precio') || q.includes('costo') || q.includes('tarifa') || q.includes('price')) {
      return {
        reply: 'Cada coach define su tarifa por hora de manera transparente. Además, muchos coaches ofrecen su primera sesión de 15 minutos completamente gratis para conocer tus objetivos.',
        actions: [{ label: 'Ver Tarifas', href: '/coaches' }],
        suggestions: ['Prueba gratis 15 min', 'Ver cursos', '¿Cómo funciona?']
      };
    }
    return {
      reply: '¡Excelente pregunta! En Coaching from Home puedes conectar con coaches certificados en sesiones 1 a 1 en vivo o capacitarte con nuestros cursos digitales con certificado. ¿Te gustaría buscar un coach o ver nuestros cursos?',
      actions: [
        { label: 'Explorar Coaches', href: '/coaches' },
        { label: 'Ver Cursos', href: '/cursos' }
      ],
      suggestions: ['¿Cómo funciona?', 'Buscar un coach', 'Prueba gratis 15 min']
    };
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isListening) return;

    const userMessage: ChatMessage = { role: 'user', text: query };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setIsListening(true);

    try {
      const response = await fetch('/api/valeria/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: updatedMessages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          locale: locale || 'es'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          text: data.reply || 'Estoy aquí para ayudarte en Coaching from Home.',
          actions: data.actions || []
        };
        setMessages([...updatedMessages, assistantMessage]);
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        }
        setIsListening(false);
        return;
      }
    } catch {
      // Si la llamada fetch falla, recurrir al simulador con setTimeout
    }

    // Fallback con simulación client-side
    setTimeout(() => {
      const result = simulateResponse(query);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        text: result.reply,
        actions: result.actions
      };
      setMessages([...updatedMessages, assistantMessage]);
      if (result.suggestions) {
        setSuggestions(result.suggestions);
      }
      setIsListening(false);
    }, 700);
  };

  const handleClearChat = () => {
    const welcomeText = t(
      'Valeria.welcome',
      '¡Hola! Soy Valeria, tu asesora virtual de Coaching from Home ✨ ¿En qué área profesional o habilidad te gustaría enfocarte hoy?'
    );
    setMessages([
      {
        role: 'assistant',
        text: welcomeText,
        actions: [
          { label: t('Valeria.quick_find_coach', 'Buscar un coach'), href: '/coaches' },
          { label: t('Valeria.quick_courses', 'Cursos disponibles'), href: '/cursos' }
        ]
      }
    ]);
    setSuggestions([
      t('Valeria.quick_how_it_works', '¿Cómo funciona?'),
      t('Valeria.quick_find_coach', 'Buscar un coach'),
      t('Valeria.quick_free_trial', 'Prueba gratis 15 min'),
      t('Valeria.quick_courses', 'Cursos disponibles')
    ]);
  };

  // Renderizar texto con saltos de línea y negritas sencillas
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((paragraph, pIdx) => {
      if (!paragraph.trim()) {
        return <div key={pIdx} className="h-1.5" />;
      }

      // Procesar viñetas
      const isBullet = paragraph.trim().startsWith('• ') || paragraph.trim().startsWith('- ');
      const content = isBullet ? paragraph.trim().substring(2) : paragraph;

      // Reemplazar **negrita**
      const parts = content.split(/(\*\*[^*]+\*\*)/g);

      return (
        <div key={pIdx} className={isBullet ? 'flex gap-1.5 items-start my-0.5' : 'my-0.5'}>
          {isBullet && <span className="text-cfh-light-green font-bold select-none">•</span>}
          <span>
            {parts.map((part, idx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={idx} className="font-bold text-gray-900 dark:text-white">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={idx}>{part}</span>;
            })}
          </span>
        </div>
      );
    });
  };

  return (
    <>
      {/* Backdrop con desenfoque suave al estar abierto el chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[70] sm:bg-black/25"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Ventana de Chat de Valeria - Bottom Sheet en móvil estilo Mercado Libre */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed z-[80] bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col
              inset-x-0 bottom-0 h-[74vh] max-h-[82vh] rounded-t-[32px] border-t border-gray-200 dark:border-slate-800
              sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-[390px] sm:h-[540px] sm:max-h-[80vh] sm:rounded-3xl sm:border sm:border-gray-200 sm:dark:border-slate-800"
          >
            {/* Barrita superior para deslizar/cerrar (solo en móvil) */}
            <div
              className="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer select-none shrink-0"
              onClick={() => setIsOpen(false)}
              title="Tocar para cerrar"
            >
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Header estilo Mercado Libre / Mago */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              {/* Botón Volver / Cerrar (Izquierda) */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Cerrar"
                aria-label="Cerrar"
              >
                <ChevronLeft className="w-5 h-5 sm:hidden" />
                <X className="w-4 h-4 hidden sm:block" />
              </button>

              {/* Título Central */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cfh-light-green animate-pulse" />
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white tracking-tight">
                    Valeria AI
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight">
                  {t('Valeria.subtitle', 'Asesora Virtual · En línea')}
                </span>
              </div>

              {/* Botón Reiniciar Conversación (Derecha) */}
              <button
                type="button"
                onClick={handleClearChat}
                className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title={t('Valeria.clear_chat', 'Reiniciar conversación')}
                aria-label={t('Valeria.clear_chat', 'Reiniciar conversación')}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3.5 bg-white dark:bg-slate-900 overscroll-contain">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-cfh-dark-green text-white rounded-br-sm shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm font-medium'
                    }`}
                  >
                    {renderFormattedText(msg.text)}
                  </div>

                  {/* Botones de acción contextual rápida dentro del mensaje de Valeria */}
                  {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 ml-1">
                      {msg.actions.map((act, actIdx) => (
                        <Link
                          key={actIdx}
                          href={`/${locale || 'es'}${act.href}`}
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-cfh-light-green/15 text-cfh-dark-green dark:text-cfh-light-green hover:bg-cfh-light-green hover:text-slate-900 transition-colors shadow-2xs border border-cfh-light-green/30"
                        >
                          <span>{act.label}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isListening && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-cfh-light-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-cfh-light-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-cfh-light-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    <span className="text-xs text-gray-400 dark:text-slate-400 ml-1.5 font-medium">
                      {t('Valeria.typing', 'Valeria está escribiendo...')}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions Pills */}
            {suggestions.length > 0 && (
              <div className="px-4 py-2 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800/80 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                {suggestions.map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(promptText)}
                    disabled={isListening}
                    className="whitespace-nowrap text-xs font-semibold px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-cfh-light-green/20 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors cursor-pointer shrink-0 disabled:opacity-50 border border-slate-200/60 dark:border-slate-700/60"
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area estilo Mercado Libre */}
            <div className="px-4 pt-2.5 pb-4 sm:pb-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800/80 shrink-0">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 rounded-full px-4 py-1 border border-slate-200/80 dark:border-slate-700 focus-within:border-cfh-dark-green dark:focus-within:border-cfh-light-green focus-within:ring-2 focus-within:ring-cfh-dark-green/20 transition-all">
                <input
                  type="text"
                  suppressHydrationWarning
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={t('Valeria.placeholder', 'Pregúntale a Valeria...')}
                  className="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 py-2.5 pr-2 focus:outline-none text-[15px] sm:text-sm font-medium"
                />
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => handleSend()}
                  disabled={!inputText.trim() || isListening}
                  className="w-8 h-8 rounded-full bg-cfh-dark-green hover:bg-[#061528] text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none shrink-0 shadow-xs cursor-pointer"
                  title="Enviar"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón Flotante Disparador - Se oculta COMPLETAMENTE mientras el modal esté abierto */}
      {!isOpen && (
        <div className="fixed bottom-16 right-4 sm:bottom-16 sm:right-6 z-[60]">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="cursor-pointer relative"
            onClick={() => setIsOpen(true)}
          >
            <div className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 bg-cfh-dark-green hover:bg-cfh-light-green hover:scale-105">
              <MessageCircle className="w-7 h-7 text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
            </div>

            {/* Globo de Diálogo de Bienvenida */}
            <div className="absolute bottom-[110%] right-0 z-20 pointer-events-none transition-opacity duration-300 w-max">
              <div className="bg-white dark:bg-slate-800 text-cfh-dark-green dark:text-cfh-light-green text-xs font-extrabold px-4 py-2.5 rounded-2xl rounded-br-sm shadow-xl border border-gray-100 dark:border-slate-700 animate-bounce">
                {t('Valeria.talk_to_me', '¡Habla conmigo! ✨')}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
