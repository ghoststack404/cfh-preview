"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Plus, Trash2, ChevronDown, ChevronRight,
  Play, FileText, CheckSquare, Edit3, X, BookOpen, Eye,
  Upload, Image as ImageIcon, Loader2,
} from "lucide-react";
import {
  updateCourseGeneral,
  upsertModule,
  deleteModule,
  upsertLesson,
  deleteLesson,
} from "@/app/actions/course-builder";
import type { LessonKind, CourseStatus } from "@prisma/client";
import LessonEditorClient from "./LessonEditorClient";
import CategorySelectDropdown from "@/components/coach/CategorySelectDropdown";
import PriceWithCurrencyTracker from "@/components/coach/PriceWithCurrencyTracker";

type LessonData = {
  id: string;
  title: string;
  position: number;
  kind: LessonKind;
  videoUrl: string | null;
  content: string | null;
  durationMinutes: number;
  isPreview: boolean;
  blocks?: any[];
};

type ModuleData = {
  id: string;
  title: string;
  position: number;
  description: string | null;
  lessons: LessonData[];
};

type CourseData = {
  id: string;
  title: string;
  summary: string;
  description: string;
  thumbnailUrl: string | null;
  introVideoUrl: string | null;
  priceCents: number;
  currency: string;
  status: CourseStatus;
  estimatedMinutes: number;
  categoryId: string | null;
  modules: ModuleData[];
};

type Category = { id: string; name: string };

const KIND_ICONS: Record<LessonKind, React.ReactNode> = {
  CONTENT: <Play className="w-3.5 h-3.5" />,
  ASSIGNMENT: <CheckSquare className="w-3.5 h-3.5" />,
  PROJECT: <FileText className="w-3.5 h-3.5" />,
};

const KIND_LABELS: Record<LessonKind, string> = {
  CONTENT: "Video / Contenido",
  ASSIGNMENT: "Tarea",
  PROJECT: "Proyecto",
};

export default function CourseEditorClient({
  course: initialCourse,
  categories,
  locale,
}: {
  course: CourseData;
  categories: Category[];
  locale: string;
}) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseData>(initialCourse);
  const [priceInput, setPriceInput] = useState<string>((initialCourse.priceCents / 100).toString());
  const [durationInput, setDurationInput] = useState<string>(
    initialCourse.estimatedMinutes && initialCourse.estimatedMinutes > 0
      ? initialCourse.estimatedMinutes.toString()
      : ""
  );
  const [modules, setModules] = useState<ModuleData[]>(initialCourse.modules);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [editingLesson, setEditingLesson] = useState<LessonData | null>(null);
  const [editingLessonModuleId, setEditingLessonModuleId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Estados de carga de archivos (imagen y video)
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Subir imagen de portada desde el dispositivo
  const handleUploadImage = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?type=course", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setCourse((c) => ({ ...c, thumbnailUrl: data.url }));
        showToast("Imagen de portada subida correctamente");
      } else {
        showToast(data.error || "Error al subir la imagen", "error");
      }
    } catch {
      showToast("Error de conexión al subir la imagen", "error");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Subir video introductorio desde el dispositivo
  const handleUploadVideo = async (file: File) => {
    const MAX_MB = 100;
    if (file.size > MAX_MB * 1024 * 1024) {
      showToast(`El video excede el límite de ${MAX_MB} MB.`, "error");
      return;
    }

    setIsUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload?type=video", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setCourse((c) => ({ ...c, introVideoUrl: data.url }));
        showToast("Video introductorio subido correctamente");
      } else {
        showToast(data.error || "Error al subir el video", "error");
      }
    } catch {
      showToast("Error de conexión al subir el video", "error");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // --- Datos generales ---
  const handleSaveGeneral = (status?: CourseStatus) => {
    const priceVal = parseFloat(priceInput);
    const calculatedPriceCents = !isNaN(priceVal) && priceVal > 0 ? Math.round(priceVal * 100) : 0;
    const parsedDuration = parseInt(durationInput, 10);
    const calculatedDuration = !isNaN(parsedDuration) && parsedDuration >= 0 ? parsedDuration : 0;

    startTransition(async () => {
      const res = await updateCourseGeneral({
        courseId: course.id,
        title: (course.title || "").trim() || "Nuevo Curso",
        summary: (course.summary || "").trim(),
        description: (course.description || "").trim(),
        priceCents: calculatedPriceCents,
        currency: "USD",
        categoryId: course.categoryId,
        thumbnailUrl: course.thumbnailUrl,
        introVideoUrl: course.introVideoUrl,
        status: status ?? course.status,
        estimatedMinutes: calculatedDuration,
      });
      if (res.success) {
        setCourse((c) => ({
          ...c,
          status: status ?? c.status,
          priceCents: calculatedPriceCents,
          currency: "USD",
          estimatedMinutes: calculatedDuration,
        }));
        showToast(status === "PUBLISHED" ? "¡Curso publicado con éxito!" : "Cambios guardados correctamente");
        setTimeout(() => {
          router.push(`/${locale}/coach/cursos`);
        }, 500);
      } else {
        showToast(res.error ?? "Error al guardar los cambios", "error");
      }
    });
  };

  // --- Módulos ---
  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddModule = () => {
    startTransition(async () => {
      const res = await upsertModule({
        courseId: course.id,
        title: "Nuevo Módulo",
        position: modules.length + 1,
      });
      if (res.success && res.module) {
        const newMod: ModuleData = { ...res.module, description: res.module.description ?? null, lessons: [] };
        setModules((prev) => [...prev, newMod]);
        setExpandedModules((prev) => new Set([...prev, res.module!.id]));
        showToast("Módulo creado");
      } else {
        showToast(res.error ?? "Error", "error");
      }
    });
  };

  const handleUpdateModuleTitle = (moduleId: string, title: string) => {
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, title } : m)));
  };

  const handleSaveModuleTitle = (mod: ModuleData) => {
    startTransition(async () => {
      const res = await upsertModule({
        courseId: course.id,
        moduleId: mod.id,
        title: mod.title,
        position: mod.position,
      });
      if (!res.success) showToast(res.error ?? "Error", "error");
    });
  };

  const handleDeleteModule = (moduleId: string) => {
    if (!confirm("¿Eliminar este módulo y todas sus lecciones?")) return;
    startTransition(async () => {
      const res = await deleteModule(moduleId);
      if (res.success) {
        setModules((prev) => prev.filter((m) => m.id !== moduleId));
        showToast("Módulo eliminado");
      } else {
        showToast(res.error ?? "Error", "error");
      }
    });
  };

  // --- Lecciones ---
  const handleAddLesson = (moduleId: string) => {
    startTransition(async () => {
      const mod = modules.find((m) => m.id === moduleId);
      const position = (mod?.lessons.length ?? 0) + 1;
      const res = await upsertLesson({
        moduleId,
        title: "Nueva Lección",
        position,
        kind: "CONTENT",
        durationMinutes: 10,
      });
      if (res.success && res.lesson) {
        const newLesson: LessonData = {
          id: res.lesson.id,
          title: res.lesson.title,
          position: res.lesson.position,
          kind: res.lesson.kind,
          videoUrl: res.lesson.videoUrl,
          content: res.lesson.content,
          durationMinutes: res.lesson.durationMinutes,
          isPreview: res.lesson.isPreview,
        };
        setModules((prev) =>
          prev.map((m) => (m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson] } : m))
        );
        showToast("Lección creada");
      } else {
        showToast(res.error ?? "Error", "error");
      }
    });
  };

  const handleDeleteLesson = (moduleId: string, lessonId: string) => {
    if (!confirm("¿Eliminar esta lección?")) return;
    startTransition(async () => {
      const res = await deleteLesson(lessonId);
      if (res.success) {
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
          )
        );
        if (editingLesson?.id === lessonId) setEditingLesson(null);
        showToast("Lección eliminada");
      } else {
        showToast(res.error ?? "Error", "error");
      }
    });
  };

  const handleSaveLesson = () => {
    if (!editingLesson || !editingLessonModuleId) return;
    startTransition(async () => {
      const res = await upsertLesson({
        moduleId: editingLessonModuleId,
        lessonId: editingLesson.id,
        title: editingLesson.title,
        position: editingLesson.position,
        kind: editingLesson.kind,
        videoUrl: editingLesson.videoUrl,
        content: editingLesson.content,
        durationMinutes: editingLesson.durationMinutes,
        isPreview: editingLesson.isPreview,
      });
      if (res.success) {
        setModules((prev) =>
          prev.map((m) =>
            m.id === editingLessonModuleId
              ? { ...m, lessons: m.lessons.map((l) => (l.id === editingLesson.id ? { ...editingLesson } : l)) }
              : m
          )
        );
        showToast("Lección guardada");
        setEditingLesson(null);
      } else {
        showToast(res.error ?? "Error", "error");
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Toast flotante en parte superior derecha */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[200] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold border animate-in fade-in slide-in-from-top-4 duration-200 ${
            toast.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <X className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-slate-800 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/coach/cursos`}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Editor de Curso</p>
            <h1 className="text-base font-extrabold text-gray-900 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
              {course.title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
              course.status === "PUBLISHED"
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
            }`}
          >
            {course.status === "PUBLISHED" ? "Publicado" : "Borrador"}
          </span>
          <button
            onClick={() => handleSaveGeneral()}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 font-bold text-sm transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Guardar
          </button>
          {course.status !== "PUBLISHED" && (
            <button
              onClick={() => handleSaveGeneral("PUBLISHED")}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cfh-dark-green hover:bg-cfh-light-green text-white font-bold text-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              Publicar
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-32 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Modules */}
        <div className="lg:col-span-2 space-y-4">
          {/* Modules Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green" />
                <h2 className="font-extrabold text-gray-900 dark:text-slate-100">Módulos y Lecciones</h2>
                <span className="text-xs text-gray-400 dark:text-slate-500 font-semibold">({modules.length})</span>
              </div>
              <button
                onClick={handleAddModule}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cfh-dark-green hover:bg-cfh-light-green text-white text-xs font-bold transition-colors disabled:opacity-60 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Módulo
              </button>
            </div>

            {modules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <BookOpen className="w-12 h-12 text-gray-200 dark:text-slate-700 mb-4" />
                <p className="text-gray-500 dark:text-slate-400 font-semibold mb-1">Sin módulos aún</p>
                <p className="text-sm text-gray-400 dark:text-slate-500">Agrega el primer módulo para empezar a estructurar tu curso.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {modules.map((mod) => (
                  <div key={mod.id}>
                    {/* Module header */}
                    <div className="flex items-center gap-2 px-4 py-3">
                      <button
                        onClick={() => toggleModule(mod.id)}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {expandedModules.has(mod.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="text"
                        value={mod.title}
                        onChange={(e) => handleUpdateModuleTitle(mod.id, e.target.value)}
                        onBlur={() => handleSaveModuleTitle(mod)}
                        className="flex-1 bg-transparent font-bold text-gray-900 dark:text-slate-100 text-sm outline-none focus:ring-0 border-0 px-0 py-1"
                      />
                      <span className="text-xs text-gray-400 dark:text-slate-500 font-medium shrink-0">
                        {mod.lessons.length} {mod.lessons.length === 1 ? "lección" : "lecciones"}
                      </span>
                      <button
                        onClick={() => handleDeleteModule(mod.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Lessons */}
                    {expandedModules.has(mod.id) && (
                      <div className="bg-gray-50/70 dark:bg-slate-800/40 px-4 pb-3">
                        {mod.lessons.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-slate-500 py-3 pl-6">Sin lecciones. Agrega una.</p>
                        ) : (
                          <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
                            {mod.lessons.map((lesson) => (
                              <div
                                key={lesson.id}
                                className="flex items-center gap-2 py-2.5 pl-6 pr-2 group"
                              >
                                <span className="text-gray-400 dark:text-slate-500">{KIND_ICONS[lesson.kind]}</span>
                                <button
                                  onClick={() => { setEditingLesson(lesson); setEditingLessonModuleId(mod.id); }}
                                  className="flex-1 text-left text-sm text-gray-700 dark:text-slate-300 hover:text-cfh-dark-green dark:hover:text-cfh-light-green font-medium transition-colors truncate"
                                >
                                  {lesson.title}
                                </button>
                                {lesson.isPreview && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">Preview</span>
                                )}
                                <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">{lesson.durationMinutes}min</span>
                                <button
                                  onClick={() => { setEditingLesson(lesson); setEditingLessonModuleId(mod.id); }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-all cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLesson(mod.id, lesson.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => handleAddLesson(mod.id)}
                          disabled={isPending}
                          className="mt-2 ml-6 flex items-center gap-1.5 text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green hover:opacity-80 transition-opacity disabled:opacity-50 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Agregar lección
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: General Data */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <h2 className="font-extrabold text-gray-900 dark:text-slate-100 text-sm uppercase tracking-wider">Datos del Curso</h2>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Título</label>
              <input
                type="text"
                value={course.title}
                onChange={(e) => setCourse((c) => ({ ...c, title: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm font-semibold outline-none focus:border-cfh-dark-green focus:ring-2 focus:ring-cfh-dark-green/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Resumen</label>
              <textarea
                value={course.summary}
                onChange={(e) => setCourse((c) => ({ ...c, summary: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm outline-none focus:border-cfh-dark-green focus:ring-2 focus:ring-cfh-dark-green/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Descripción</label>
              <textarea
                value={course.description}
                onChange={(e) => setCourse((c) => ({ ...c, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm outline-none focus:border-cfh-dark-green focus:ring-2 focus:ring-cfh-dark-green/20 resize-none"
              />
            </div>

            <div>
              <PriceWithCurrencyTracker
                value={priceInput}
                onChange={(val) => setPriceInput(val.toString())}
                label="Precio del Curso"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Categoría
              </label>
              <CategorySelectDropdown
                categories={categories}
                value={course.categoryId ?? ""}
                onChange={(catId) => setCourse((c) => ({ ...c, categoryId: catId || null }))}
                placeholder="Sin categoría"
              />
            </div>

            {/* Imagen de Portada */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Imagen de Portada
                </label>
                {course.thumbnailUrl && (
                  <button
                    type="button"
                    onClick={() => setCourse((c) => ({ ...c, thumbnailUrl: null }))}
                    className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    Quitar imagen
                  </button>
                )}
              </div>

              {/* Botón de subida desde el equipo */}
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cfh-dark-green/10 dark:bg-cfh-light-green/10 text-cfh-dark-green dark:text-cfh-light-green hover:bg-cfh-dark-green/20 font-bold text-xs transition-colors border border-cfh-dark-green/20">
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Subiendo imagen...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Subir archivo desde mi equipo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={isUploadingImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file);
                    }}
                  />
                </label>
              </div>

              {/* Vista previa de portada */}
              {course.thumbnailUrl && (
                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800">
                  <img
                    src={course.thumbnailUrl}
                    alt="Portada"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* O ingresar URL externa */}
              <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="url"
                  value={course.thumbnailUrl ?? ""}
                  onChange={(e) => setCourse((c) => ({ ...c, thumbnailUrl: e.target.value || null }))}
                  placeholder="O pega una URL de imagen (https://...)"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-xs outline-none focus:border-cfh-dark-green"
                />
              </div>
            </div>

            {/* Video Introductorio */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Video Introductorio
                </label>
                {course.introVideoUrl && (
                  <button
                    type="button"
                    onClick={() => setCourse((c) => ({ ...c, introVideoUrl: null }))}
                    className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    Quitar video
                  </button>
                )}
              </div>

              {/* Botón de subida de video desde el equipo */}
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-bold text-xs transition-colors border border-blue-200 dark:border-blue-800">
                  {isUploadingVideo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Subiendo video (hasta 100 MB)...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Subir video desde mi equipo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    disabled={isUploadingVideo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadVideo(file);
                    }}
                  />
                </label>
              </div>

              {/* Vista previa si es video directo */}
              {course.introVideoUrl && !course.introVideoUrl.includes("youtube.com") && !course.introVideoUrl.includes("youtu.be") && !course.introVideoUrl.includes("vimeo.com") && (
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-black aspect-video max-h-36">
                  <video src={course.introVideoUrl} controls className="w-full h-full object-contain" />
                </div>
              )}

              {/* O ingresar URL externa (YouTube/Vimeo/MP4) */}
              <div className="relative">
                <Play className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="url"
                  value={course.introVideoUrl ?? ""}
                  onChange={(e) => setCourse((c) => ({ ...c, introVideoUrl: e.target.value || null }))}
                  placeholder="O pega enlace de YouTube, Vimeo o MP4 (https://...)"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-xs outline-none focus:border-cfh-dark-green"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Duración estimada (minutos)
                </label>
                {durationInput && Number(durationInput) > 0 && (
                  <span className="text-[11px] font-bold text-cfh-dark-green dark:text-cfh-light-green">
                    {Math.floor(Number(durationInput) / 60)}h {Number(durationInput) % 60}m
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  placeholder="Ej. 60"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-bold text-sm outline-none focus:border-cfh-dark-green focus:ring-2 focus:ring-cfh-dark-green/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 dark:text-slate-500 pointer-events-none">
                  min
                </span>
              </div>
              {/* Botones de sugerencias rápidas de duración */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {[30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationInput(mins.toString())}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      durationInput === mins.toString()
                        ? "bg-cfh-dark-green text-white border-cfh-dark-green"
                        : "bg-gray-100 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-cfh-dark-green"
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Estado del Curso
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCourse((c) => ({ ...c, status: "DRAFT" }))}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    course.status === "DRAFT"
                      ? "bg-amber-500 text-white shadow-xs font-black"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>Borrador</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCourse((c) => ({ ...c, status: "PUBLISHED" }))}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    course.status === "PUBLISHED"
                      ? "bg-emerald-600 text-white shadow-xs font-black"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>Publicado</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCourse((c) => ({ ...c, status: "ARCHIVED" }))}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    course.status === "ARCHIVED"
                      ? "bg-slate-600 text-white shadow-xs font-black"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>Archivado</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => handleSaveGeneral()}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cfh-dark-green hover:bg-cfh-light-green text-white font-bold text-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isPending ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </div>

      {/* Lesson Editor Modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-slate-950 overflow-y-auto">
          <LessonEditorClient 
            lessonId={editingLesson.id} 
            courseId={course.id} 
            onClose={() => setEditingLesson(null)} 
          />
        </div>
      )}
    </div>
  );
}
