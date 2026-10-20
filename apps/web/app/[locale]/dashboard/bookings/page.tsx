import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/payments";

export default async function DashboardBookingsRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : undefined;

  if (sessionId && sessionId.startsWith("cs_")) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      const bookingId = session.metadata?.bookingId;
      if (bookingId) {
        const piId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: "REQUESTED",
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: piId,
          },
        });
      }
    } catch (err) {
      console.error("Error setting held booking status from session_id:", err);
    }
  }

  // Redirigir limpiamente al dashboard principal del aprendiz
  redirect(`/${locale}/dashboard?booking_held=1`);
}
