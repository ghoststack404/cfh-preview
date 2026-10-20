"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PremiumFeatureLock from "@/components/PremiumFeatureLock";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/components/TranslationProvider";
import {
  BookOpen,
  Edit3,
  Trash2,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  Award,
} from "lucide-react";
import {
  getCoachCourses,
  deleteCoachCourse,
  cancelCoachCourseDeletion,
  toggleCourseMaintenanceMode,
  CoachCourseDTO,
} from "@/app/actions/courses";
import CreateCourseButton from "./CreateCourseButton";
import { useParams } from "next/navigation";

export default function CoachCoursesPage() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const [courses, setCourses] = useState<CoachCourseDTO[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal de baja programada (3 días hábiles)
  const [scheduledDeletionModal, setScheduledDeletionModal] = useState<{
    courseId: string;
    courseTitle: string;
    enrollmentCount: number;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCoachCourses();
      if (res.success) {
        setCourses(res.courses || []);
        setCategories(res.categories || []);
      } else {
        setError(res.error || "No se pudieron cargar tus cursos.");
      }
    } catch (err: any) {
      setError(err?.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Eliminar curso o programar baja si cuenta con alumnos inscritos
  const handleDelete = async (course: CoachCourseDTO) => {
    if (course.enrollmentCount && course.enrollmentCount > 0) {
      setScheduledDeletionModal({
        courseId: course.id,
        courseTitle: course.title,
        enrollmentCount: course.enrollmentCount,
      });
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar el curso "${course.title}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      setIsActionLoading(true);
      const res = await deleteCoachCourse(course.id);
      if (res.success) {
        showToast("Curso eliminado correctamente.");
        setCourses((prev) => prev.filter((c) => c.id !== course.id));
      } else {
        showToast(res.error || "No se pudo eliminar el curso.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Error al eliminar el curso.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmScheduledDeletion = async () => {
    if (!scheduledDeletionModal) return;
    const { courseId } = scheduledDeletionModal;
    setScheduledDeletionModal(null);

    try {
      setIsActionLoading(true);
      const res = await deleteCoachCourse(courseId);
      if (res.success) {
        showToast(res.message || "Baja programada exitosamente con 3 días hábiles.");
        await loadData();
      } else {
        showToast(res.error || "No se pudo programar la baja.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Error al procesar la solicitud.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancelDeletion = async (courseId: string) => {
    try {
      setIsActionLoading(true);
      const res = await cancelCoachCourseDeletion(courseId);
      if (res.success) {
        showToast("Baja cancelada. El curso vuelve a estar activo.");
        await loadData();
      } else {
        showToast(res.error || "No se pudo cancelar la baja.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Error al cancelar la baja.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleMaintenance = async (course: CoachCourseDTO) => {
    const nextState = !course.isUnderMaintenance;
    try {
      setIsActionLoading(true);
      const res = await toggleCourseMaintenanceMode(course.id, nextState);
      if (res.success) {
        showToast(res.message || "Modo mantenimiento actualizado.");
        await loadData();
      } else {
        showToast(res.error || "No se pudo actualizar el modo mantenimiento.", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Error al actualizar modo mantenimiento.", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const totalEnrollments = courses.reduce((acc, c) => acc + (c.enrollmentCount || 0), 0);
  const publishedCount = courses.filter((c) => c.status === "PUBLISHED").length;

  return (
    <PremiumFeatureLock 
      feature="hasCourseBuilder" 
      title="Creador de Cursos Premium" 
      description="Tu plan actual no incluye la venta de cursos. Mejora a Cursos Starter o Élite para empezar a generar ingresos pasivos vendiendo tu conocimiento."
    >

    <div className="min-h-screen bg-gradient-to-b from-gray-50/50 to-gray-100/50 dark:from-slate-950 dark:to-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-[200] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold border ${
              toast.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-cfh-light-green/20 dark:bg-cfh-light-green/10 text-cfh-dark-green dark:text-cfh-light-green uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" /> {t("CoachCursos.portal_badge", "Portal de Cursos")}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
              {t("CoachCursos.title", "Mis Cursos")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-xl">
              {t("CoachCursos.subtitle", "Visualiza, edita y publica los cursos y contenidos que impartes a tus aprendices en Coaching From Home.")}
            </p>
          </div>

                      <CreateCourseButton />
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("CoachCursos.total_courses", "Total de Cursos")}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-slate-100 mt-1">{courses.length}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-cfh-dark-green dark:text-cfh-light-green" /> {t("CoachCursos.courses_registered", "Cursos registrados")}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("CoachCursos.published_courses", "Cursos Publicados")}</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{publishedCount}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> {t("CoachCursos.visible_marketplace", "Visibles en marketplace")}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("CoachCursos.enrolled_students", "Aprendices Inscritos")}</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{totalEnrollments}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> {t("CoachCursos.active_students", "Aprendices activos")}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("CoachCursos.sales_247", "Ventas 24/7")}</p>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{t("CoachCursos.active", "Activo")}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> {t("CoachCursos.global_marketplace", "Marketplace global")}
            </p>
          </div>
        </div>

        {/* Lista de Cursos */}
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-slate-800 shadow-sm">
            <div className="w-10 h-10 border-4 border-cfh-dark-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-slate-400 font-medium">{t("CoachCursos.loading", "Cargando tus cursos...")}</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-8 text-center text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-600 dark:text-rose-400" />
            <p className="font-bold">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer"
            >
              {t("CoachCursos.retry", "Reintentar")}
            </button>
          </div>
        ) : courses.length === 0 ? (
          /* Estado Vacío - Mejorado sin botón duplicado */
          <div className="relative overflow-hidden bg-white dark:bg-slate-900/90 rounded-3xl p-8 sm:p-12 text-center border border-gray-100 dark:border-slate-800 shadow-xl max-w-2xl mx-auto space-y-6">
            {/* Resplandor decorativo de fondo */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 bg-cfh-light-green/10 dark:bg-cfh-light-green/5 blur-3xl pointer-events-none rounded-full" />

            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cfh-dark-green to-cfh-light-green text-white flex items-center justify-center mx-auto shadow-lg shadow-cfh-dark-green/20 ring-8 ring-cfh-light-green/10">
                <BookOpen className="w-10 h-10" />
              </div>
            </div>

            <div className="space-y-2 relative">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Monetiza tu Talento 24/7</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                {t("CoachCursos.empty_title", "Sin cursos creados aún")}
              </h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed max-w-lg mx-auto">
                {t("CoachCursos.empty_desc", "Comparte tu conocimiento y crea tu primer catálogo de lecciones interactivas para los aprendices. Los cobros se procesan de forma segura con Stripe en USD.")}
              </p>
            </div>

            {/* Grid informativo de beneficios */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/60">
                <div className="text-cfh-dark-green dark:text-cfh-light-green font-bold text-xs flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3.5 h-3.5" /> Módulos y Clases
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
                  Videos, tareas y contenido estructurado a tu propio ritmo.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/60">
                <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5" /> Precios en USD
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
                  Moneda internacional con conversión a pesos en vivo.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/60">
                <div className="text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center gap-1.5 mb-1">
                  <Award className="w-3.5 h-3.5" /> Certificados
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
                  Acreditación automática oficial para tus alumnos al finalizar.
                </p>
              </div>
            </div>

            {/* Indicador que guía al botón superior */}
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                <span className="text-base animate-bounce">👆</span>
                <span>Haz clic en el botón superior <strong>«Crear Nuevo Curso»</strong> para iniciar</span>
              </div>
            </div>
          </div>
        ) : (
          /* Cuadrícula de Cursos */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Thumbnail / Header */}
                  <div className="relative aspect-video w-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                    <img
                      src={
                        course.thumbnailUrl ||
                        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80"
                      }
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                      {course.isScheduledForDeletion ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-md bg-rose-600 text-white animate-pulse">
                          <span>⏳ Baja Programada (3 días)</span>
                        </span>
                      ) : course.isUnderMaintenance ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-md bg-amber-600 text-white">
                          <span>🛠️ En Pausa / Edición</span>
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider shadow-sm ${
                            course.status === "PUBLISHED"
                              ? "bg-emerald-500 text-white"
                              : "bg-amber-500 text-white"
                          }`}
                        >
                          {course.status === "PUBLISHED" ? t("CoachCursos.published_badge", "Publicado") : t("CoachCursos.draft_badge", "Borrador")}
                        </span>
                      )}
                    </div>

                    {course.categoryName && (
                      <div className="absolute top-3 right-3">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-black/60 text-white backdrop-blur-xs">
                          {course.categoryName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5 space-y-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 leading-snug line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {course.summary || course.description}
                    </p>

                    {/* Banner de Baja Programada en tarjeta */}
                    {course.isScheduledForDeletion && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center justify-between gap-2 text-xs">
                        <div className="text-rose-800 dark:text-rose-300 font-medium">
                          <span>⚠️ Baja el {course.scheduledDeletionDate ? new Date(course.scheduledDeletionDate).toLocaleDateString() : "3 días"}.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCancelDeletion(course.id)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded-lg font-bold border border-rose-300 shrink-0 cursor-pointer shadow-xs"
                        >
                          Cancelar baja
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 pt-2 border-t border-gray-100 dark:border-slate-800">
                      <span className="flex items-center gap-1 font-semibold text-cfh-dark-green dark:text-cfh-light-green">
                        <Clock className="w-3.5 h-3.5" />
                        {Math.floor(course.estimatedMinutes / 60)}h {course.estimatedMinutes % 60}m
                      </span>
                      <span className="font-extrabold text-base text-gray-900 dark:text-slate-100">
                        ${(course.priceCents / 100).toFixed(2)} {course.currency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="p-4 bg-gray-50/70 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/${locale}/coach/cursos/${course.id}/editar`}
                      className="px-3.5 py-2 rounded-xl bg-cfh-dark-green hover:bg-cfh-light-green text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Editar curso y lecciones"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{t("CoachCursos.edit_btn", "Editar Curso")}</span>
                    </Link>

                    <button
                      onClick={() => handleToggleMaintenance(course)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer ${
                        course.isUnderMaintenance
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 hover:bg-amber-200"
                          : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:text-amber-600 hover:border-amber-300"
                      }`}
                      title={course.isUnderMaintenance ? "Reanudar curso normal" : "Pausar curso en mantenimiento mientras editas"}
                    >
                      <span>{course.isUnderMaintenance ? "🛠️ En Pausa" : "⏸️ Pausar"}</span>
                    </button>

                    <Link
                      href={`/cursos/${course.id}`}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:text-blue-600 hover:border-blue-300 font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t("CoachCursos.view_btn", "Ver")}</span>
                    </Link>
                  </div>

                  <button
                    onClick={() => handleDelete(course)}
                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                    title={course.enrollmentCount > 0 ? "Programar baja de curso (3 días hábiles)" : "Eliminar curso"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Baja Programada (3 días hábiles) */}
      <AnimatePresence>
        {scheduledDeletionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isActionLoading && setScheduledDeletionModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5 text-gray-900 dark:text-slate-100 z-10"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-2xl shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-gray-900 dark:text-white">
                    Política de Baja de Curso con Alumnos
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    "{scheduledDeletionModal.courseTitle}" cuenta con{" "}
                    <strong>{scheduledDeletionModal.enrollmentCount} {scheduledDeletionModal.enrollmentCount === 1 ? 'alumno inscrito' : 'alumnos inscritos'}</strong>.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-2">
                <p className="font-bold">Por política de la plataforma y protección a tus aprendices:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>El curso se retirará <strong>inmediatamente</strong> del catálogo público para evitar nuevas compras.</li>
                  <li>Se otorgará un plazo de <strong>3 días hábiles</strong> a los alumnos inscritos para que concluyan sus contenidos y descarguen sus materiales.</li>
                  <li>Se notificará automáticamente a todos tus alumnos en su cuenta con la fecha límite programada.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setScheduledDeletionModal(null)}
                  disabled={isActionLoading}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmScheduledDeletion}
                  disabled={isActionLoading}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Programar Baja (3 Días Hábiles)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </PremiumFeatureLock>
  );
}