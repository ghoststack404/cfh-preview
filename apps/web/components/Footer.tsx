"use client";

import Link from "next/link";
import { useTranslation } from "./TranslationProvider";
import AnimatedTopBar from "./AnimatedTopBar";
import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { X, Send, Paperclip, Mail, Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function Footer() {
  const { data: session } = useSession();
  const { t, locale } = useTranslation();
  const locPrefix = locale ? '/' + locale : '';
  const makeHref = (p: string): string => p === '/' ? (locPrefix || '/') : `${locPrefix}${p}`;

  // Contact form state
  const [contactTarget, setContactTarget] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openContact = (email: string) => {
    setContactTarget(email);
    setSenderEmail(session?.user?.email || "");
    setSenderName(session?.user?.name || "");
    setSubject("");
    setMessage("");
    setImages([]);
    setImagePreviews([]);
    setSent(false);
    setError(null);
  };

  const closeContact = () => {
    setContactTarget(null);
    setSent(false);
    setError(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 4 - images.length;
    const newFiles = files.slice(0, remaining);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    if (imagePreviews[idx]) {
      URL.revokeObjectURL(imagePreviews[idx]);
    }
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderEmail.trim() || !subject.trim() || !message.trim()) {
      setError("Por favor completa tu correo, el asunto y el mensaje.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("to", contactTarget!);
      formData.append("subject", subject);
      formData.append("message", message);
      if (senderEmail.trim()) formData.append("senderEmail", senderEmail.trim());
      if (senderName.trim()) formData.append("senderName", senderName.trim());
      images.forEach((img, i) => formData.append(`image_${i}`, img));

      const res = await fetch("/api/contact", { method: "POST", body: formData });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo enviar el mensaje. Intenta de nuevo.");
      }
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <footer className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 mt-auto transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 flex flex-col md:flex-row justify-between items-start gap-10">
          {/* Logo + descripción */}
          <div className="max-w-sm">
            <Link href={makeHref("/")} className="flex items-center gap-3.5 mb-4">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 transition-transform duration-300">
                <img
                  src="/Logo.png"
                  alt="CFH Logo"
                  className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 opacity-100 dark:opacity-0"
                />
                <img
                  src="/Logo-dark.png"
                  alt="CFH Logo"
                  className="absolute inset-0 w-full h-full object-contain rounded-2xl transition-opacity duration-300 opacity-0 dark:opacity-100"
                />
              </div>
              <span className="font-black text-2xl sm:text-3xl tracking-tight text-cfh-dark-green dark:text-cfh-light-green transition-colors duration-300">
                CoachingFromHome
              </span>
            </Link>
            <p className="text-base text-gray-600 dark:text-slate-400 mb-6 leading-relaxed">
              {t("Footer.description")}
            </p>
          </div>

          {/* Sobre Nosotros */}
          <div className="flex flex-col gap-2.5">
            <h4 className="font-black text-base sm:text-lg text-cfh-text dark:text-slate-100 mb-2">
              {t("Footer.about_us")}
            </h4>
            <Link
              href={makeHref("/about/mision")}
              className="text-base text-gray-600 dark:text-slate-400 hover:text-cfh-light-green transition-colors"
            >
              {t("Footer.mission")}
            </Link>
            <Link
              href={makeHref("/terms")}
              className="text-base text-gray-600 dark:text-slate-400 hover:text-cfh-light-green transition-colors"
            >
              {t("Footer.terms")}
            </Link>
          </div>

          {/* Contacto */}
          <div className="flex flex-col gap-2.5">
            <h4 className="font-black text-base sm:text-lg text-cfh-text dark:text-slate-100 mb-2">
              {t("Footer.contact")}
            </h4>
            {(["help@coachingfromhome.com.mx", "contact@coachingfromhome.com.mx"] as const).map((email) => (
              <button suppressHydrationWarning
                key={email}
                type="button"
                onClick={() => openContact(email)}
                className="text-base text-gray-600 dark:text-slate-400 hover:text-cfh-light-green transition-colors flex items-center gap-2 text-left group"
              >
                <Mail className="w-4 h-4 shrink-0 text-cfh-dark-green dark:text-cfh-light-green" />
                <span className="group-hover:underline">{email}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>

        <AnimatedTopBar />
        <div className="bg-cfh-dark-green text-white text-center py-4 pb-16 text-sm font-medium">
          {t("Footer.rights")}
        </div>
      </footer>

      {/* ── Modal de Formulario de Contacto ── */}
      <AnimatePresence>
        {contactTarget && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeContact}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Panel del formulario */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden"
            >
              {/* Header del modal */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cfh-light-green/20 text-cfh-dark-green dark:text-cfh-light-green flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{t("Footer.sending_to", "Enviando a")}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate max-w-[280px]">
                      {contactTarget}
                    </p>
                  </div>
                </div>
                <button suppressHydrationWarning
                  onClick={closeContact}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Contenido */}
              {sent ? (
                <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-900 dark:text-slate-100">{t("Footer.message_sent", "¡Mensaje enviado!")}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                      {t("Footer.contact_soon", "Nos pondremos en contacto contigo a la brevedad.")}
                    </p>
                  </div>
                  <button suppressHydrationWarning
                    onClick={closeContact}
                    className="mt-2 px-6 py-2 bg-cfh-dark-green text-white rounded-xl text-sm font-bold hover:bg-cfh-light-green transition-colors"
                  >
                    {t("common.close", "Cerrar")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSend} className="p-6 space-y-4">
                  {/* Correo del remitente */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("Footer.sender_email_label", "Tu correo electrónico (para recibir respuesta)")} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder={t("Footer.sender_email_placeholder", "tu@correo.com")}
                      required
                      className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cfh-light-green focus:ring-1 focus:ring-cfh-light-green/30 transition-all"
                    />
                  </div>

                  {/* Asunto */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("Footer.subject_label", "Asunto")} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder={t("Footer.subject_placeholder", "Ej. Consulta sobre la plataforma...")}
                      required
                      className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cfh-light-green focus:ring-1 focus:ring-cfh-light-green/30 transition-all"
                    />
                  </div>

                  {/* Motivo / Mensaje */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      {t("Footer.message_label", "Motivo")} <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t("Footer.message_placeholder", "Describe tu consulta o comentario con el mayor detalle posible...")}
                      required
                      rows={4}
                      className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-cfh-light-green focus:ring-1 focus:ring-cfh-light-green/30 transition-all resize-none"
                    />
                  </div>

                  {/* Adjuntar imágenes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-gray-700 dark:text-slate-300">
                        {t("Footer.attached_images", "Imágenes adjuntas")}{" "}
                        <span className="font-normal text-gray-400">({images.length}/4 máx.)</span>
                      </label>
                      {images.length < 4 && (
                        <button suppressHydrationWarning
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green hover:underline"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          {t("Footer.attach", "Adjuntar")}
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    {imagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {imagePreviews.map((src, idx) => (
                          <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 group">
                            <img src={src} alt={`Imagen ${idx + 1}`} className="w-full h-full object-cover" />
                            <button suppressHydrationWarning
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            >
                              <X className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ))}
                        {images.length < 4 && (
                          <button suppressHydrationWarning
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center text-gray-400 hover:border-cfh-light-green hover:text-cfh-light-green transition-colors"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2">
                      {error}
                    </p>
                  )}

                  {/* Botón enviar */}
                  <button suppressHydrationWarning
                    type="submit"
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-cfh-dark-green hover:bg-cfh-light-green disabled:opacity-60 text-white rounded-xl text-sm font-black transition-colors shadow-md"
                  >
                    {sending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {t("Footer.sending", "Enviando...")}</>
                    ) : (
                      <><Send className="w-4 h-4" /> {t("Footer.send_message", "Enviar Mensaje")}</>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
