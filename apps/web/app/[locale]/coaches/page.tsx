import { prisma } from "@/lib/db";
import CoachesClient from "@/components/CoachesClient";
import { getAuthenticatedUser } from "@/app/actions/onboarding";

export const dynamic = "force-dynamic";

export default async function CoachesPage() {
  const [categories, user] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true }
    }),
    getAuthenticatedUser()
  ]);

  return <CoachesClient initialCategories={categories} initialUser={user} />;
}
