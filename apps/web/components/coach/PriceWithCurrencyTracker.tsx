"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DollarSign, RefreshCw, TrendingUp } from "lucide-react";

interface PriceWithCurrencyTrackerProps {
  value: number | string;
  onChange: (value: number | "") => void;
  label?: string;
  min?: number;
  disabled?: boolean;
}

export default function PriceWithCurrencyTracker({
  value,
  onChange,
  label = "Precio",
  min = 0,
  disabled = false,
}: PriceWithCurrencyTrackerProps) {
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  // Obtener tipo de cambio en vivo
  const fetchRate = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      const res = await fetch("/api/currency/exchange-rate");
      if (res.ok) {
        const data = await res.json();
        if (data?.rate) {
          setExchangeRate(data.rate);
          setLastUpdated(new Date());
          setIsFallback(Boolean(data.isFallback));
        }
      }
    } catch (e) {
      console.warn("No se pudo obtener el tipo de cambio:", e);
    } finally {
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 600);
      }
    }
  }, []);

  // Polling automático cada 60 segundos
  useEffect(() => {
    fetchRate();
    const interval = setInterval(() => {
      fetchRate();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRate]);

  // Cálculo en MXN reactivo
  const numericPrice = typeof value === "number" ? value : parseFloat(value as string) || 0;
  const estimatedMXN = exchangeRate && numericPrice > 0 ? (numericPrice * exchangeRate).toFixed(2) : null;

  return (
    <div className="w-full space-y-2">
      {/* Etiqueta con indicador de moneda explícito en Dólares (USD) */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
          {label} <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">(USD)</span>
        </label>
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase">
          <span>🇺🇸 Moneda Base: USD ($)</span>
        </div>
      </div>

      {/* Input de precio estilizado con prefijo $ USD */}
      <div className="relative flex items-center">
        <div className="absolute left-3 flex items-center gap-1 pointer-events-none text-emerald-600 dark:text-emerald-400 font-black text-sm">
          <DollarSign className="w-4 h-4" />
          <span className="text-xs tracking-wider">USD</span>
        </div>

        <input
          type="number"
          min={min}
          step="any"
          disabled={disabled}
          value={value === "" ? "" : value}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val === "" ? "" : Number(val));
          }}
          placeholder="0.00"
          className="w-full pl-16 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 font-bold text-base focus:border-cfh-dark-green focus:ring-2 focus:ring-cfh-dark-green/20 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        <div className="absolute right-3 text-xs font-bold text-gray-400 dark:text-slate-500 pointer-events-none">
          $
        </div>
      </div>

      {/* Tarjeta de Tipo de Cambio en Vivo (Actualizado constantemente) */}
      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-gray-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {/* Indicador pulsante en vivo */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>

          <span className="font-semibold text-gray-600 dark:text-slate-300 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Tipo de cambio:</span>
            {exchangeRate ? (
              <strong className="text-gray-900 dark:text-slate-100 font-black">
                1 USD ≈ ${exchangeRate.toFixed(2)} MXN
              </strong>
            ) : (
              <span className="text-gray-400 animate-pulse">Consultando...</span>
            )}
          </span>
        </div>

        {/* Conversión estimada en tiempo real */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {estimatedMXN && numericPrice > 0 ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
              ≈ ${estimatedMXN} MXN
            </span>
          ) : (
            <span className="text-[11px] text-gray-400 dark:text-slate-500">
              Ingresa el precio en USD
            </span>
          )}

          {/* Botón manual para refrescar el tipo de cambio */}
          <button
            type="button"
            title="Actualizar tipo de cambio en vivo"
            onClick={() => fetchRate(true)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-cfh-dark-green" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
