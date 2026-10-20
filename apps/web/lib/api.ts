import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("Hay datos que necesitan revisión.", 422, error.flatten());
  }
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") return fail("Necesitas iniciar sesión.", 401);
    if (error.message === "FORBIDDEN") return fail("No tienes permiso para hacer esto.", 403);
    if (error.message === "NOT_FOUND") return fail("No encontramos lo que buscas.", 404);
    if (error.message === "CONFLICT") return fail("La operación entra en conflicto con información existente.", 409);
    console.error(error);
  }
  return fail("Ocurrió un error inesperado. Inténtalo de nuevo.", 500);
}
