"use client";

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from "@/components/TranslationProvider";
import { translateCourseTitle } from "@/lib/i18n-helpers";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  CheckCircle2,
  MessageSquare,
  FileText,
  FolderDown,
  Download,
  ThumbsUp,
  Plus,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Clock,
  Wrench,
  BookOpen,
  User,
} from 'lucide-react';

interface QuestionItem {
  id: string;
  lessonId: string;
  author: string;
  title: string;
  body: string;
  timestamp: string;
  likes: number;
  hasLiked?: boolean;
  repliesCount: number;
  createdAt: string;
}

interface NoteItem {
  id: string;
  lessonId: string;
  lessonTitle: string;
  timestamp: string;
  seconds: number;
  text: string;
  createdAt: string;
}

export function getEmbedVideoUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const cleanUrl = url.trim();

  // YouTube match: standard watch, short youtu.be, embed, v, or query string variations
  const youtubeMatch = cleanUrl.match(
    /(?:youtu\.be\/|(?:www\.)?youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i
  );
  if (youtubeMatch && youtubeMatch[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
  }

  // Vimeo match: standard vimeo.com/ID or player.vimeo.com/video/ID
  const vimeoMatch = cleanUrl.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  }

  // Direct video or other stream URLs passed through as-is
  return cleanUrl;
}

export default function ClassroomPage() {
  const params = useParams();
  const id = params?.id as string;
  const { t, locale } = useTranslation();

  const [course, setCourse] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  // Tab activo de herramientas estilo Udemy
  const [activeTab, setActiveTab] = useState<'overview' | 'qa' | 'notes' | 'resources'>('overview');

  // Controles de Reproductor estilo Udemy
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(314); // 05:14
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Herramienta Q&A estilo Udemy con Optimistic UI
  const [questions, setQuestions] = useState<QuestionItem[]>([
    {
      id: 'q-1',
      lessonId: '',
      author: 'Carlos G.',
      title: '¿Cuál es la diferencia al estructurar el proyecto en producción?',
      body: 'En el minuto 03:20 mencionas la separación de carpetas, ¿se aplica igual si usamos Docker?',
      timestamp: '03:20',
      likes: 4,
      hasLiked: false,
      repliesCount: 2,
      createdAt: 'Hace 2 días',
    },
    {
      id: 'q-2',
      lessonId: '',
      author: 'María Elena',
      title: 'Atajo de teclado recomendado para agilizar este paso',
      body: '¿Hay alguna extensión recomendada para automatizar el tipado que explicaste?',
      timestamp: '08:45',
      likes: 7,
      hasLiked: true,
      repliesCount: 1,
      createdAt: 'Hace 5 horas',
    },
  ]);
  const [newQuestionTitle, setNewQuestionTitle] = useState('');
  const [newQuestionBody, setNewQuestionBody] = useState('');
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);

  // Herramienta Notas estilo Udemy con Optimistic UI & LocalStorage
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newNoteText, setNewNoteText] = useState('');

  // Cargar datos del curso
  useEffect(() => {
    if (id) {
      fetch(`/api/classroom/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.course) setCourse(data.course);
          if (data.sections) {
            setSections(data.sections);
            let foundActive: string | null = null;
            for (const sec of data.sections) {
              for (const les of sec.lessons) {
                if (!les.completed && !foundActive) {
                  foundActive = les.id;
                  break;
                }
              }
              if (foundActive) break;
            }
            if (!foundActive && data.sections[0]?.lessons[0]) {
              foundActive = data.sections[0].lessons[0].id;
            }
            setActiveLessonId(foundActive);
          }
        })
        .catch((err) => console.error("Error loading classroom:", err));
    }
  }, [id]);

  // Cargar notas desde localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && id) {
      try {
        const saved = localStorage.getItem(`cfh_classroom_notes_${id}`);
        if (saved) {
          setNotes(JSON.parse(saved));
        } else {
          setNotes([
            {
              id: 'n-1',
              lessonId: '',
              lessonTitle: 'Introducción al curso',
              timestamp: '02:15',
              seconds: 135,
              text: 'Revisar la configuración inicial y el patrón arquitectónico antes de pasar a la práctica.',
              createdAt: 'Guardada automáticamente',
            },
          ]);
        }
      } catch {}
    }
  }, [id]);

  const allLessons = sections.flatMap((s) => s.lessons);
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l: any) => l.completed).length;
  const activeLessonIndex = allLessons.findIndex((l: any) => l.id === activeLessonId);
  const activeLesson = allLessons[activeLessonIndex] || allLessons[0];
  const nextLesson = activeLessonIndex >= 0 && activeLessonIndex < allLessons.length - 1 ? allLessons[activeLessonIndex + 1] : null;
  const prevLesson = activeLessonIndex > 0 ? allLessons[activeLessonIndex - 1] : null;

  const currentVideoRaw = activeLesson?.videoUrl || (activeLessonIndex === 0 ? course?.introVideoUrl : null);
  const embedUrl = getEmbedVideoUrl(currentVideoRaw);
  const isEmbedVideo = !!embedUrl && (embedUrl.includes("youtube.com/embed/") || embedUrl.includes("player.vimeo.com/video/"));
  const isDirectVideo = !!embedUrl && !isEmbedVideo && (embedUrl.startsWith("http://") || embedUrl.startsWith("https://") || embedUrl.startsWith("/") || embedUrl.includes(".mp4") || embedUrl.includes(".webm"));

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleComplete = async (lessonId: string, currentStatus: boolean) => {
    if (isUpdatingProgress) return;
    setIsUpdatingProgress(true);

    const nextStatus = !currentStatus;

    // 1. Optimistic UI update
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        lessons: sec.lessons.map((les: any) =>
          les.id === lessonId ? { ...les, completed: nextStatus } : les
        ),
      }))
    );

    try {
      const res = await fetch(`/api/classroom/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, completed: nextStatus }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to persist progress`);
      }

      const data = await res.json().catch(() => null);
      if (!data || data.success === false) {
        throw new Error(data?.error || "Server reported unfulfilled progress update");
      }
    } catch (err) {
      console.error("Error updating lesson progress, rolling back UI:", err);
      // 2. Rollback UI on failure
      setSections((prev) =>
        prev.map((sec) => ({
          ...sec,
          lessons: sec.lessons.map((les: any) =>
            les.id === lessonId ? { ...les, completed: currentStatus } : les
          ),
        }))
      );
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const handleNextLesson = () => {
    if (nextLesson) {
      setActiveLessonId(nextLesson.id);
      setCurrentSeconds(0);
      setIsPlaying(true);
    }
  };

  const handlePostQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionTitle.trim()) return;

    const newQ: QuestionItem = {
      id: `q-${Date.now()}`,
      lessonId: activeLesson?.id || '',
      author: 'Tú (Estudiante)',
      title: newQuestionTitle.trim(),
      body: newQuestionBody.trim() || 'Sin detalles adicionales.',
      timestamp: formatSeconds(currentSeconds),
      likes: 0,
      hasLiked: false,
      repliesCount: 0,
      createdAt: 'Justo ahora',
    };

    setQuestions((prev) => [newQ, ...prev]);
    setNewQuestionTitle('');
    setNewQuestionBody('');
    setIsAskingQuestion(false);
  };

  const handleToggleVoteQuestion = (qId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === qId) {
          const nextLiked = !q.hasLiked;
          return {
            ...q,
            hasLiked: nextLiked,
            likes: nextLiked ? q.likes + 1 : Math.max(0, q.likes - 1),
          };
        }
        return q;
      })
    );
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const note: NoteItem = {
      id: `n-${Date.now()}`,
      lessonId: activeLesson?.id || '',
      lessonTitle: activeLesson?.title || 'Lección actual',
      timestamp: formatSeconds(currentSeconds),
      seconds: currentSeconds,
      text: newNoteText.trim(),
      createdAt: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [note, ...notes];
    setNotes(updated);
    setNewNoteText('');

    try {
      localStorage.setItem(`cfh_classroom_notes_${id}`, JSON.stringify(updated));
    } catch {}
  };

  const handleDeleteNote = (noteId: string) => {
    const updated = notes.filter((n) => n.id !== noteId);
    setNotes(updated);
    try {
      localStorage.setItem(`cfh_classroom_notes_${id}`, JSON.stringify(updated));
    } catch {}
  };

  const handleDownloadNotes = () => {
    if (notes.length === 0) return;
    const content = `# Notas del Curso: ${course?.title || 'Mi Curso'}\n\n` +
      notes
        .map((n) => `### [${n.timestamp}] ${n.lessonTitle}\n- **Fecha:** ${n.createdAt}\n- **Nota:** ${n.text}\n`)
        .join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Notas_${course?.title?.slice(0, 20) || 'Curso'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1 }
  };

  return (
    <div className="bg-white dark:bg-slate-950 min-h-[calc(100vh-80px)] flex flex-col">
      <motion.div 
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="flex-1 flex flex-col xl:flex-row"
      >
        
        {/* LEFT SIDEBAR (Syllabus/Curriculum) */}
        <div className="w-full xl:w-[320px] shrink-0 bg-gray-50 dark:bg-slate-900 flex flex-col h-auto xl:h-[calc(100vh-80px)] overflow-y-auto border-b xl:border-b-0 xl:border-r border-gray-200 dark:border-slate-800 xl:order-1 order-2">
          <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 flex justify-between items-center shadow-xs">
            <h3 className="font-bold text-cfh-text dark:text-white text-lg">{t("Classroom.tab_content", "Contenido")}</h3>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
              {completedCount}/{totalLessons}
            </span>
          </div>

          <div className="flex flex-col">
            {sections.map((section, sIdx) => (
              <div key={sIdx} className="border-b border-gray-200 dark:border-slate-800">
                <div className="bg-gray-50 dark:bg-slate-850 p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-cfh-text dark:text-white text-sm mb-1">{section.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {section.lessons.filter((l: any) => l.completed).length} / {section.lessons.length} {t("Classroom.completed", "completadas")}
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900">
                  {section.lessons.map((lesson: any, lIdx: number) => {
                    const isSelected = lesson.id === activeLessonId;
                    return (
                      <div 
                        key={lesson.id || lIdx}
                        onClick={() => setActiveLessonId(lesson.id)}
                        className={`flex items-start gap-3 p-4 cursor-pointer transition-colors border-l-4 ${
                          isSelected 
                            ? 'bg-cfh-dark-green/5 dark:bg-emerald-950/20 border-cfh-dark-green dark:border-cfh-light-green' 
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800/60 border-transparent'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(lesson.id, lesson.completed);
                          }}
                          className="mt-0.5 cursor-pointer shrink-0"
                        >
                          {lesson.completed ? (
                            <div className="w-5 h-5 bg-cfh-dark-green dark:bg-cfh-light-green rounded-full flex items-center justify-center text-white dark:text-cfh-dark-green shadow-xs">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                          ) : (
                            <div className="w-5 h-5 border-2 border-gray-300 dark:border-slate-600 hover:border-emerald-500 rounded-full transition-colors"></div>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isSelected ? 'font-bold text-cfh-dark-green dark:text-cfh-light-green' : 'text-gray-700 dark:text-slate-200'}`}>
                            {sIdx + 1}.{lIdx + 1} {lesson.title}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE CONTENT (Document & Video) */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 min-w-0 xl:h-[calc(100vh-80px)] xl:order-2 order-1">
          
          {/* Header minimalista para la clase */}
          <div className="bg-[#1C1D1F] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <Link
                href={`/${locale}/cursos`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white text-xs font-bold transition-all shadow-xs group shrink-0"
                title={t("Classroom.back_to_courses", "Volver al catálogo")}
              >
                <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-cfh-light-green" />
                <span className="hidden sm:inline">{t("Classroom.back_to_courses", "Volver al catálogo")}</span>
              </Link>
              <div className="truncate">
                <h1 className="font-extrabold text-sm sm:text-base truncate">
                  {translateCourseTitle(id, course?.title, t) || t("Classroom.loading_course", "Cargando curso...")}
                </h1>
                <p className="text-xs text-gray-400 truncate hidden sm:block">
                  {activeLesson?.title || "Lección en reproducción"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleComplete(activeLesson?.id, Boolean(activeLesson?.completed))}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                  activeLesson?.completed
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-cfh-light-green text-cfh-dark-green hover:bg-emerald-400"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="hidden sm:inline-block">{activeLesson?.completed ? "Completada" : "Marcar completada"}</span>
              </button>
              {nextLesson && (
                <button
                  type="button"
                  onClick={handleNextLesson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <span className="hidden sm:inline-block">Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Banner de Optimización si el curso está en pausa */}
          {(course as any)?.isUnderMaintenance && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm text-amber-200">
              <div className="flex items-center gap-2.5">
                <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Curso en pausa por optimización:</strong> Tu coach está actualizando y mejorando las lecciones de este curso. Puedes continuar estudiando y repasando tus clases activas con normalidad.
                </span>
              </div>
            </div>
          )}
          {/* Document Scrollable Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-10">
            <div className="max-w-3xl mx-auto w-full">
              
              {/* Título de la Lección */}
              <div className="mb-8">
                <span className="text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green uppercase tracking-wider mb-2 block">
                  {course?.title || "Curso"}
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-cfh-text dark:text-white mb-2">
                  {activeLesson?.title || "Lección del curso"}
                </h2>
                <div className="text-xs text-slate-500 flex items-center gap-3">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {activeLesson?.duration}</span>
                  {course?.coach && (
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Coach {course.coach.name?.split(' ')[0]}</span>
                  )}
                </div>
              </div>

              {/* Renderizado de contenido (Bloques o Legacy) */}
              <div className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed space-y-8">
                
                {/* Fallback Legacy Video */}
                {(!activeLesson?.blocks || !activeLesson?.blocks.some((b: any) => b.type === 'VIDEO')) && embedUrl && (
                  <div className="w-full relative aspect-video overflow-hidden rounded-2xl shadow-xl bg-black mb-10 group select-none">
                    {/* Render basic video */}
                    {isEmbedVideo ? (
                      <iframe src={embedUrl} allow="autoplay; fullscreen" className="absolute inset-0 w-full h-full border-0" />
                    ) : (
                      <video src={embedUrl} controls className="w-full h-full object-contain" />
                    )}
                  </div>
                )}

                {/* Legacy HTML Content */}
                {(!activeLesson?.blocks || activeLesson.blocks.length === 0) && activeLesson?.content && (
                  <div dangerouslySetInnerHTML={{ __html: activeLesson.content }} className="prose dark:prose-invert prose-emerald max-w-none" />
                )}

                {/* Bloques Dinámicos */}
                {activeLesson?.blocks?.map((block: any, index: number) => {
                  if (block.type === 'TEXT') {
                    return (
                      <div key={block.id || index} className="prose dark:prose-invert prose-emerald max-w-none" dangerouslySetInnerHTML={{ __html: block.data.html }} />
                    );
                  }
                  if (block.type === 'VIDEO') {
                    const blockEmbedUrl = getEmbedVideoUrl(block.data.url);
                    const isBlockEmbed = !!blockEmbedUrl && (blockEmbedUrl.includes("youtube") || blockEmbedUrl.includes("vimeo"));
                    return (
                      <div key={block.id || index} className="w-full relative aspect-video overflow-hidden rounded-2xl shadow-xl bg-black my-8 group select-none">
                        {isBlockEmbed ? (
                          <iframe src={blockEmbedUrl} allow="autoplay; fullscreen; encrypted-media" className="absolute inset-0 w-full h-full border-0" />
                        ) : (
                          <video src={blockEmbedUrl || block.data.url} controls className="w-full h-full object-contain" />
                        )}
                      </div>
                    );
                  }
                  if (block.type === 'QUIZ') {
                    const quizData = block.data;
                    return (
                      <div key={block.id || index} className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 my-6">
                        <h4 className="font-bold text-base text-cfh-text dark:text-white mb-4 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          Ejercicio: {quizData.question}
                        </h4>
                        <div className="space-y-2">
                          {quizData.options?.map((opt: any, optIdx: number) => (
                            <button
                              key={optIdx}
                              onClick={(e) => {
                                const btn = e.currentTarget;
                                if (opt.isCorrect) {
                                  btn.classList.remove('bg-white', 'dark:bg-slate-900', 'border-slate-200');
                                  btn.classList.add('bg-emerald-100', 'dark:bg-emerald-900/50', 'border-emerald-500', 'text-emerald-900', 'dark:text-emerald-100');
                                  const explanation = btn.parentElement?.nextElementSibling;
                                  if (explanation) explanation.classList.remove('hidden');
                                } else {
                                  btn.classList.remove('bg-white', 'dark:bg-slate-900', 'border-slate-200');
                                  btn.classList.add('bg-rose-100', 'dark:bg-rose-900/50', 'border-rose-500', 'text-rose-900', 'dark:text-rose-100');
                                }
                              }}
                              className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-cfh-light-green transition-colors font-medium text-sm"
                            >
                              {opt.text}
                            </button>
                          ))}
                        </div>
                        <div className="hidden mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-sm rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                          <strong>Explicación:</strong> {quizData.explanation}
                        </div>
                      </div>
                    );
                  }
                  if (block.type === 'LINKS') {
                    return (
                      <div key={block.id || index} className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 my-6">
                        <h4 className="font-bold text-base text-cfh-text dark:text-white mb-3 flex items-center gap-2"><FolderDown className="w-5 h-5 text-blue-500"/> Enlaces de apoyo</h4>
                        <ul className="space-y-2">
                          {block.data.links?.map((link: any, i: number) => (
                            <li key={i}>
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-cfh-light-green hover:underline font-medium inline-flex items-center gap-1.5">
                                <span>🔗</span> {link.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  if (block.type === 'PDF') {
                    return (
                      <div key={block.id || index} className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between my-6">
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-rose-500" />
                          <div>
                            <p className="font-bold text-cfh-text dark:text-white">{block.data.name || 'Documento PDF'}</p>
                            <p className="text-xs text-slate-500">{((block.data.sizeBytes || 0) / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <a href={block.data.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-cfh-dark-green text-white rounded-lg hover:bg-cfh-light-green transition-colors">
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    );
                  }
                  return null;
                })}
                
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR (Interactive Tools) */}
        <div className="w-full xl:w-[350px] shrink-0 bg-white dark:bg-slate-900 flex flex-col h-auto xl:h-[calc(100vh-80px)] border-l border-gray-200 dark:border-slate-800 xl:order-3 order-3">
          
          <div className="border-b border-gray-200 dark:border-slate-800 flex overflow-x-auto custom-scrollbar shrink-0 px-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('qa')}
              className={`flex-1 pb-3 pt-2 font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'qa' || activeTab === 'overview'
                  ? "border-cfh-dark-green text-cfh-dark-green dark:border-cfh-light-green dark:text-cfh-light-green"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Preguntas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`flex-1 pb-3 pt-2 font-bold text-xs sm:text-sm whitespace-nowrap cursor-pointer transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'notes'
                  ? "border-cfh-dark-green text-cfh-dark-green dark:border-cfh-light-green dark:text-cfh-light-green"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Notas</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

              {/* 2. PREGUNTAS Y RESPUESTAS (Q&A Estilo Udemy con Optimistic UI) */}
              {activeTab === 'qa' && (
                <div className="max-w-3xl space-y-6">
                  {/* Botón / Formulario de Nueva Pregunta */}
                  {!isAskingQuestion ? (
                    <button
                      type="button"
                      onClick={() => setIsAskingQuestion(true)}
                      className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-cfh-light-green text-gray-600 dark:text-slate-300 text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-cfh-light-green shrink-0" />
                      <span className="truncate">Hacer pregunta ({formatSeconds(currentSeconds)})</span>
                    </button>
                  ) : (
                    <form onSubmit={handlePostQuestion} className="bg-gray-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Pregunta asociada al minuto {formatSeconds(currentSeconds)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAskingQuestion(false)}
                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>

                      <input
                        type="text"
                        value={newQuestionTitle}
                        onChange={(e) => setNewQuestionTitle(e.target.value)}
                        placeholder="Título de tu duda o pregunta resumida..."
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:border-cfh-light-green"
                        required
                      />

                      <textarea
                        value={newQuestionBody}
                        onChange={(e) => setNewQuestionBody(e.target.value)}
                        placeholder="Describe detalladamente qué problema o duda encontraste..."
                        rows={3}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm resize-none focus:outline-none focus:border-cfh-light-green"
                      />

                      <div className="flex justify-end gap-2">
                        <button
                          type="submit"
                          className="px-5 py-2 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                        >
                          Publicar duda
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Lista de Preguntas */}
                  <div className="space-y-4">
                    {questions.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-start gap-4"
                      >
                        {/* Botón de Voto Optimista */}
                        <button
                          type="button"
                          onClick={() => handleToggleVoteQuestion(q.id)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer min-w-[44px] ${
                            q.hasLiked
                              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-cfh-dark-green dark:text-cfh-light-green font-black"
                              : "border-gray-200 dark:border-slate-700 text-gray-400 hover:border-emerald-400 hover:text-emerald-500"
                          }`}
                          title="Votar esta pregunta como útil"
                        >
                          <ThumbsUp className={`w-4 h-4 ${q.hasLiked ? "fill-current" : ""}`} />
                          <span className="text-[11px] mt-0.5">{q.likes}</span>
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">{q.author}</span>
                            <span className="text-[11px] text-gray-400">• {q.createdAt}</span>
                            <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">
                              En {q.timestamp}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-cfh-text dark:text-white mb-1">{q.title}</h4>
                          <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">{q.body}</p>

                          <div className="mt-3 flex items-center gap-2 text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green cursor-pointer hover:underline">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{q.repliesCount} {q.repliesCount === 1 ? 'respuesta' : 'respuestas'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. NOTAS DE ESTUDIANTE (Notes Estilo Udemy con Optimistic UI) */}
              {activeTab === 'notes' && (
                <div className="max-w-3xl space-y-6">
                  {/* Formulario Crear Nota en Timestamp Actual */}
                  <form onSubmit={handleAddNote} className="bg-gray-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Crear apunte en {formatSeconds(currentSeconds)}
                      </span>
                      {notes.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDownloadNotes}
                          className="text-xs text-cfh-dark-green dark:text-cfh-light-green font-bold flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Descargar notas .md
                        </button>
                      )}
                    </div>

                    <textarea
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder={`Escribe aquí tu apunte personal sobre el minuto ${formatSeconds(currentSeconds)}...`}
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm resize-none focus:outline-none focus:border-cfh-light-green font-mono"
                      required
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-cfh-dark-green hover:bg-[#061528] text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Guardar nota</span>
                      </button>
                    </div>
                  </form>

                  {/* Lista de Notas Guardadas */}
                  {notes.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-xs">
                      No has tomado notas todavía. Escribe tu primer apunte mientras ves el video.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div
                          key={note.id}
                          className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs flex items-start gap-3 group"
                        >
                          <button
                            type="button"
                            onClick={() => setCurrentSeconds(note.seconds || 0)}
                            className="text-xs font-mono font-bold bg-cfh-dark-green/10 text-cfh-dark-green dark:text-cfh-light-green hover:bg-cfh-dark-green hover:text-white px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer"
                            title="Saltar a este minuto del video"
                          >
                            {note.timestamp}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm text-gray-800 dark:text-slate-200 font-mono leading-relaxed whitespace-pre-wrap">
                              {note.text}
                            </p>
                            <span className="text-[10px] text-gray-400 mt-1 block">
                              {note.lessonTitle} • {note.createdAt}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Eliminar nota"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. RECURSOS DESCARGABLES */}
              {activeTab === 'resources' && (
                <div className="max-w-3xl space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-2xl flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                      <FolderDown className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm mb-1">
                        Material de apoyo y código fuente
                      </h4>
                      <p className="text-blue-700 dark:text-blue-300 text-xs mb-3">
                        Descarga las plantillas, diapositivas y soluciones prácticas de esta lección.
                      </p>
                      <button
                        type="button"
                        onClick={() => alert("Descarga de recursos iniciada.")}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Descargar recursos_leccion.zip</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        
      </motion.div>
    </div>
  );
}
