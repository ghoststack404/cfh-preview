"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileText,
  Download,
  Plus,
  Trash2,
  ExternalLink,
  BookMarked,
  CheckCircle2,
  FolderOpen,
} from "lucide-react";

interface CoachResourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
}

interface ResourceItem {
  id: string;
  title: string;
  type: "PDF" | "Plantilla" | "Guía" | "Enlace";
  sizeOrFormat: string;
  downloads: number;
  uploadedAt: string;
  url: string;
}

const INITIAL_RESOURCES: ResourceItem[] = [
  {
    id: "res-1",
    title: "Guía de Diagnóstico de Habilidades y Plan de Acción (PDF)",
    type: "PDF",
    sizeOrFormat: "2.4 MB",
    downloads: 34,
    uploadedAt: "Hace 1 semana",
    url: "#",
  },
  {
    id: "res-2",
    title: "Plantilla de Matriz de Priorización Eisenhower (Excel / Sheets)",
    type: "Plantilla",
    sizeOrFormat: "XLSX / Link",
    downloads: 58,
    uploadedAt: "Hace 2 semanas",
    url: "#",
  },
  {
    id: "res-3",
    title: "Cheat Sheet: Estructuras de Conversación Asertiva y Negociación",
    type: "Guía",
    sizeOrFormat: "1.1 MB",
    downloads: 72,
    uploadedAt: "Hace 3 semanas",
    url: "#",
  },
];

export function CoachResourcesModal({
  isOpen,
  onClose,
  tierName,
}: CoachResourcesModalProps) {
  const [resources, setResources] = useState<ResourceItem[]>(INITIAL_RESOURCES);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"PDF" | "Plantilla" | "Guía" | "Enlace">("PDF");
  const [newUrl, setNewUrl] = useState("");
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: ResourceItem = {
      id: `res-${Date.now()}`,
      title: newTitle.trim(),
      type: newType,
      sizeOrFormat: newType === "PDF" ? "PDF (Descargable)" : "Recurso Web",
      downloads: 0,
      uploadedAt: "Recién subido",
      url: newUrl.trim() || "#",
    };

    setResources([newItem, ...resources]);
    setNewTitle("");
    setNewUrl("");
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    setResources(resources.filter((r) => r.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header Modal */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-emerald-50/50 to-white dark:from-emerald-950/30 dark:to-slate-900 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-slate-100 leading-none">
                  Material Didáctico y Recursos Compartidos
                </h3>
                <span className="text-xs uppercase font-black tracking-widest bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full">
                  Exclusivo {tierName}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Comparte guías descargables, plantillas y archivos complementarios con tus aprendices.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Acciones principales */}
        <div className="px-6 py-4 bg-gray-50/70 dark:bg-slate-850 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-500 dark:text-slate-400 font-semibold">
            <span>{resources.length} recursos disponibles para tus alumnos</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? "Cerrar formulario" : "Agregar Material"}</span>
          </button>
        </div>

        {/* Formulario para agregar material */}
        <AnimatePresence>
          {showAddForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddResource}
              className="p-6 bg-emerald-50/40 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/40 space-y-4 overflow-hidden shrink-0"
            >
              <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-300 uppercase tracking-wider">
                Nuevo Material Didáctico
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Título del Documento o Guía</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej. Plantilla de Plan de Estudio 30 Días"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-medium bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Tipo de Recurso</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-medium bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="PDF">Guía PDF</option>
                    <option value="Plantilla">Plantilla</option>
                    <option value="Guía">Manual / Ejercicios</option>
                    <option value="Enlace">Enlace Web</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Enlace o Archivo URL (Opcional)</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-medium bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Publicar Recurso
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Lista de Recursos */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {resources.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-gray-200 dark:border-slate-750 flex items-center justify-between gap-4 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors shadow-xs"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <BookMarked className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{item.title}</h4>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">{item.type}</span>
                    <span>•</span>
                    <span>{item.sizeOrFormat}</span>
                    <span>•</span>
                    <span>{item.downloads} descargas de aprendices</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => alert(`Descargando material: ${item.title}`)}
                  className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-750 text-gray-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Descargar material"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Eliminar recurso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
