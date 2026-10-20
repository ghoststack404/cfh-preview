"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, Play,
  FileText, Link as LinkIcon, CheckSquare, Eye, Upload, Check, X
} from "lucide-react";
import {
  getLessonBlocks,
  updateLessonMetadata,
  upsertLessonBlock,
  deleteLessonBlock,
  reorderLessonBlocks
} from "@/app/actions/course-blocks";
import type { BlockType } from "@prisma/client";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type LessonBlock = {
  id: string;
  type: BlockType;
  position: number;
  data: any;
};

// --- TipTap Editor Component ---
function TiptapEditor({ content, onChange }: { content: string, onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }: { editor: any }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px] px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-b-xl bg-gray-50 dark:bg-slate-800',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 p-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded ${editor.isActive('bold') ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        >
          <b>B</b>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded ${editor.isActive('italic') ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        >
          <i>I</i>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded text-sm font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded text-sm font-bold ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        >
          H3
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded ${editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        >
          <span className="font-bold">&bull;</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded text-sm ${editor.isActive('blockquote') ? 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
        >
          &quot;
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

// --- Sortable Item Component ---
function SortableBlock({ block, updateBlock, removeBlock, moveUp, moveDown, index, total }: {
  block: LessonBlock;
  updateBlock: (id: string, data: any) => void;
  removeBlock: (id: string) => void;
  moveUp: () => void;
  moveDown: () => void;
  index: number;
  total: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderContent = () => {
    switch (block.type) {
      case "TEXT":
        return (
          <div className="mt-4">
            <TiptapEditor content={block.data.html || ""} onChange={(html) => updateBlock(block.id, { ...block.data, html })} />
          </div>
        );
      case "VIDEO":
        return (
          <div className="mt-4 space-y-3">
            <input
              type="url"
              placeholder="URL de YouTube o Vimeo..."
              value={block.data.url || ""}
              onChange={(e) => updateBlock(block.id, { ...block.data, url: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm outline-none focus:border-cfh-dark-green"
            />
            {block.data.url && (
              <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {block.data.url.includes("youtube") || block.data.url.includes("youtu.be") || block.data.url.includes("vimeo") ? (
                  <iframe
                    src={block.data.url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                    className="w-full h-full"
                    allowFullScreen
                  />
                ) : (
                  <p className="text-gray-400 text-xs">Vista previa no disponible para este enlace.</p>
                )}
              </div>
            )}
          </div>
        );
      case "PDF":
        return (
          <div className="mt-4">
            <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">
                {block.data.url ? "Reemplazar archivo PDF" : "Subir archivo PDF"}
              </span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const formData = new FormData();
                    formData.append("file", file);
                    try {
                      const res = await fetch("/api/upload", { method: "POST", body: formData });
                      const data = await res.json();
                      if (data.url) {
                        updateBlock(block.id, { url: data.url, name: file.name, sizeBytes: file.size });
                      }
                    } catch (error) {
                      console.error(error);
                      alert("Error al subir archivo");
                    }
                  }
                }}
              />
            </label>
            {block.data.url && (
              <div className="mt-3 flex items-center gap-2 text-sm text-cfh-dark-green dark:text-cfh-light-green bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-900/30">
                <FileText className="w-4 h-4" />
                <span className="font-medium flex-1 truncate">{block.data.name || "Archivo PDF"}</span>
              </div>
            )}
          </div>
        );
      case "LINKS":
        return (
          <div className="mt-4 space-y-3">
            {(block.data.links || []).map((link: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Título..."
                  value={link.title || ""}
                  onChange={(e) => {
                    const newLinks = [...(block.data.links || [])];
                    newLinks[idx].title = e.target.value;
                    updateBlock(block.id, { ...block.data, links: newLinks });
                  }}
                  className="w-1/3 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm outline-none focus:border-cfh-dark-green"
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={link.url || ""}
                  onChange={(e) => {
                    const newLinks = [...(block.data.links || [])];
                    newLinks[idx].url = e.target.value;
                    updateBlock(block.id, { ...block.data, links: newLinks });
                  }}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm outline-none focus:border-cfh-dark-green"
                />
                <button
                  onClick={() => {
                    const newLinks = (block.data.links || []).filter((_: any, i: number) => i !== idx);
                    updateBlock(block.id, { ...block.data, links: newLinks });
                  }}
                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newLinks = [...(block.data.links || []), { title: "", url: "" }];
                updateBlock(block.id, { ...block.data, links: newLinks });
              }}
              className="flex items-center gap-1 text-sm font-bold text-cfh-dark-green hover:underline"
            >
              <Plus className="w-4 h-4" /> Agregar enlace
            </button>
          </div>
        );
      case "QUIZ":
        const options = block.data.options || [];
        return (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Pregunta</label>
              <textarea
                value={block.data.question || ""}
                onChange={(e) => updateBlock(block.id, { ...block.data, question: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm outline-none focus:border-cfh-dark-green"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Opciones</label>
              <div className="space-y-2">
                {options.map((opt: any, idx: number) => (
                  <div key={opt.id || idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`quiz-${block.id}`}
                      checked={opt.isCorrect}
                      onChange={() => {
                        const newOpts = options.map((o: any, i: number) => ({ ...o, isCorrect: i === idx }));
                        updateBlock(block.id, { ...block.data, options: newOpts });
                      }}
                      className="w-4 h-4 text-cfh-dark-green focus:ring-cfh-dark-green"
                    />
                    <input
                      type="text"
                      value={opt.text || ""}
                      onChange={(e) => {
                        const newOpts = [...options];
                        newOpts[idx].text = e.target.value;
                        updateBlock(block.id, { ...block.data, options: newOpts });
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm outline-none focus:border-cfh-dark-green"
                    />
                    <button
                      onClick={() => {
                        if (options.length <= 2) return; // min 2
                        const newOpts = options.filter((_: any, i: number) => i !== idx);
                        updateBlock(block.id, { ...block.data, options: newOpts });
                      }}
                      className={`p-2 rounded-xl ${options.length <= 2 ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              {options.length < 6 && (
                <button
                  onClick={() => {
                    const newOpts = [...options, { id: Date.now().toString(), text: "", isCorrect: false }];
                    updateBlock(block.id, { ...block.data, options: newOpts });
                  }}
                  className="mt-2 flex items-center gap-1 text-sm font-bold text-cfh-dark-green hover:underline"
                >
                  <Plus className="w-4 h-4" /> Agregar opción
                </button>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Explicación (opcional)</label>
              <textarea
                value={block.data.explanation || ""}
                onChange={(e) => updateBlock(block.id, { ...block.data, explanation: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm outline-none focus:border-cfh-dark-green"
                rows={2}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const Icon = {
    TEXT: FileText,
    VIDEO: Play,
    PDF: FileText,
    LINKS: LinkIcon,
    QUIZ: CheckSquare
  }[block.type] || FileText;

  return (
    <div ref={setNodeRef} style={style} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300">
            <GripVertical className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            <Icon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300">{block.type}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={moveUp} disabled={index === 0} className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30">↑</button>
          <button onClick={moveDown} disabled={index === total - 1} className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30">↓</button>
          <button onClick={() => removeBlock(block.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg ml-2">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}

export default function LessonEditorClient({ lessonId, courseId, onClose }: { lessonId: string, courseId: string, onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(0);
  const [isPreview, setIsPreview] = useState(false);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);

  // Timer para debounce autosave
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLesson = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLessonBlocks(lessonId);
      setTitle(data.title);
      setDuration(data.durationMinutes);
      setIsPreview(data.isPreview);
      let parsedObj = [];
      try {
        if (data.content) parsedObj = JSON.parse(data.content);
      } catch (e) { }
      setObjectives(Array.isArray(parsedObj) ? parsedObj : []);
      setBlocks(data.blocks);
    } catch (e) {
      console.error(e);
      setSaveState("error");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

  const triggerSave = useCallback(() => {
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      // Save metadata
      const metaRes = await updateLessonMetadata(lessonId, {
        title,
        durationMinutes: duration,
        isPreview,
        learningObjectives: objectives,
      });

      if (!metaRes.success) {
        setSaveState("error");
        return;
      }

      // Blocks autosave is handled per block on their change, but we save blocks here as well if needed?
      // Actually, it's better to auto-save the block when it changes via the `upsertLessonBlock` Action
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    }, 1500);
  }, [lessonId, title, duration, isPreview, objectives]);

  // Hook changes to trigger save
  useEffect(() => {
    if (!loading) triggerSave();
  }, [title, duration, isPreview, objectives, triggerSave, loading]);

  const handleUpdateBlock = async (id: string, data: any) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, data } : b);
    setBlocks(newBlocks);

    // Save block directly
    setSaveState("saving");
    const block = newBlocks.find(b => b.id === id);
    if (block) {
      const res = await upsertLessonBlock(lessonId, block.id, block.type, block.data, block.position);
      if (res.success) {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } else {
        setSaveState("error");
      }
    }
  };

  const handleAddBlock = async (type: BlockType) => {
    setSaveState("saving");
    let defaultData: any = {};
    if (type === "TEXT") defaultData = { html: "" };
    if (type === "VIDEO") defaultData = { url: "" };
    if (type === "LINKS") defaultData = { links: [{ title: "", url: "" }] };
    if (type === "QUIZ") defaultData = { question: "", options: [{ id: "1", text: "", isCorrect: true }, { id: "2", text: "", isCorrect: false }], explanation: "" };

    const pos = blocks.length;
    const res = await upsertLessonBlock(lessonId, null, type, defaultData, pos);
    if (res.success && res.block) {
      setBlocks([...blocks, res.block]);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } else {
      setSaveState("error");
    }
  };

  const handleRemoveBlock = async (id: string) => {
    if (!confirm("¿Eliminar bloque?")) return;
    setBlocks(blocks.filter(b => b.id !== id));
    await deleteLessonBlock(id);
    // Reorder remaining
    const newBlocks = blocks.filter(b => b.id !== id);
    await reorderLessonBlocks(lessonId, newBlocks.map(b => b.id));
  };

  const handleMoveBlock = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index]!;
    newBlocks[index] = newBlocks[newIndex]!;
    newBlocks[newIndex] = temp;
    setBlocks(newBlocks);
    setSaveState("saving");
    await reorderLessonBlocks(lessonId, newBlocks.map(b => b.id));
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save order
        setSaveState("saving");
        reorderLessonBlocks(lessonId, newItems.map((b: any) => b.id)).then(() => {
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 2000);
        });

        return newItems;
      });
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando editor...</div>;

  return (
    <div className="min-h-screen pb-24 bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-slate-800 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Editor de Lección</p>
            <h1 className="text-base font-extrabold text-gray-900 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
              {title || "Sin título"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium flex items-center gap-1.5">
            {saveState === "saving" && <span className="text-amber-500 flex items-center gap-1"><Save className="w-4 h-4 animate-pulse" /> Guardando...</span>}
            {saveState === "saved" && <span className="text-green-500 flex items-center gap-1"><Check className="w-4 h-4" /> Guardado</span>}
            {saveState === "error" && <span className="text-rose-500 flex items-center gap-1"><X className="w-4 h-4" /> Error</span>}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-sm font-bold text-gray-700 dark:text-slate-300 transition-colors">
            <Eye className="w-4 h-4" /> Vista Previa de Alumno
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-8 space-y-8">
        {/* Metadata Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Título de la Lección</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full text-lg font-bold px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none focus:border-cfh-dark-green"
              />
            </div>
            <div className="flex gap-6">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Duración (minutos)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-32 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none focus:border-cfh-dark-green font-semibold"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="preview-checkbox"
                  checked={isPreview}
                  onChange={e => setIsPreview(e.target.checked)}
                  className="w-5 h-5 accent-cfh-dark-green"
                />
                <label htmlFor="preview-checkbox" className="font-semibold text-gray-700 dark:text-slate-300">Vista Previa Gratuita</label>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Objetivos de Aprendizaje</label>
              <div className="space-y-2">
                {objectives.map((obj, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cfh-dark-green shrink-0" />
                    <input
                      type="text"
                      value={obj}
                      onChange={e => {
                        const newObjs = [...objectives];
                        newObjs[idx] = e.target.value;
                        setObjectives(newObjs);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm outline-none focus:border-cfh-dark-green"
                    />
                    <button onClick={() => setObjectives(objectives.filter((_, i) => i !== idx))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setObjectives([...objectives, ""])} className="text-sm font-bold text-cfh-dark-green hover:underline flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Agregar Objetivo
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Blocks Section */}
        <div className="space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map((block, index) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  index={index}
                  total={blocks.length}
                  updateBlock={handleUpdateBlock}
                  removeBlock={handleRemoveBlock}
                  moveUp={() => handleMoveBlock(index, 'up')}
                  moveDown={() => handleMoveBlock(index, 'down')}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Add Block Toolbar */}
        <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <p className="text-sm font-bold text-gray-500 dark:text-slate-400">Agregar nuevo bloque al final</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => handleAddBlock("TEXT")} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors border border-gray-200 dark:border-slate-700">
              <FileText className="w-4 h-4 text-blue-500" /> Texto
            </button>
            <button onClick={() => handleAddBlock("VIDEO")} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors border border-gray-200 dark:border-slate-700">
              <Play className="w-4 h-4 text-rose-500" /> Video
            </button>
            <button onClick={() => handleAddBlock("PDF")} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors border border-gray-200 dark:border-slate-700">
              <FileText className="w-4 h-4 text-purple-500" /> PDF
            </button>
            <button onClick={() => handleAddBlock("LINKS")} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors border border-gray-200 dark:border-slate-700">
              <LinkIcon className="w-4 h-4 text-amber-500" /> Enlaces
            </button>
            <button onClick={() => handleAddBlock("QUIZ")} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors border border-gray-200 dark:border-slate-700">
              <CheckSquare className="w-4 h-4 text-green-500" /> Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
