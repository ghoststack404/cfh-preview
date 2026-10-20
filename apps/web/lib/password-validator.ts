/**
 * Utilidades para la validación y cálculo de fortaleza de contraseñas
 * Política de seguridad reforzada:
 * - Mínimo 10 caracteres reales (sin contar espacios)
 * - Al menos una letra mayúscula (A-Z)
 * - Al menos una letra minúscula (a-z)
 * - Al menos un dígito numérico (0-9)
 * - Al menos un símbolo o carácter especial (!@#$%^&*...)
 * - Sin espacios en blanco
 */

export interface PasswordRequirements {
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  hasNoSpaces: boolean;
}

export interface PasswordValidationResult {
  requirements: PasswordRequirements;
  score: number; // 0 a 6
  strength: "weak" | "medium" | "strong";
  isValid: boolean;
  hasSpaces: boolean;
}

export function validatePassword(password: string): PasswordValidationResult {
  const pwd = password || "";

  // 1. Detección estricta de espacios en blanco
  const hasSpaces = /\s/.test(pwd);
  const hasNoSpaces = !hasSpaces && pwd.length > 0;

  // 2. Longitud mínima real: requiere al menos 10 caracteres y no contener espacios
  const nonSpaceLength = pwd.replace(/\s/g, "").length;
  const hasMinLength = nonSpaceLength >= 10 && hasNoSpaces;

  // 3. Conjuntos de caracteres requeridos
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(pwd);

  const requirements: PasswordRequirements = {
    hasMinLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    hasNoSpaces,
  };

  const fulfilledCount = [
    hasMinLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    hasNoSpaces,
  ].filter(Boolean).length;

  // Si contiene espacios o tiene pocos caracteres reales, siempre es débil
  let strength: "weak" | "medium" | "strong" = "weak";
  if (hasSpaces || nonSpaceLength < 6) {
    strength = "weak";
  } else if (fulfilledCount === 6) {
    strength = "strong";
  } else if (fulfilledCount >= 4 && hasNoSpaces) {
    strength = "medium";
  } else {
    strength = "weak";
  }

  // Una contraseña es válida sólo si cumple todos los requisitos simultáneamente
  const isValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && hasNoSpaces;

  return {
    requirements,
    score: fulfilledCount,
    strength,
    isValid,
    hasSpaces,
  };
}

export function validatePasswordMatch(password: string, confirmPassword: string): boolean {
  return Boolean(password && confirmPassword && password === confirmPassword);
}
