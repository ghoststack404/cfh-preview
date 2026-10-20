import { NextResponse } from "next/server";

interface CachedRate {
  rate: number;
  timestamp: number;
}

let cachedMXN: CachedRate | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de caché para frescura y alto rendimiento

export async function GET() {
  const now = Date.now();

  // Si tenemos caché reciente (menos de 5 min), responder de inmediato
  if (cachedMXN && now - cachedMXN.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      base: "USD",
      target: "MXN",
      rate: cachedMXN.rate,
      updatedAt: new Date(cachedMXN.timestamp).toISOString(),
      cached: true,
    });
  }

  // 1. Intentar API principal (open.er-api.com - confiable, rápida, sin clave)
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data.rates?.MXN;
      if (typeof rate === "number" && rate > 0) {
        cachedMXN = { rate, timestamp: now };
        return NextResponse.json({
          success: true,
          base: "USD",
          target: "MXN",
          rate,
          updatedAt: new Date(now).toISOString(),
          cached: false,
        });
      }
    }
  } catch (err) {
    console.warn("[ExchangeRate] Primary provider error, trying fallback:", err);
  }

  // 2. Intentar API secundaria de respaldo
  try {
    const fallbackRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      signal: AbortSignal.timeout(4000),
    });
    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      const fbRate = fbData.rates?.MXN;
      if (typeof fbRate === "number" && fbRate > 0) {
        cachedMXN = { rate: fbRate, timestamp: now };
        return NextResponse.json({
          success: true,
          base: "USD",
          target: "MXN",
          rate: fbRate,
          updatedAt: new Date(now).toISOString(),
          cached: false,
        });
      }
    }
  } catch (err) {
    console.warn("[ExchangeRate] Secondary provider error:", err);
  }

  // 3. Fallback estático en caso de desconexión total
  const fallbackStaticRate = cachedMXN ? cachedMXN.rate : 18.36;
  return NextResponse.json({
    success: true,
    base: "USD",
    target: "MXN",
    rate: fallbackStaticRate,
    updatedAt: new Date(now).toISOString(),
    isFallback: true,
  });
}
