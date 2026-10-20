"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Save,
  X,
  ChevronDown,
  ShieldAlert,
  Layers,
} from "lucide-react";
import {
  getCoachAvailability,
  saveCoachAvailability,
  AvailabilityRuleDTO,
} from "@/app/actions/availability";

const WEEKDAYS = [
  { id: 1, name: "Lunes", short: "Lun" },
  { id: 2, name: "Martes", short: "Mar" },
  { id: 3, name: "Miércoles", short: "Mié" },
  { id: 4, name: "Jueves", short: "Jue" },
  { id: 5, name: "Viernes", short: "Vie" },
  { id: 6, name: "Sábado", short: "Sáb" },
  { id: 0, name: "Domingo", short: "Dom" },
];

const TIMEZONES = [
  { value: "America/Mexico_City", city: "Ciudad de México", offset: "GMT-6", label: "Ciudad de México (GMT-6)" },
  { value: "America/Bogota", city: "Bogotá / Lima / Quito", offset: "GMT-5", label: "Bogotá / Lima / Quito (GMT-5)" },
  { value: "America/Santiago", city: "Santiago de Chile", offset: "GMT-4", label: "Santiago de Chile (GMT-4)" },
  { value: "America/Buenos_Aires", city: "Buenos Aires", offset: "GMT-3", label: "Buenos Aires (GMT-3)" },
  { value: "America/New_York", city: "Nueva York / Miami", offset: "EST/EDT", label: "Nueva York / Miami (EST/EDT)" },
  { value: "America/Los_Angeles", city: "Los Ángeles / Tijuana", offset: "PST/PDT", label: "Los Ángeles / Tijuana (PST/PDT)" },
  { value: "Europe/Madrid", city: "Madrid / Barcelona", offset: "CET/CEST", label: "Madrid / Barcelona (CET/CEST)" },
];

function TimezoneSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const selectedTz = TIMEZONES.find((tz) => tz.value === value) || {
    value,
    city: value,
    offset: "UTC",
    label: value,
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-80">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full px-4 py-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer shadow-xs ${
          open
            ? "border-cfh-dark-green dark:border-cfh-light-green ring-2 ring-cfh-dark-green/20 dark:ring-cfh-light-green/20 bg-white dark:bg-slate-800"
            : "border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/90 hover:border-cfh-dark-green/50 dark:hover:border-cfh-light-green/50"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Globe className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green shrink-0" />
          <span className="text-sm font-bold text-gray-800 dark:text-slate-100 truncate">
            {selectedTz.city}
          </span>
          <span className="px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70 shrink-0">
            {selectedTz.offset}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-cfh-dark-green dark:text-cfh-light-green" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 left-0 sm:left-auto sm:w-88 top-full mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700/80 py-2 z-50 overflow-hidden divide-y divide-gray-50 dark:divide-slate-800/70"
          >
            {TIMEZONES.map((tz) => {
              const isSelected = tz.value === value;
              return (
                <button
                  key={tz.value}
                  type="button"
                  onClick={() => {
                    onChange(tz.value);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-emerald-50/90 dark:bg-emerald-950/50 text-cfh-dark-green dark:text-cfh-light-green"
                      : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-600"
                      }`}
                    />
                    <span className={`text-xs sm:text-sm truncate ${isSelected ? "font-extrabold" : "font-semibold"}`}>
                      {tz.city}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                        isSelected
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700"
                      }`}
                    >
                      {tz.offset}
                    </span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper: Convertir minutos a string "HH:MM"
function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// Helper: Convertir string "HH:MM" a minutos del día
function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Opciones de horas para selects (cada 30 min)
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (let m of [0, 30]) {
    const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const label = `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
    TIME_OPTIONS.push({ value: timeStr, label });
  }
}
TIME_OPTIONS.push({ value: "24:00", label: "12:00 AM (Fin del día)" });

// Componente de selección de hora con menú flotante acotado y estilizado (no se desborda)
function TimeSelect({
  value,
  onChange,
  options = TIME_OPTIONS,
  className = "",
}: {
  value: string;
  onChange: (val: string) => void;
  options?: { value: string; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const selectedOpt = options.find((opt) => opt.value === value) || {
    value,
    label: value,
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-w-[125px] px-3 py-1.5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-200 hover:border-cfh-dark-green dark:hover:border-cfh-light-green focus:outline-none focus:ring-2 focus:ring-cfh-dark-green/20 flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-2xs"
      >
        <span>{selectedOpt.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-400 transition-transform ${open ? "rotate-180 text-cfh-dark-green dark:text-cfh-light-green" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-44 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1.5 z-40 text-xs font-semibold text-gray-700 dark:text-slate-200 divide-y divide-gray-50 dark:divide-slate-700 scrollbar-thin">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 hover:bg-emerald-50 dark:hover:bg-slate-700 hover:text-emerald-900 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-between ${
                opt.value === value ? "bg-cfh-bg dark:bg-slate-700/80 text-cfh-dark-green dark:text-cfh-light-green font-bold" : ""
              }`}
            >
              <span>{opt.label}</span>
              {opt.value === value && <span className="text-cfh-dark-green dark:text-cfh-light-green font-extrabold text-xs sm:text-sm">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface DaySlot {
  id: string;
  start: string; // "09:00"
  end: string; // "18:00"
}

interface DayConfig {
  weekday: number;
  enabled: boolean;
  slots: DaySlot[];
}

export default function CoachAvailabilityPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const locPrefix = locale ? '/' + locale : '';
  const makeHref = (p: string): string => {
    if (!p) return locPrefix || '/';
    if (p === '/') return locPrefix || '/';
    if (locPrefix && (p === locPrefix || p.startsWith(locPrefix + '/'))) return p;
    const match = p.match(/^\/([a-z]{2})(?:\/|$)/);
    if (match) return p;
    return `${locPrefix}${p.startsWith('/') ? p : `/${p}`}`;
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezone, setTimezone] = useState("America/Mexico_City");
  const [schedule, setSchedule] = useState<DayConfig[]>([]);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Estados para configuración de Llamada de Prueba Gratuita (15 min)
  const [freeIntroEnabled, setFreeIntroEnabled] = useState(true);
  const [freeIntroMinutes, setFreeIntroMinutes] = useState(15);
  const [freeIntroWeekdays, setFreeIntroWeekdays] = useState<number[]>([1, 2, 3, 4, 5]); // días permitidos (por defecto Lun-Vie)
  const [freeIntroStart, setFreeIntroStart] = useState("09:00");
  const [freeIntroEnd, setFreeIntroEnd] = useState("18:00");

  // Inicializar días con horario por defecto (Lun-Vie 9:00 a 18:00)
  const initializeDefaultSchedule = useCallback(() => {
    return WEEKDAYS.map((day) => {
      const isWeekday = day.id >= 1 && day.id <= 5;
      return {
        weekday: day.id,
        enabled: isWeekday,
        slots: isWeekday
          ? [{ id: `${day.id}-0`, start: "09:00", end: "18:00" }]
          : [{ id: `${day.id}-0`, start: "10:00", end: "14:00" }],
      };
    });
  }, []);

  const loadAvailability = useCallback(async () => {
    try {
      const res = await getCoachAvailability();
      if (!res.authenticated) {
        router.push("/?auth=login");
        return;
      }

      if ((res as any).isStudent) {
        router.push("/dashboard#agenda");
        return;
      }

      if (res.needsOnboarding) {
        router.push("/coach/onboarding");
        return;
      }

      if (!res.success) {
        return;
      }

      if (res.timezone) {
        setTimezone(res.timezone);
      }

      if (res.freeIntroEnabled !== undefined) {
        setFreeIntroEnabled(res.freeIntroEnabled);
      }
      if (res.freeIntroMinutes !== undefined) {
        setFreeIntroMinutes(res.freeIntroMinutes);
      }
      if (res.freeIntroWeekdays && res.freeIntroWeekdays.length > 0) {
        setFreeIntroWeekdays(res.freeIntroWeekdays);
      }
      if (res.freeIntroStartMinute !== undefined && res.freeIntroStartMinute !== null) {
        setFreeIntroStart(minutesToTimeString(res.freeIntroStartMinute));
      }
      if (res.freeIntroEndMinute !== undefined && res.freeIntroEndMinute !== null) {
        setFreeIntroEnd(res.freeIntroEndMinute >= 1440 ? "24:00" : minutesToTimeString(res.freeIntroEndMinute));
      }

      const defaultSched = initializeDefaultSchedule();

      if (res.rules && res.rules.length > 0) {
        // Mapear reglas de la BD al estado
        const mapped = defaultSched.map((day) => {
          const rulesForDay = res.rules.filter((r) => r.weekday === day.weekday && r.isActive);
          if (rulesForDay.length > 0) {
            return {
              weekday: day.weekday,
              enabled: true,
              slots: rulesForDay.map((r, i) => ({
                id: `${day.weekday}-${i}`,
                start: minutesToTimeString(r.startMinute),
                end: r.endMinute >= 1440 ? "24:00" : minutesToTimeString(r.endMinute),
              })),
            };
          }
          return {
            ...day,
            enabled: false,
          };
        });
        setSchedule(mapped);
      } else {
        setSchedule(defaultSched);
      }
    } catch (err) {
      console.error("Error cargando disponibilidad:", err);
      setSchedule(initializeDefaultSchedule());
    } finally {
      setLoading(false);
    }
  }, [router, initializeDefaultSchedule]);

  // Helper de Detección de Conflictos / Solapamientos en Tiempo Real (Nielsen #5)
  const getDayConflicts = useCallback((dayConfig: DayConfig) => {
    if (!dayConfig.enabled || !freeIntroEnabled) return [];
    if (!freeIntroWeekdays.includes(dayConfig.weekday)) return [];

    const introStartMin = timeStringToMinutes(freeIntroStart);
    const introEndMin = freeIntroEnd === "24:00" ? 1440 : timeStringToMinutes(freeIntroEnd);
    const conflicts: string[] = [];

    dayConfig.slots.forEach((slot, idx) => {
      const slotStart = timeStringToMinutes(slot.start);
      const slotEnd = slot.end === "24:00" ? 1440 : timeStringToMinutes(slot.end);

      // Existe solapamiento si Max(startA, startB) < Min(endA, endB)
      const overlapStart = Math.max(slotStart, introStartMin);
      const overlapEnd = Math.min(slotEnd, introEndMin);

      if (overlapStart < overlapEnd) {
        const slotLabel = dayConfig.slots.length > 1 ? `El horario ${slot.start} - ${slot.end}` : "Este horario";
        conflicts.push(`${slotLabel} coincide con el horario de tu sesión gratuita (${freeIntroStart} - ${freeIntroEnd})`);
      }
    });

    return conflicts;
  }, [freeIntroEnabled, freeIntroWeekdays, freeIntroStart, freeIntroEnd]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // Toggle para activar/desactivar un día completo con sincronización bidireccional
  const handleToggleDay = (weekday: number) => {
    setSchedule((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day;
        const willEnable = !day.enabled;
        return {
          ...day,
          enabled: willEnable,
          slots:
            day.slots.length > 0
              ? day.slots
              : [{ id: `${weekday}-0`, start: "09:00", end: "18:00" }],
        };
      })
    );

    // Sincronización automática: Si el Coach desactiva/bloquea el día completo,
    // propagar automáticamente la regla a la disponibilidad de clase gratuita para evitar traslapes.
    setFreeIntroWeekdays((prev) => {
      const currentDay = schedule.find((d) => d.weekday === weekday);
      const isCurrentlyEnabled = currentDay?.enabled ?? false;
      if (isCurrentlyEnabled) {
        // Al desactivar el día, sacarlo de los días disponibles de prueba gratuita
        return prev.filter((d) => d !== weekday);
      }
      return prev;
    });
  };

  // Cambiar inicio o fin de un slot
  const handleSlotChange = (
    weekday: number,
    slotIndex: number,
    field: "start" | "end",
    value: string
  ) => {
    setSchedule((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day;
        const currentSlot = day.slots[slotIndex];
        if (!currentSlot) return day;
        const updatedSlot: DaySlot = {
          id: currentSlot.id,
          start: field === "start" ? value : currentSlot.start,
          end: field === "end" ? value : currentSlot.end,
        };
        const newSlots = [...day.slots];
        newSlots[slotIndex] = updatedSlot;
        return { ...day, slots: newSlots };
      })
    );
  };

  // Agregar un bloque horario adicional para un día
  const handleAddSlot = (weekday: number) => {
    setSchedule((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day;
        const newId = `${weekday}-${Date.now()}`;
        return {
          ...day,
          slots: [...day.slots, { id: newId, start: "14:00", end: "18:00" }],
        };
      })
    );
  };

  // Eliminar un bloque horario
  const handleRemoveSlot = (weekday: number, slotIndex: number) => {
    setSchedule((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day;
        const newSlots = day.slots.filter((_, i) => i !== slotIndex);
        return {
          ...day,
          slots: newSlots,
          enabled: newSlots.length > 0 ? day.enabled : false,
        };
      })
    );
  };

  // Guardar configuración en Base de Datos
  const handleSave = async () => {
    setSaving(true);
    setNotification(null);

    // Construir reglas aplanadas para Prisma
    const rulesToSave: AvailabilityRuleDTO[] = [];
    let hasValidationErr = false;

    for (const day of schedule) {
      if (!day.enabled) continue;

      for (const slot of day.slots) {
        const startMin = timeStringToMinutes(slot.start);
        const endMin = slot.end === "24:00" ? 1440 : timeStringToMinutes(slot.end);

        if (endMin <= startMin) {
          const dayName = WEEKDAYS.find((w) => w.id === day.weekday)?.name;
          setNotification({
            type: "error",
            message: `En el día ${dayName}, la hora de fin (${slot.end}) debe ser mayor a la hora de inicio (${slot.start}).`,
          });
          const el = document.getElementById(`day-slot-${day.weekday}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          hasValidationErr = true;
          break;
        }

        rulesToSave.push({
          weekday: day.weekday,
          startMinute: startMin,
          endMinute: endMin,
          isActive: true,
        });
      }
      if (hasValidationErr) break;
    }

    if (hasValidationErr) {
      setSaving(false);
      return;
    }

    // Validar horarios de prueba gratuita si está activada
    let introStartMin: number | null = null;
    let introEndMin: number | null = null;
    if (freeIntroEnabled) {
      if (freeIntroWeekdays.length === 0) {
        setNotification({
          type: "error",
          message: "Debes seleccionar al menos un día en el que ofrezcas la sesión gratuita.",
        });
        setSaving(false);
        return;
      }

      introStartMin = timeStringToMinutes(freeIntroStart);
      introEndMin = freeIntroEnd === "24:00" ? 1440 : timeStringToMinutes(freeIntroEnd);

      if (introEndMin <= introStartMin) {
        setNotification({
          type: "error",
          message: "En la sesión gratuita, la hora de fin debe ser mayor a la hora de inicio.",
        });
        setSaving(false);
        return;
      }
    }

    try {
      const result = await saveCoachAvailability({
        rules: rulesToSave,
        timezone,
        freeIntroEnabled,
        freeIntroMinutes,
        freeIntroWeekdays,
        freeIntroWeekday: freeIntroWeekdays.length === 1 ? freeIntroWeekdays[0] : null,
        freeIntroStartMinute: introStartMin,
        freeIntroEndMinute: introEndMin,
      });

      if (!result.success) {
        setNotification({
          type: "error",
          message: result.error || "No se pudo guardar la disponibilidad.",
        });
      } else {
        setNotification({
          type: "success",
          message: "¡Tus horarios disponibles se han guardado exitosamente!",
        });
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err?.message || "Ocurrió un error inesperado al guardar.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-cfh-dark-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 dark:text-slate-400 font-medium">Cargando tus horarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Barra superior de navegación */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            href={makeHref("/coach/dashboard")}
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-slate-300 hover:text-cfh-dark-green dark:hover:text-cfh-light-green transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Portal de Coach
          </Link>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cfh-light-green/20 dark:bg-cfh-light-green/10 text-cfh-dark-green dark:text-cfh-light-green uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Agenda & Disponibilidad
          </span>
        </div>

        {/* Encabezado Principal */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-cfh-dark-green dark:text-white tracking-tight flex items-center gap-3">
              <Calendar className="w-8 h-8 text-cfh-light-green" />
              Horarios Disponibles para Clases
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-xl">
              Configura los días y franjas horarias en las que los estudiantes pueden reservar
              sesiones individuales y la sesión inicial gratuita de 15 min.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex px-6 py-3.5 bg-cfh-dark-green hover:bg-[#061528] dark:bg-cfh-dark-green dark:hover:bg-slate-800 text-white font-extrabold rounded-2xl shadow-lg shadow-cfh-dark-green/30 transition-all disabled:opacity-50 items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Guardar Horarios</span>
              </>
            )}
          </button>
        </div>

        {/* Notificación flotante visible en todo momento */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-6 right-6 z-50 px-5 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 max-w-md ${
                notification.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 shadow-emerald-500/10"
                  : "bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 shadow-rose-500/10"
              }`}
            >
              {notification.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              )}
              <span className="text-sm font-semibold flex-1">{notification.message}</span>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zona Horaria */}
        <div className="relative z-30 bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cfh-bg dark:bg-slate-800 flex items-center justify-center text-cfh-dark-green dark:text-cfh-light-green">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Tu Zona Horaria</h3>
              <p className="text-xs text-gray-400 dark:text-slate-400">
                Los horarios se ajustarán automáticamente al huso horario de tus alumnos.
              </p>
            </div>
          </div>

          <TimezoneSelect value={timezone} onChange={setTimezone} />
        </div>

        {/* Configuración de Sesión Gratuita de Prueba (15 min) - Principios Gestalt: Región Común y Semejanza Cromática */}
        <div className="bg-gradient-to-br from-purple-50/40 via-white to-purple-50/20 dark:from-purple-950/20 dark:via-slate-900 dark:to-purple-950/10 rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-purple-200/80 dark:border-purple-800/60 space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100 dark:border-purple-900/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Horario de Clase Gratuita / Prueba (15 min)
                  </h2>
                  <span className="text-xs uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Esquema Especial
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Franja horaria exclusiva para llamadas introductorias. Se sincroniza automáticamente con tus días regulares.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                {freeIntroEnabled ? "Prueba Gratuita Activa" : "Desactivada"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={freeIntroEnabled}
                  onChange={(e) => setFreeIntroEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>

          {freeIntroEnabled ? (
            <div className="space-y-5 pt-2">
              {/* Selección de días permitidos (toggle de cada día) */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-200">
                    Días en los que aceptas llamadas de prueba gratuita
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFreeIntroWeekdays([1, 2, 3, 4, 5])}
                      className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 transition-colors"
                    >
                      Lun a Vie
                    </button>
                    <span className="text-gray-300 dark:text-slate-600 text-xs">•</span>
                    <button
                      type="button"
                      onClick={() => setFreeIntroWeekdays([0, 1, 2, 3, 4, 5, 6])}
                      className="text-xs sm:text-sm font-bold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Todos
                    </button>
                    <span className="text-gray-300 dark:text-slate-600 text-xs">•</span>
                    <button
                      type="button"
                      onClick={() => setFreeIntroWeekdays([])}
                      className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-colors"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
                  {WEEKDAYS.map((day) => {
                    const isSelected = freeIntroWeekdays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          setFreeIntroWeekdays((prev) =>
                            isSelected
                              ? prev.filter((d) => d !== day.id)
                              : [...prev, day.id].sort((a, b) => a - b)
                          );
                        }}
                        className={`px-3 py-2.5 rounded-2xl text-xs font-extrabold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-600/30 scale-100"
                            : "bg-gray-50 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <span>{day.short}</span>
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-gray-200/80 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                          }`}
                        >
                          {isSelected ? "Sí" : "No"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs sm:text-sm text-gray-400 dark:text-slate-400">
                  Haz clic en cada día para activar o desactivar la disponibilidad de sesiones gratuitas.
                </p>
              </div>

              {/* Franja horaria dedicada para llamadas de prueba */}
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-200">
                  Franja horaria reservada para llamadas de 15 min en los días seleccionados
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-semibold text-gray-400 dark:text-slate-400">De:</span>
                  <TimeSelect
                    value={freeIntroStart}
                    onChange={(val) => setFreeIntroStart(val)}
                    options={TIME_OPTIONS.filter((t) => t.value !== "24:00")}
                  />

                  <span className="text-xs font-semibold text-gray-400 dark:text-slate-400">A:</span>
                  <TimeSelect
                    value={freeIntroEnd}
                    onChange={(val) => setFreeIntroEnd(val)}
                    options={TIME_OPTIONS}
                  />

                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 ml-auto">
                    Intervalos de 15 minutos
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-400 dark:text-slate-400">
                  En los días marcados con &quot;Sí&quot;, los alumnos podrán agendar sesiones de 15 min dentro de este intervalo.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400">
              Has desactivado la llamada de prueba de 15 minutos. Los alumnos solo verán tus sesiones de pago regulares de 60 min.
            </div>
          )}
        </div>

        {/* Matriz de Días de la Semana */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-800 space-y-6">
          <div className="border-b border-gray-100 dark:border-slate-800 pb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cfh-dark-green dark:text-cfh-light-green" />
              Horario Semanal Recurrente
            </h2>
            <span className="text-xs text-gray-400 dark:text-slate-400 font-medium">
              Activa los días en los que atiendes
            </span>
          </div>

          <div className="space-y-4 divide-y divide-gray-100 dark:divide-slate-800">
            {schedule.map((dayConfig) => {
              const dayMeta = WEEKDAYS.find((w) => w.id === dayConfig.weekday)!;
              const conflicts = getDayConflicts(dayConfig);
              const isFreeIntroDay = freeIntroEnabled && freeIntroWeekdays.includes(dayConfig.weekday);

              return (
                <div
                  key={dayConfig.weekday}
                  id={`day-slot-${dayConfig.weekday}`}
                  className={`pt-4 first:pt-0 transition-all ${
                    dayConfig.enabled ? "opacity-100" : "opacity-60"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Switch del Día e Indicadores */}
                    <div className="flex flex-col gap-1 w-44 shrink-0">
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dayConfig.enabled}
                            onChange={() => handleToggleDay(dayConfig.weekday)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cfh-dark-green"></div>
                        </label>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{dayMeta.name}</span>
                      </div>

                      {/* Badge indicador de sincronización con prueba gratuita */}
                      {dayConfig.enabled && isFreeIntroDay && (
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800 self-start mt-0.5">
                          <Sparkles className="w-3 h-3" />
                          <span>Prueba: {freeIntroStart} - {freeIntroEnd}</span>
                        </div>
                      )}
                    </div>

                    {/* Bloques de Horarios */}
                    <div className="flex-1 space-y-2.5">
                      {dayConfig.enabled ? (
                        <>
                          {dayConfig.slots.map((slot, slotIdx) => (
                            <div
                              key={slot.id || slotIdx}
                              className="flex flex-wrap items-center gap-2.5 bg-gray-50/70 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-gray-100 dark:border-slate-700"
                            >
                              <span className="text-xs font-semibold text-gray-400 dark:text-slate-400 pl-1">De</span>
                              <TimeSelect
                                value={slot.start}
                                onChange={(val) =>
                                  handleSlotChange(
                                    dayConfig.weekday,
                                    slotIdx,
                                    "start",
                                    val
                                  )
                                }
                                options={TIME_OPTIONS.filter((t) => t.value !== "24:00")}
                              />

                              <span className="text-xs font-semibold text-gray-400 dark:text-slate-400">a</span>
                              <TimeSelect
                                value={slot.end}
                                onChange={(val) =>
                                  handleSlotChange(
                                    dayConfig.weekday,
                                    slotIdx,
                                    "end",
                                    val
                                  )
                                }
                                options={TIME_OPTIONS}
                              />

                              {dayConfig.slots.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSlot(dayConfig.weekday, slotIdx)}
                                  className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors ml-auto"
                                  title="Eliminar bloque"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}

                          {/* Alerta reactiva de solapamiento en tiempo real (Nielsen Usability #5) */}
                          {conflicts.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="font-bold">Aviso de coincidencia de agenda:</span>
                                {conflicts.map((c, i) => (
                                  <p key={i} className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                                    • {c}.
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="py-2 text-xs font-medium text-gray-400 dark:text-slate-500 italic">
                          No disponible (Día no laborable y bloqueado en ambos esquemas)
                        </div>
                      )}
                    </div>

                    {/* Botón para agregar otro bloque en el mismo día */}
                    {dayConfig.enabled && dayConfig.slots.length < 3 && (
                      <button
                        type="button"
                        onClick={() => handleAddSlot(dayConfig.weekday)}
                        className="px-3 py-2 text-xs font-bold text-cfh-dark-green dark:text-cfh-light-green hover:bg-cfh-bg dark:hover:bg-slate-800 rounded-xl border border-dashed border-cfh-dark-green/30 dark:border-cfh-light-green/30 flex items-center gap-1.5 transition-colors self-start md:self-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Añadir turno
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
