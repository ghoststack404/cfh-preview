"use client";

import React, { useState } from "react";
import {
  Bell,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  Check
} from "lucide-react";

interface CoachRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: "BASIC" | "ELITE" | "GOLD" | "PLATINUM" | "CURSOS_ONLY";
}

interface ReminderRule {
  id: string;
  timeBefore: string;
  channel: "email" | "in_app" | "both";
  label: string;
  enabled: boolean;
}

export const CoachRemindersModal: React.FC<CoachRemindersModalProps> = ({
  isOpen,
  onClose,
  tier
}) => {
  const [rules, setRules] = useState<ReminderRule[]>([
    {
      id: "r1",
      timeBefore: "24 horas antes",
      channel: "email",
      label: "Recordatorio por Correo Electronico",
      enabled: true
    },
    {
      id: "r2",
      timeBefore: "1 hora antes",
      channel: "both",
      label: "Alerta Rapida (Correo + Notificacion en Plataforma)",
      enabled: true
    },
    {
      id: "r3",
      timeBefore: "10 minutos antes",
      channel: "in_app",
      label: "Aviso en Plataforma con enlace a Sala Virtual",
      enabled: true
    }
  ]);

  const [testSent, setTestSent] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleRule = (id: string) => {
    setRules(prev =>
      prev.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSendTest = () => {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 dark:via-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Recordatorios y Notificaciones Automatizadas
                </h3>
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                  {tier}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Avisos para tus aprendices vía correo y plataforma
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Policy Banner: Only Email & Platform, NO WhatsApp */}
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100/80 dark:border-indigo-800/40 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-950 dark:text-indigo-200 space-y-1">
              <p className="font-semibold text-indigo-900 dark:text-indigo-300">
                Canales oficiales y privacidad garantizada
              </p>
              <p className="text-indigo-700 dark:text-indigo-300/80 leading-relaxed">
                Todas las notificaciones y recordatorios de sesión se envían estrictamente por <strong>correo electrónico oficial</strong> y mediante <strong>alertas dentro de la plataforma</strong>. Tus números telefónicos personales se mantienen 100% privados y protegidos.
              </p>
            </div>
          </div>

          {/* Active Rules List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Reglas de Automatización de Sesiones
            </h4>
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  rule.enabled
                    ? "bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-750 shadow-sm"
                    : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      rule.channel === "email"
                        ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                        : rule.channel === "in_app"
                        ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {rule.channel === "email" ? (
                      <Mail className="w-4 h-4" />
                    ) : rule.channel === "in_app" ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {rule.timeBefore}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300">
                        {rule.channel === "email"
                          ? "Email"
                          : rule.channel === "in_app"
                          ? "Plataforma"
                          : "Email + Plataforma"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{rule.label}</p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => toggleRule(rule.id)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    rule.enabled ? "bg-amber-500" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      rule.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* Email Preview */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Vista Previa del Correo para tu Aprendiz
            </h4>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-3 font-sans">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span><strong>De:</strong> Coaching From Home &lt;notificaciones@coachingfromhome.com&gt;</span>
                </div>
                <span className="text-xs sm:text-sm text-slate-400 dark:text-slate-500">Automatizado</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  Tu sesión de coaching con tu mentor está por comenzar
                </p>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Hola Carlos, te recordamos que tienes una sesión de 60 min agendada para el día de mañana a las <strong>10:00 AM</strong>.
                </p>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">Sala Virtual Segura</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Pizarra interactiva + Materiales listos</p>
                  </div>
                  <span className="px-3 py-1 bg-amber-500 text-white rounded-lg font-bold text-xs sm:text-sm">
                    Ingresar a la Sala
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between">
          <button
            onClick={handleSendTest}
            disabled={testSent}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {testSent ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>¡Correo de prueba enviado!</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span>Enviar correo de prueba a mi cuenta</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Preferencias Guardadas!</span>
                </>
              ) : (
                <span>Guardar Configuración</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
