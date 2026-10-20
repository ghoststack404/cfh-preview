import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function backfill() {
  const coaches = await prisma.coachProfile.findMany({
    where: { displayName: null },
    include: { user: true }
  });
  
  for (const coach of coaches) {
    await prisma.coachProfile.update({
      where: { id: coach.id },
      data: { displayName: coach.user.name }
    });
    console.log("Updated coach " + coach.slug + " with name " + coach.user.name);
  }
  console.log("Done backfilling " + coaches.length + " coaches.");
}

backfill().finally(() => prisma.$disconnect());
