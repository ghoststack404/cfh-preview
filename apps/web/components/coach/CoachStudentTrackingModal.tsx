"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Users,
  Search,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  BookOpen,
  Edit,
  Save,
  MessageSquare,
} from "lucide-react";

export interface StudentRecord {
  id: string;
  name: string;
  avatarSeed: string;
  avatarUrl?: string | null;
  email?: string | null;
  topic: string;
  progress: number;
  sessionsCompleted: number;
  totalSessions: number;
  lastSession: string;
  status: "Excelente" | "Al día" | "Requiere refuerzo";
  privateNotes: string;
}

export interface CoachStudentTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
  initialStudents?: StudentRecord[];
}

// DEPRECATED / PURGED: Previously contained static INITIAL_STUDENTS array (with Carlos Rodríguez mock). Replaced with authentic Prisma student records.

export function CoachStudentTrackingModal({
  isOpen,
  onClose,
  tierName,
  initialStudents = [],
}: CoachStudentTrackingModalProps) {
  const [students, setStudents] = useState<StudentRecord[]>(initialStudents);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  const [saveToast, setSaveToast] = useState(false);

  React.useEffect(() => {
    if (initialStudents) {
      setStudents(initialStudents);
    }
  }, [JSON.stringify(initialStudents)]);

  // Bloquear desplazamiento del fondo (body) mientras el modal esté abierto
  React.useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      const prevTouchAction = document.body.style.touchAction;
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.touchAction = prevTouchAction;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.topic.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartEditNotes = (student: StudentRecord) => {
    setEditingNotesId(student.id);
    setTempNotes(student.privateNotes);
  };

  const handleSaveNotes = (id: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, privateNotes: tempNotes } : s))
    );
    setEditingNotesId(null);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleUpdateProgress = (id: string, delta: number) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const next = Math.max(0, Math.min(100, s.progress + delta));
          return {
            ...s,
            progress: next,
            status: next >= 80 ? "Excelente" : next >= 50 ? "Al día" : "Requiere refuerzo",
          };
        }
        return s;
      })
    );
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
        className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header Modal */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-amber-50/50 to-white dark:from-amber-950/30 dark:to-slate-900 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-slate-100 leading-none">
                  Seguimiento Analítico de Aprendices
                </h3>
                <span className="text-xs uppercase font-black tracking-widest bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
                  Exclusivo {tierName}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Monitorea el progreso, historial y notas pedagógicas de cada uno de tus alumnos.
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

        {/* Notificación flotante de notas guardadas */}
        <AnimatePresence>
          {saveToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md absolute top-20 right-6 z-20 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Notas privadas guardadas correctamente</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buscador y Resumen */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-gray-100 dark:border-slate-750">
              <p className="text-xs sm:text-sm font-bold text-gray-400 dark:text-slate-500 uppercase">Aprendices Activos</p>
              <p className="text-xl font-black text-gray-900 dark:text-slate-100 mt-0.5">{students.length}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
              <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase">Avance Promedio</p>
              <p className="text-xl font-black text-emerald-800 dark:text-emerald-300 mt-0.5">
                {students.length > 0 ? Math.round(students.reduce((a, b) => a + b.progress, 0) / students.length) : 0}%
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/40">
              <p className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-400 uppercase">Sesiones Dadas</p>
              <p className="text-xl font-black text-blue-800 dark:text-blue-300 mt-0.5">
                {students.reduce((a, b) => a + b.sessionsCompleted, 0)}
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar aprendiz por nombre o área de mentoría..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
            />
          </div>
        </div>

        {/* Lista de Aprendices */}
        <div className="p-6 overflow-y-auto overscroll-contain space-y-4 flex-1">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-slate-500 text-sm space-y-2">
              <Users className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-600 mb-2" />
              {students.length === 0 ? (
                <>
                  <p className="font-semibold text-gray-700 dark:text-slate-300">No tienes aprendices registrados todavía.</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 max-w-sm mx-auto">
                    Cuando los alumnos reserven tus mentorías o se inscriban a tus cursos, aparecerán aquí con su seguimiento analítico en tiempo real.
                  </p>
                </>
              ) : (
                <p>No se encontraron aprendices con el criterio "{searchTerm}".</p>
              )}
            </div>
          ) : (
            filteredStudents.map((student) => (
              <div
                key={student.id}
                className="bg-white dark:bg-slate-850 rounded-2xl border border-gray-200 dark:border-slate-750 p-5 shadow-xs space-y-4 hover:border-gray-300 dark:hover:border-slate-600 transition-all"
              >
                {/* Cabecera del Aprendiz */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 overflow-hidden border-2 border-white shadow-xs shrink-0">
                      <img
                        src={student.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(student.avatarSeed || student.name)}`}
                        alt={student.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-gray-900 dark:text-slate-100 text-base">{student.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{student.topic}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-full ${
                        student.status === "Excelente"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                          : student.status === "Al día"
                          ? "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300"
                          : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {student.status}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                      {student.sessionsCompleted}/{student.totalSessions} clases
                    </span>
                  </div>
                </div>

                {/* Barra de Progreso con controles */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                      Progreso de Objetivos
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateProgress(student.id, -5)}
                        className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-750 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                        title="Restar 5%"
                      >
                        -
                      </button>
                      <span className="font-black text-gray-900 dark:text-slate-100 text-sm">{student.progress}%</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateProgress(student.id, 5)}
                        className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-750 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                        title="Sumar 5%"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="h-2.5 w-full bg-gray-100 dark:bg-slate-750 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300"
                      style={{ width: `${student.progress}%` }}
                    />
                  </div>
                </div>

                {/* Notas Privadas del Coach */}
                <div className="bg-gray-50 dark:bg-slate-800/80 rounded-xl p-3.5 border border-gray-100 dark:border-slate-750 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-300 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                      Bloc de Notas Privadas del Coach (Solo visible para ti)
                    </span>

                    {editingNotesId === student.id ? (
                      <button
                        type="button"
                        onClick={() => handleSaveNotes(student.id)}
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEditNotes(student)}
                        className="text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar nota</span>
                      </button>
                    )}
                  </div>

                  {editingNotesId === student.id ? (
                    <textarea
                      rows={2}
                      value={tempNotes}
                      onChange={(e) => setTempNotes(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-amber-300 dark:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-medium"
                    />
                  ) : (
                    <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed italic">
                      "{student.privateNotes || "Sin notas adicionales."}"
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function CoachStudentTrackingButton({
  tierName,
  students = [],
  className,
  children,
}: {
  tierName: string;
  students?: StudentRecord[];
  className?: string;
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          className ||
          "px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
        }
      >
        {children || (
          <>
            <Users className="w-4 h-4" />
            <span>Seguimiento de Aprendices</span>
          </>
        )}
      </button>
      <CoachStudentTrackingModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        tierName={tierName}
        initialStudents={students}
      />
    </>
  );
}

