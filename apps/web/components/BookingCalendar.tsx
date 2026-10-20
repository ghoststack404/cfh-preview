"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from './TranslationProvider';

interface BookingCalendarProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
  availableTimes: string[];
  isLoadingTimes?: boolean;
  coachTimezone?: string;
  allowedWeekdays?: number[];
}

export const TIMEZONE_OPTIONS = [
  { label: "Ciudad de México (GMT-6)", value: "America/Mexico_City", offsetHours: -6 },
  { label: "Buenos Aires, Argentina (GMT-3)", value: "America/Argentina/Buenos_Aires", offsetHours: -3 },
  { label: "Bogotá / Lima / Quito (GMT-5)", value: "America/Bogota", offsetHours: -5 },
  { label: "Santiago de Chile (GMT-3)", value: "America/Santiago", offsetHours: -3 },
  { label: "Madrid, España (GMT+2)", value: "Europe/Madrid", offsetHours: 2 },
  { label: "Miami / New York (GMT-4)", value: "America/New_York", offsetHours: -4 },
];

export function convertTimeSlot(timeStr: string, fromTz: string, toTz: string): string {
  if (fromTz === toTz) return timeStr;
  const [time, modifier] = timeStr.split(' ');
  if (!time) return timeStr;
  const parts = time.split(':').map(Number);
  let hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  if (hours === 12) hours = 0;
  if (modifier === 'PM') hours += 12;

  const fromOpt = TIMEZONE_OPTIONS.find(t => t.value === fromTz) || { offsetHours: -6 };
  const toOpt = TIMEZONE_OPTIONS.find(t => t.value === toTz) || { offsetHours: -3 };

  const diff = toOpt.offsetHours - fromOpt.offsetHours;
  let targetHours = (hours + diff) % 24;
  if (targetHours < 0) targetHours += 24;

  const ampm = targetHours >= 12 ? 'PM' : 'AM';
  const displayHours = targetHours % 12 === 0 ? 12 : targetHours % 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours.toString().padStart(2, '0')}:${displayMinutes} ${ampm}`;
}

export default function BookingCalendar({ 
  selectedDate, 
  onDateSelect,
  selectedTime,
  onTimeSelect,
  availableTimes,
  isLoadingTimes = false,
  coachTimezone = "America/Mexico_City",
  allowedWeekdays,
}: BookingCalendarProps) {
  const { t, locale } = useTranslation();
  const [selectedTz, setSelectedTz] = useState<string>("America/Mexico_City");
  const [detectedTzLabel, setDetectedTzLabel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userTz) {
        const exactMatch = TIMEZONE_OPTIONS.find((t) => t.value === userTz);
        if (exactMatch) {
          setSelectedTz(exactMatch.value);
          setDetectedTzLabel(exactMatch.label);
          return;
        }

        const userOffsetHours = -new Date().getTimezoneOffset() / 60;
        const offsetMatch = TIMEZONE_OPTIONS.find((t) => t.offsetHours === userOffsetHours);
        if (offsetMatch) {
          setSelectedTz(offsetMatch.value);
          setDetectedTzLabel(offsetMatch.label);
        }
      }
    } catch {}
  }, []);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const weekdays = useMemo(() => {
    try {
      const formatter = new Intl.DateTimeFormat(locale.toLowerCase(), { weekday: 'short' });
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(2023, 0, 1 + i); // 2023-01-01 was a Sunday
        return formatter.format(d);
      });
    } catch {
      return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    }
  }, [locale]);

  const monthYearLabel = useMemo(() => {
    try {
      const formatted = new Intl.DateTimeFormat(locale.toLowerCase(), { month: 'long', year: 'numeric' }).format(currentMonth);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return `${currentMonth.getMonth() + 1} / ${currentMonth.getFullYear()}`;
    }
  }, [currentMonth, locale]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const formattedDate = selectedDate.toLocaleDateString(locale.toLowerCase(), { day: 'numeric', month: 'long' });
      return t("BookingCalendar.schedule_for_date", { date: formattedDate });
    } catch {
      return `Horarios el ${selectedDate.getDate()}`;
    }
  }, [selectedDate, locale, t]);

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    const today = new Date();
    // No permitir ir a meses pasados
    if (currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() === today.getMonth()) {
      return;
    }
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const isPrevMonthDisabled = useMemo(() => {
    const today = new Date();
    return currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() === today.getMonth();
  }, [currentMonth]);

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const daysArray = [];
    
    // Fill empty slots for days before the 1st
    for (let i = 0; i < firstDayOfMonth; i++) {
      daysArray.push(null);
    }
    
    // Fill actual days
    for (let i = 1; i <= daysInMonth; i++) {
      daysArray.push(new Date(year, month, i));
    }
    
    return daysArray;
  }, [currentMonth]);

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;
    if (allowedWeekdays && allowedWeekdays.length > 0) {
      return !allowedWeekdays.includes(date.getDay());
    }
    // Deshabilitar fines de semana por defecto si no hay reglas explícitas (0=Dom, 6=Sáb)
    return date.getDay() === 0 || date.getDay() === 6;
  };

  const isSameDay = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3 sm:p-5 shadow-sm">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button 
            type="button"
            onClick={prevMonth}
            disabled={isPrevMonthDisabled}
            className={`p-2 rounded-xl transition-colors ${isPrevMonthDisabled ? 'text-gray-300 dark:text-slate-600 cursor-not-allowed' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="font-extrabold text-gray-800 dark:text-slate-100 text-sm sm:text-base">
            {monthYearLabel}
          </div>
          
          <button 
            type="button"
            onClick={nextMonth}
            className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekdays.map((day, idx) => (
            <div key={`${day}-${idx}`} className="text-center text-[11px] sm:text-xs font-bold text-gray-400 dark:text-slate-500 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="h-9 sm:h-12"></div>;
            }

            const disabled = isDateDisabled(date);
            const selected = isSameDay(selectedDate, date);
            
            return (
              <button
                key={date.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onDateSelect(date);
                  onTimeSelect(""); // Reset time when date changes
                }}
                className={`
                  h-9 sm:h-12 rounded-xl text-xs sm:text-sm font-medium transition-all relative
                  ${disabled ? 'text-gray-300 dark:text-slate-600 cursor-not-allowed' : 'hover:border-cfh-dark-green/30 dark:hover:border-cfh-light-green/30 border border-transparent'}
                  ${selected ? 'bg-cfh-dark-green text-white font-bold shadow-md transform scale-105 border-cfh-dark-green' : !disabled ? 'text-gray-700 dark:text-slate-200 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-700' : 'bg-transparent'}
                `}
              >
                {date.getDate()}
                {/* Indicador de disponibilidad (puntito verde) */}
                {!disabled && !selected && (
                  <span className="absolute bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Selection */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h4 className="text-sm font-bold text-gray-800 dark:text-slate-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cfh-dark-green dark:text-cfh-light-green" />
                  {selectedDateLabel}
                </h4>

                {/* Zona Horaria Selector */}
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                  <span className="font-semibold text-xs sm:text-sm text-gray-400 dark:text-slate-500">
                    {t("BookingCalendar.timezone_label", "Zona horaria:")}
                  </span>
                  <select
                    value={selectedTz}
                    onChange={(e) => setSelectedTz(e.target.value)}
                    className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-cfh-dark-green dark:focus:border-cfh-light-green cursor-pointer font-medium"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz.value} value={tz.value} className="bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100">
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {detectedTzLabel && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-1 rounded-lg mb-3 w-fit">
                  <Globe className="w-3 h-3 shrink-0" />
                  <span>Detectamos tu zona horaria local automáticamente</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {isLoadingTimes ? (
                  <div className="col-span-full py-4 text-center text-sm text-gray-500 dark:text-slate-400">
                    {t("BookingCalendar.searching_times", "Buscando horarios...")}
                  </div>
                ) : availableTimes.length > 0 ? (
                  availableTimes.map((originalTime) => {
                    const displayTime = convertTimeSlot(originalTime, coachTimezone, selectedTz);
                    const isSelected = selectedTime === originalTime;
                    const isDifferentTz = selectedTz !== coachTimezone;

                    return (
                      <button
                        key={originalTime}
                        type="button"
                        onClick={() => onTimeSelect(originalTime)}
                        className={`
                          py-2.5 px-3 rounded-xl text-sm font-bold transition-all border flex flex-col items-center justify-center
                          ${isSelected
                            ? 'bg-cfh-light-green/15 dark:bg-cfh-light-green/20 border-cfh-light-green text-cfh-dark-green dark:text-cfh-light-green shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-cfh-dark-green/50 dark:hover:border-cfh-light-green/50 hover:bg-gray-50 dark:hover:bg-slate-700'
                          }
                        `}
                      >
                        <span>{displayTime}</span>
                        {isDifferentTz && (
                          <span className="text-xs font-normal text-gray-400 dark:text-slate-500">
                            ({originalTime} CDMX)
                          </span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-full py-4 text-center text-sm text-gray-500 dark:text-slate-400">
                    {t("BookingCalendar.no_times_available", "No hay horarios disponibles este día.")}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
