"use client";

import React, { useState, useRef, useMemo } from "react";
import { Upload, Image as ImageIcon, X, Check, Camera, Sparkles, RefreshCw, User, Palette, Compass, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageUploaderProps {
  value?: string | null;
  onChange?: (url: string | null, file?: File | null) => void;
  label?: string;
  description?: string;
  className?: string;
  hidePresets?: boolean;
}

export interface PresetAvatar {
  id: string;
  name: string;
  category: "personas" | "creativos" | "aventura" | "tech";
  url: string;
}

const AVATAR_CATEGORIES = [
  { id: "all", label: "Todos", icon: Sparkles },
  { id: "personas", label: "Personas", icon: User },
  { id: "creativos", label: "Creativos", icon: Palette },
  { id: "aventura", label: "Aventura", icon: Compass },
  { id: "tech", label: "Robots", icon: Bot },
] as const;

const PRESET_AVATARS: PresetAvatar[] = [
  // Personas & Profesionales (Lorelei & Avataaars)
  { id: "persona-1", name: "Sofía", category: "personas", url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Sofia&backgroundColor=ffd5dc" },
  { id: "persona-2", name: "Mateo", category: "personas", url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Mateo&backgroundColor=b6e3f4" },
  { id: "persona-3", name: "Valentina", category: "personas", url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Valentina&backgroundColor=c0aede" },
  { id: "persona-4", name: "Lucas", category: "personas", url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Lucas&backgroundColor=d1d4f9" },
  { id: "persona-5", name: "Camila", category: "personas", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Camila&backgroundColor=ffdfbf" },
  { id: "persona-6", name: "Diego", category: "personas", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Diego&backgroundColor=b6e3f4" },
  { id: "persona-7", name: "Isabella", category: "personas", url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Isabella&backgroundColor=ffd5dc" },
  { id: "persona-8", name: "Carlos", category: "personas", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos&backgroundColor=d1d4f9" },

  // Creativos & Minimalistas (Notionists & Micah)
  { id: "creativo-1", name: "Alex", category: "creativos", url: "https://api.dicebear.com/7.x/notionists/svg?seed=Alex&backgroundColor=ffd5dc" },
  { id: "creativo-2", name: "Elena", category: "creativos", url: "https://api.dicebear.com/7.x/notionists/svg?seed=Elena&backgroundColor=c0aede" },
  { id: "creativo-3", name: "Adrián", category: "creativos", url: "https://api.dicebear.com/7.x/micah/svg?seed=Adrian&backgroundColor=d1d4f9" },
  { id: "creativo-4", name: "Clara", category: "creativos", url: "https://api.dicebear.com/7.x/micah/svg?seed=Clara&backgroundColor=ffdfbf" },
  { id: "creativo-5", name: "Nora", category: "creativos", url: "https://api.dicebear.com/7.x/notionists/svg?seed=Nora&backgroundColor=b6e3f4" },
  { id: "creativo-6", name: "Julián", category: "creativos", url: "https://api.dicebear.com/7.x/micah/svg?seed=Julian&backgroundColor=ffd5dc" },

  // Aventura (Adventurer)
  { id: "aventura-1", name: "Leo", category: "aventura", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Leo&backgroundColor=b6e3f4" },
  { id: "aventura-2", name: "Maya", category: "aventura", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Maya&backgroundColor=ffd5dc" },
  { id: "aventura-3", name: "Félix", category: "aventura", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=c0aede" },
  { id: "aventura-4", name: "Luna", category: "aventura", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Luna&backgroundColor=d1d4f9" },
  { id: "aventura-5", name: "Kai", category: "aventura", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Kai&backgroundColor=ffdfbf" },
  { id: "aventura-6", name: "Zoe", category: "aventura", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Zoe&backgroundColor=b6e3f4" },

  // Tech & Robots (Bottts)
  { id: "tech-1", name: "Pixel", category: "tech", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Pixel&backgroundColor=b6e3f4" },
  { id: "tech-2", name: "Nova", category: "tech", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Nova&backgroundColor=c0aede" },
  { id: "tech-3", name: "Spark", category: "tech", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Spark&backgroundColor=ffd5dc" },
  { id: "tech-4", name: "Cyber", category: "tech", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Cyber&backgroundColor=d1d4f9" },
  { id: "tech-5", name: "Byte", category: "tech", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Byte&backgroundColor=ffdfbf" },
];

export default function ImageUploader({
  value,
  onChange,
  label = "Foto de perfil",
  description = "Sube una imagen cuadrada en formato JPG, PNG o WebP (max. 5MB).",
  className = "",
  hidePresets = false,
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<{ dataUrl: string; file: File }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const maxDim = 1024;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  });
                  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
                  resolve({ dataUrl, file: compressedFile });
                  return;
                }
                resolve({ dataUrl: e.target?.result as string, file });
              },
              "image/jpeg",
              0.9
            );
          } else {
            resolve({ dataUrl: e.target?.result as string, file });
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("El archivo seleccionado no es una imagen válida.");
      return;
    }

    try {
      const { dataUrl, file: processedFile } = await compressImage(file);
      setPreview(dataUrl);
      onChange?.(dataUrl, processedFile);
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreview(result);
        onChange?.(result, file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange?.(null, null);
  };

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [extraAvatars, setExtraAvatars] = useState<PresetAvatar[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const avatarsGridRef = useRef<HTMLDivElement>(null);

  const allAvailableAvatars = useMemo(() => {
    return [...extraAvatars, ...PRESET_AVATARS];
  }, [extraAvatars]);

  const filteredAvatars = useMemo(() => {
    if (selectedCategory === "all") return allAvailableAvatars;
    return allAvailableAvatars.filter((a) => a.category === selectedCategory);
  }, [allAvailableAvatars, selectedCategory]);

  const generateRandomAvatars = () => {
    setIsGenerating(true);
    const styles: Array<{ style: string; cat: PresetAvatar["category"] }> = [
      { style: "lorelei", cat: "personas" },
      { style: "avataaars", cat: "personas" },
      { style: "notionists", cat: "creativos" },
      { style: "micah", cat: "creativos" },
      { style: "adventurer", cat: "aventura" },
      { style: "bottts", cat: "tech" },
    ];
    const bgColors = ["b6e3f4", "c0aede", "ffd5dc", "d1d4f9", "ffdfbf"];

    const newOnes: PresetAvatar[] = Array.from({ length: 8 }).map((_, i) => {
      const pick = styles[Math.floor(Math.random() * styles.length)] ?? { style: "lorelei", cat: "personas" as const };
      const randomSeed = Math.random().toString(36).substring(2, 9);
      const randomBg = bgColors[Math.floor(Math.random() * bgColors.length)] ?? "b6e3f4";
      return {
        id: `random-${Date.now()}-${i}`,
        name: `Avatar ${randomSeed.substring(0, 4)}`,
        category: pick.cat,
        url: `https://api.dicebear.com/7.x/${pick.style}/svg?seed=${randomSeed}&backgroundColor=${randomBg}`,
      };
    });

    setTimeout(() => {
      setExtraAvatars((prev) => [...newOnes, ...prev].slice(0, 24));
      setIsGenerating(false);
      // Mandar al inicio para que el usuario vea de inmediato los nuevos avatares disponibles
      avatarsGridRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 250);
  };

  const handleSelectPreset = (presetUrl: string) => {
    setError(null);
    setPreview(presetUrl);
    onChange?.(presetUrl, null);
  };

  return (
    <div className={`w-full flex flex-col gap-6 ${className}`}>
      {/* File Upload Zone */}
      <div className="flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm transition-all">
        {/* Avatar Preview circle */}
        <div className="relative group shrink-0">
          <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-lg bg-gradient-to-br from-cfh-bg to-gray-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center relative">
            {preview ? (
              <img
                src={preview}
                alt="Vista previa de perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400 p-2 text-center">
                <Camera className="w-10 h-10 stroke-[1.5] text-cfh-dark-green/60 dark:text-cfh-light-green/60 mb-1" />
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 leading-tight">
                  {hidePresets ? "Rostro o torso" : "Sin foto"}
                </span>
              </div>
            )}
          </div>

          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              aria-label="Eliminar foto"
              className="absolute top-0 right-0 bg-rose-500 text-white rounded-full p-2 shadow-md hover:bg-rose-600 transition-colors cursor-pointer"
              title="Eliminar foto"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropzone & Actions */}
        <div className="flex-1 w-full">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleInputChange}
            className="hidden"
            id="avatar-upload-input"
          />

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 sm:p-7 text-center transition-all ${
              isDragging
                ? "border-cfh-dark-green dark:border-cfh-light-green bg-cfh-dark-green/5 dark:bg-emerald-950/20 scale-[1.01]"
                : "border-gray-200 dark:border-slate-700 hover:border-cfh-dark-green/60 dark:hover:border-cfh-light-green/60 hover:bg-gray-50/70 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-cfh-bg dark:bg-slate-800 flex items-center justify-center text-cfh-dark-green dark:text-cfh-light-green shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm sm:text-base font-bold text-cfh-text dark:text-slate-100">
                <span className="text-cfh-dark-green dark:text-cfh-light-green hover:underline">Haz clic para buscar</span> o arrastra tu archivo aquí
              </p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">{description}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Tip: Si abres el explorador, haz doble clic en la foto para seleccionarla de inmediato.</p>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-semibold text-rose-500 mt-2 text-center sm:text-left"
            >
              {error}
            </motion.p>
          )}
        </div>
      </div>

      {/* Preset Avatars Option o Aviso de Foto Real Profesional Obligatoria */}
      {hidePresets ? (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/25">
            <Camera className="w-6 h-6" />
          </div>
          <div className="space-y-2 text-xs flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm sm:text-base">
                Requisito obligatorio de imagen: Fotografía de Rostro o Torso Superior
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                Verificación Visual
              </span>
            </div>
            <p className="text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed text-xs sm:text-sm">
              Para garantizar autenticidad, confianza y profesionalismo frente a tus aprendices, tu foto de perfil debe ser una fotografía nítida donde se aprecie claramente tu <strong>rostro o plano de cabeza y hombros / torso superior</strong>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Rostro visible, nítido y de frente</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Plano de cabeza y hombros o cuerpo superior</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>No se admiten logotipos ni ilustraciones</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>No se admiten fotos sin persona reconocible</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-3xl p-6 sm:p-7 border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-slate-200">
                O elige un avatar prediseñado:
              </h4>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {AVATAR_CATEGORIES.map((cat) => {
                const isCatActive = selectedCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      isCatActive
                        ? "bg-cfh-dark-green text-white dark:bg-cfh-light-green dark:text-slate-950 shadow-sm scale-105"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Avatars Grid - Significantly larger and spacious */}
          <div
            ref={avatarsGridRef}
            className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-3 sm:gap-4 max-h-72 sm:max-h-80 md:max-h-96 overflow-y-auto overscroll-contain pr-1.5 p-1.5 scroll-smooth"
          >
            {filteredAvatars.map((preset) => {
              const isSelected = preview === preset.url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.url)}
                  className={`group relative aspect-square rounded-full overflow-hidden border-2 transition-all transform hover:scale-108 active:scale-95 cursor-pointer ${
                    isSelected
                      ? "border-cfh-dark-green dark:border-cfh-light-green ring-4 ring-cfh-dark-green/30 dark:ring-cfh-light-green/30 scale-105 shadow-lg"
                      : "border-gray-200/90 dark:border-slate-700 hover:border-cfh-dark-green/60 dark:hover:border-cfh-light-green/60 shadow-xs hover:shadow-md"
                  }`}
                  title={preset.name}
                >
                  <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" loading="lazy" />
                  {isSelected && (
                    <div className="absolute inset-0 bg-cfh-dark-green/35 dark:bg-cfh-light-green/30 flex items-center justify-center backdrop-blur-[1px]">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-cfh-dark-green dark:bg-cfh-light-green text-white dark:text-slate-950 flex items-center justify-center shadow-md">
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer info & Randomize button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-slate-800/80">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 font-medium">
              {filteredAvatars.length} avatares disponibles · Haz clic en uno para seleccionarlo
            </p>
            <button
              type="button"
              onClick={generateRandomAvatars}
              disabled={isGenerating}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-xs sm:text-sm font-bold text-cfh-dark-green dark:text-cfh-light-green transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
              <span>{isGenerating ? "Generando nuevos..." : "Generar más avatares"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

