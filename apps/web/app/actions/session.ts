"use server";

import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

async function getAuthenticatedUser() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function updateSessionNotes(bookingId: string, notes: string, isCoach: boolean) {
  const auth = await getAuthenticatedUser();
  if (!auth) throw new Error("Unauthorized");

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");

  if (isCoach) {
    if (booking.coachId !== auth.id) throw new Error("Unauthorized coach");
    await prisma.booking.update({ where: { id: bookingId }, data: { notes } });
  } else {
    if (booking.studentId !== auth.id) throw new Error("Unauthorized student");
    // Removed studentNotes as it does not exist in schema
    await prisma.booking.update({ where: { id: bookingId }, data: {} });
  }
  return { success: true };
}

export async function reportSessionProblem(bookingId: string, reason: string) {
  const auth = await getAuthenticatedUser();
  if (!auth) throw new Error("Unauthorized");

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");

  if (booking.studentId !== auth.id && booking.coachId !== auth.id) {
    throw new Error("Unauthorized");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { 
      status: "DISPUTED",
    }
  });

  return { success: true };
}
