"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  Download,
  Trash2,
  Eraser,
  PenTool,
  Maximize2,
  Minimize2,
  RotateCcw,
  Highlighter,
  Moon,
  Sun,
  School,
  Undo2,
  Redo2,
  Type,
  Palette,
} from "lucide-react";

interface CoachWhiteboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
}

type BoardTheme = "dark" | "chalkboard" | "light";

interface ColorOption {
  name: string;
  value: string;
}

const THEME_CONFIG: Record<
  BoardTheme,
  {
    name: string;
    bgColor: string;
    icon: any;
    colors: ColorOption[];
    defaultColor: string;
  }
> = {
  dark: {
    name: "Oscura",
    bgColor: "#0f172a", // Slate 900
    icon: Moon,
    defaultColor: "#f8fafc",
    colors: [
      { name: "Blanco", value: "#f8fafc" },
      { name: "Amarillo Neón", value: "#facc15" },
      { name: "Verde Lima", value: "#a3e635" },
      { name: "Verde Neón", value: "#4ade80" },
      { name: "Cian Neón", value: "#38bdf8" },
      { name: "Azul Eléctrico", value: "#60a5fa" },
      { name: "Púrpura Neón", value: "#c084fc" },
      { name: "Rosa Neón", value: "#f472b6" },
      { name: "Naranja Neón", value: "#fb923c" },
      { name: "Rojo Neón", value: "#f87171" },
    ],
  },
  chalkboard: {
    name: "Verde Tiza",
    bgColor: "#064e3b", // Deep Chalkboard Green
    icon: School,
    defaultColor: "#ffffff",
    colors: [
      { name: "Tiza Blanca", value: "#ffffff" },
      { name: "Tiza Amarilla", value: "#fef08a" },
      { name: "Tiza Menta", value: "#bbf7d0" },
      { name: "Tiza Verde", value: "#86efac" },
      { name: "Tiza Celeste", value: "#bae6fd" },
      { name: "Tiza Azul", value: "#93c5fd" },
      { name: "Tiza Lavanda", value: "#ddd6fe" },
      { name: "Tiza Rosa", value: "#fbcfe8" },
      { name: "Tiza Naranja", value: "#fed7aa" },
      { name: "Tiza Coral", value: "#fca5a5" },
    ],
  },
  light: {
    name: "Blanca",
    bgColor: "#ffffff", // Pure White
    icon: Sun,
    defaultColor: "#0f172a",
    colors: [
      { name: "Negro Grafito", value: "#0f172a" },
      { name: "Gris Oscuro", value: "#475569" },
      { name: "Azul Real", value: "#2563eb" },
      { name: "Azul Marino", value: "#1e40af" },
      { name: "Verde Bosque", value: "#059669" },
      { name: "Verde Esmeralda", value: "#10b981" },
      { name: "Rojo Carmesí", value: "#dc2626" },
      { name: "Púrpura", value: "#7c3aed" },
      { name: "Magenta", value: "#db2777" },
      { name: "Ámbar Cálido", value: "#d97706" },
    ],
  },
};

const STROKE_WIDTHS = [
  { label: "Fino", value: 2 },
  { label: "Medio", value: 5 },
  { label: "Grueso", value: 10 },
  { label: "Marcador", value: 20 },
];

export function CoachWhiteboardModal({
  isOpen,
  onClose,
  tierName,
}: CoachWhiteboardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Historial de deshacer (Undo) y rehacer (Redo)
  const historyRef = useRef<ImageData[]>([]);
  const redoHistoryRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Tema de la pizarra y herramientas
  const [boardTheme, setBoardTheme] = useState<BoardTheme>("dark");
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser" | "text">("pen");
  const [color, setColor] = useState("#f8fafc");
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Entrada de texto flotante
  const [activeTextInput, setActiveTextInput] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  // Bloquear el scroll del fondo (evita que la pantalla suba o baje al dibujar)
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Prevenir gestos de scroll/pull involuntarios en el canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, [isOpen]);

  // Detectar modo oscuro inicial del sistema/app
  useEffect(() => {
    if (typeof document !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark");
      const defaultTheme: BoardTheme = isDark ? "dark" : "light";
      setBoardTheme(defaultTheme);
      setColor(THEME_CONFIG[defaultTheme].defaultColor);
    }
  }, [isOpen]);

  const saveStateToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current.push(state);
      if (historyRef.current.length > 25) {
        historyRef.current.shift();
      }
      redoHistoryRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    } catch (e) {
      console.warn("Could not save canvas snapshot:", e);
    }
  }, []);

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      redoHistoryRef.current.push(currentState);
      if (redoHistoryRef.current.length > 25) {
        redoHistoryRef.current.shift();
      }

      const previousState = historyRef.current.pop();
      if (previousState) {
        ctx.putImageData(previousState, 0, 0);
      }
      setCanUndo(historyRef.current.length > 0);
      setCanRedo(true);
    } catch (e) {
      console.warn("Could not perform undo:", e);
    }
  }, []);

  const handleRedo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || redoHistoryRef.current.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current.push(currentState);
      if (historyRef.current.length > 25) {
        historyRef.current.shift();
      }

      const nextState = redoHistoryRef.current.pop();
      if (nextState) {
        ctx.putImageData(nextState, 0, 0);
      }
      setCanUndo(true);
      setCanRedo(redoHistoryRef.current.length > 0);
    } catch (e) {
      console.warn("Could not perform redo:", e);
    }
  }, []);

  // Atajos de teclado para deshacer (Ctrl+Z) y rehacer (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleUndo, handleRedo]);

  // Inicializar o redimensionar canvas
  const initCanvas = useCallback(
    (targetTheme: BoardTheme, preserveDrawing = false) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const prevData =
        preserveDrawing && canvas.width > 0 && canvas.height > 0
          ? canvas.toDataURL()
          : null;

      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = THEME_CONFIG[targetTheme].bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (prevData) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
        img.src = prevData;
      } else {
        historyRef.current = [];
        redoHistoryRef.current = [];
        setCanUndo(false);
        setCanRedo(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      initCanvas(boardTheme, false);
    }, 120);
    return () => clearTimeout(timer);
  }, [isOpen, isFullscreen, initCanvas]);

  const changeBoardTheme = (newTheme: BoardTheme) => {
    setBoardTheme(newTheme);
    setColor(THEME_CONFIG[newTheme].defaultColor);
    initCanvas(newTheme, false);
  };

  const getPointerPos = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      if (e.touches.length > 0 && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const commitText = useCallback((textOverride?: string) => {
    setActiveTextInput((current) => {
      if (!current) return null;
      const textVal = textOverride !== undefined ? textOverride : current.text;
      if (!textVal || !textVal.trim()) return null;

      const canvas = canvasRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      saveStateToHistory();

      const fontSize = strokeWidth === 2 ? 18 : strokeWidth === 5 ? 24 : strokeWidth === 10 ? 32 : 44;
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = "source-over";

      const lines = textVal.split("\n");
      const lineHeight = fontSize * 1.3;
      lines.forEach((line, index) => {
        ctx.fillText(line, current.x, current.y + index * lineHeight);
      });

      return null;
    });
  }, [color, strokeWidth, saveStateToHistory]);

  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tool === "text") {
      const { x, y } = getPointerPos(e);
      if (activeTextInput) {
        commitText();
      }
      setActiveTextInput({ x, y, text: "" });
      return;
    }

    if (activeTextInput) {
      commitText();
    }

    saveStateToHistory();

    const { x, y } = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || tool === "text") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPointerPos(e);

    if (tool === "eraser") {
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = THEME_CONFIG[boardTheme].bgColor;
      ctx.lineWidth = strokeWidth * 4;
    } else if (tool === "highlighter") {
      // Resaltador semitransparente y brilloso/fluorescente como marcador real
      ctx.globalAlpha = boardTheme === "light" ? 0.45 : 0.6;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = boardTheme === "light" ? 4 : 14;
      ctx.lineWidth = Math.max(strokeWidth * 3.5, 18);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = boardTheme === "light" ? "multiply" : "lighter";
    } else {
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveStateToHistory();
    ctx.fillStyle = THEME_CONFIG[boardTheme].bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const downloadWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = image;
    a.download = `pizarra-cfh-${boardTheme}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 touch-none overscroll-none select-none overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-xs"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden touch-none overscroll-none transition-all duration-300 ${
          isFullscreen ? "w-full h-full rounded-none" : "w-full max-w-5xl h-[88vh]"
        }`}
      >
        {/* Barra superior */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50/90 dark:bg-slate-850 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-slate-100 leading-none">
                  Pizarra Virtual Interactiva
                </h3>
                <span className="text-[10px] uppercase font-black tracking-widest bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  {tierName}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 hidden sm:block">
                Dibuja diagramas, conceptos y resuelve dudas en tiempo real con tus aprendices.
              </p>
            </div>
          </div>

          {/* Selector de Estilo de Pizarra (Oscura, Verde Tiza, Blanca) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center bg-gray-200/80 dark:bg-slate-800 p-1 rounded-xl">
              {(["dark", "chalkboard", "light"] as BoardTheme[]).map((thm) => {
                const conf = THEME_CONFIG[thm];
                const Icon = conf.icon;
                const isSelected = boardTheme === thm;
                return (
                  <button
                    key={thm}
                    type="button"
                    onClick={() => changeBoardTheme(thm)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs"
                        : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                    title={`Cambiar a Pizarra ${conf.name}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{conf.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="h-5 w-px bg-gray-200 dark:bg-slate-700 mx-0.5 hidden sm:block" />

            <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Deshacer último trazo (Atrás - Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className="p-2 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Rehacer trazo (Adelante - Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={downloadWhiteboard}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Descargar pizarra como imagen"
            >
              <Download className="w-4 h-4" />
              <span className="hidden lg:inline">Descargar</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
              title={isFullscreen ? "Restaurar tamaño" : "Pantalla completa"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Herramientas de Dibujo */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-900/95 border-b border-gray-200/90 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Herramientas: Pluma, Resaltador, Borrador, Texto */}
            <div className="flex items-center bg-gray-200/70 dark:bg-slate-800/90 p-1 rounded-2xl border border-gray-300/40 dark:border-slate-700/60 shadow-2xs">
              <button
                type="button"
                onClick={() => setTool("pen")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  tool === "pen"
                    ? "bg-cfh-dark-green text-white shadow-sm ring-1 ring-cfh-light-green/30"
                    : "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-slate-700/60"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Pluma</span>
              </button>

              <button
                type="button"
                onClick={() => setTool("highlighter")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  tool === "highlighter"
                    ? "bg-cfh-dark-green text-white shadow-sm ring-1 ring-cfh-light-green/30"
                    : "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-slate-700/60"
                }`}
                title="Resaltador semitransparente y brilloso"
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span>Resaltador</span>
              </button>

              <button
                type="button"
                onClick={() => setTool("text")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  tool === "text"
                    ? "bg-cfh-dark-green text-white shadow-sm ring-1 ring-cfh-light-green/30"
                    : "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-slate-700/60"
                }`}
                title="Escribir texto en la pizarra"
              >
                <Type className="w-3.5 h-3.5" />
                <span>Texto</span>
              </button>

              <button
                type="button"
                onClick={() => setTool("eraser")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  tool === "eraser"
                    ? "bg-cfh-dark-green text-white shadow-sm ring-1 ring-cfh-light-green/30"
                    : "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-slate-700/60"
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Borrador</span>
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300/60 dark:bg-slate-700/80 mx-0.5 hidden sm:block" />

            {/* Paleta de colores acorde al tema de la pizarra + Selector libre de color */}
            {tool !== "eraser" && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-gray-200/50 dark:bg-slate-800/60 px-2.5 py-1 rounded-2xl border border-gray-300/30 dark:border-slate-700/40">
                {THEME_CONFIG[boardTheme].colors.map((c) => {
                  const isSelected = color.toLowerCase() === c.value.toLowerCase();
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`relative w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? "scale-115 ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-sm"
                          : "opacity-80 hover:opacity-100 hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    >
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-black/60 dark:bg-white/90" />
                      )}
                    </button>
                  );
                })}

                <div className="h-4 w-px bg-gray-300/60 dark:bg-slate-700/80 mx-0.5" />

                {/* Selector de color personalizado / libre */}
                <label
                  className={`relative w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full cursor-pointer flex items-center justify-center transition-all duration-200 border border-gray-300 dark:border-slate-600 shadow-xs group ${
                    !THEME_CONFIG[boardTheme].colors.some((c) => c.value.toLowerCase() === color.toLowerCase())
                      ? "scale-115 ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-md"
                      : "opacity-85 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{
                    background: !THEME_CONFIG[boardTheme].colors.some((c) => c.value.toLowerCase() === color.toLowerCase())
                      ? color
                      : "conic-gradient(from 180deg at 50% 50%, #ef4444 0deg, #f59e0b 60deg, #10b981 120deg, #06b6d4 180deg, #3b82f6 240deg, #a855f7 300deg, #ef4444 360deg)",
                  }}
                  title="Elegir más colores (Espectro completo)"
                >
                  <Palette className="w-3 h-3 text-white drop-shadow-md pointer-events-none group-hover:rotate-12 transition-transform" />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Grosor de línea con preview visual de trazo */}
            <div className="flex items-center gap-1 bg-gray-200/70 dark:bg-slate-800/90 p-1 rounded-2xl border border-gray-300/40 dark:border-slate-700/60 shadow-2xs">
              {STROKE_WIDTHS.map((sw) => {
                const isSelected = strokeWidth === sw.value;
                return (
                  <button
                    key={sw.value}
                    type="button"
                    onClick={() => setStrokeWidth(sw.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs font-black"
                        : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100"
                    }`}
                  >
                    <span
                      className="rounded-full bg-current shrink-0"
                      style={{
                        width: sw.value === 2 ? 4 : sw.value === 5 ? 6 : sw.value === 10 ? 8 : 10,
                        height: sw.value === 2 ? 4 : sw.value === 5 ? 6 : sw.value === 10 ? 8 : 10,
                      }}
                    />
                    <span>{sw.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Botón Limpiar con estilo de acción peligrosa cuidada */}
            <button
              type="button"
              onClick={clearCanvas}
              className="px-3.5 py-1.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              title="Borrar todo el contenido"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        {/* Lienzo Canvas (con fondo dinámico según estilo seleccionado) */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden cursor-crosshair select-none touch-none overscroll-none"
          style={{ backgroundColor: THEME_CONFIG[boardTheme].bgColor }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={(e) => {
              e.preventDefault();
              startDrawing(e);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              draw(e);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              stopDrawing();
            }}
            className="w-full h-full block touch-none overscroll-none"
          />

          {/* Editor flotante de texto para escribir notas y títulos en la pizarra */}
          {activeTextInput && (
            <div
              className="absolute z-30"
              style={{
                left: Math.max(12, Math.min(activeTextInput.x, (containerRef.current?.clientWidth || 400) - 260)),
                top: Math.max(12, Math.min(activeTextInput.y - 10, (containerRef.current?.clientHeight || 400) - 130)),
              }}
            >
              <div className="bg-white/95 dark:bg-slate-900/95 border-2 border-emerald-500 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-2 min-w-[240px] animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-0.5">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black">
                    <Type className="w-3 h-3" /> Escribir en pizarra
                  </span>
                  <span className="text-[10px]">Enter para colocar</span>
                </div>
                <input
                  type="text"
                  autoFocus
                  value={activeTextInput.text}
                  onChange={(e) =>
                    setActiveTextInput({ ...activeTextInput, text: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitText();
                    } else if (e.key === "Escape") {
                      setActiveTextInput(null);
                    }
                  }}
                  placeholder="Escribe tu texto aquí..."
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  style={{ color: boardTheme === "light" && color === "#ffffff" ? "#0f172a" : color }}
                />
                <div className="flex items-center justify-end gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveTextInput(null)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => commitText()}
                    className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                  >
                    Colocar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
