"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Bot,
  Copy,
  Check,
  Download,
  BookOpen,
  ListOrdered,
  Lightbulb,
  Zap,
} from "lucide-react";

interface CoachAiCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
  initialCredits?: number;
  isSummarizing?: boolean;
  summaryData?: any;
  onGenerate?: () => Promise<any>;
  transcriptLength?: number;
}

export function CoachAiCopilotModal({
  isOpen,
  onClose,
  tierName,
  isSummarizing,
  summaryData,
  onGenerate,
  transcriptLength = 0,
}: CoachAiCopilotModalProps) {
  const [copied, setCopied] = useState(false);
  const [localData, setLocalData] = useState<any>(null);

  useEffect(() => {
    if (summaryData) setLocalData(summaryData);
  }, [summaryData]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (onGenerate) {
      const result = await onGenerate();
      if (result) setLocalData(result);
    }
  };

  const handleCopy = () => {
    if (!localData) return;
    const text = `
Resumen de Clase:
${localData.summary}

Puntos Fuertes:
${localData.strengths?.join('\n')}

Áreas de Mejora:
${localData.improvements?.join('\n')}

Tareas Asignadas:
${localData.tasks?.join('\n')}
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!localData) return;
    const text = `
Resumen de Clase:
${localData.summary}

Puntos Fuertes:
${localData.strengths?.join('\n')}

Áreas de Mejora:
${localData.improvements?.join('\n')}

Tareas Asignadas:
${localData.tasks?.join('\n')}
    `.trim();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Resumen_Sesion_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-3xl bg-[#0B0F17] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-full"
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Header */}
          <div className="p-6 sm:p-8 pb-6 border-b border-white/5 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  <Bot className="w-7 h-7 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                    Copiloto IA <Sparkles className="w-5 h-5 text-indigo-400" />
                  </h2>
                  <p className="text-sm text-gray-400 mt-1 max-w-sm">
                    Asistente en vivo exclusivo del plan <span className="text-indigo-400 font-bold">{tierName}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8 space-y-8">
            {!localData ? (
              <div className="space-y-6">
                <div className="bg-[#141822] rounded-2xl p-6 border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    Estado de la Transcripción
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">
                    La IA está escuchando y transcribiendo la llamada en tiempo real. 
                    Actualmente se han procesado <strong>{transcriptLength}</strong> caracteres de conversación.
                  </p>
                  
                  <button
                    onClick={handleGenerate}
                    disabled={isSummarizing || transcriptLength < 50}
                    className="w-full relative group overflow-hidden rounded-xl p-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="relative flex items-center justify-center gap-3">
                      {isSummarizing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-5 h-5 text-white" />
                      )}
                      <span className="font-bold text-white text-lg">
                        {isSummarizing ? "Analizando conversación..." : "Generar Resumen de la Clase"}
                      </span>
                    </div>
                  </button>
                  {transcriptLength < 50 && (
                    <p className="text-xs text-red-400 mt-3 text-center">
                      La conversación es muy corta para generar un buen resumen. Hablen un poco más.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Check className="w-5 h-5 text-emerald-400" />
                      Análisis Completado
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado' : 'Copiar'}
                      </button>
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Descargar .txt
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-[#141822] p-6 rounded-2xl border border-white/5">
                      <h4 className="text-sm font-bold text-indigo-400 mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Resumen Ejecutivo
                      </h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {localData.summary}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-[#141822] p-5 rounded-2xl border border-white/5">
                        <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          Puntos Fuertes
                        </h4>
                        <ul className="space-y-2">
                          {localData.strengths?.map((point: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                              <span className="leading-relaxed">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-[#141822] p-5 rounded-2xl border border-white/5">
                        <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          Áreas de Mejora
                        </h4>
                        <ul className="space-y-2">
                          {localData.improvements?.map((point: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                              <span className="leading-relaxed">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-[#141822] p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent relative overflow-hidden">
                      <h4 className="text-sm font-bold text-indigo-300 mb-4 flex items-center gap-2 relative z-10">
                        <ListOrdered className="w-4 h-4" />
                        Plan de Acción (Tareas)
                      </h4>
                      <div className="space-y-3 relative z-10">
                        {localData.tasks?.map((task: string, i: number) => (
                          <div key={i} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
                              {i + 1}
                            </div>
                            <p className="text-sm text-gray-200 mt-0.5 leading-relaxed">{task}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
