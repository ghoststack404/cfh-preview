// Prisma client singleton
import { PrismaClient } from "@prisma/client";

declare global {
  // Allows global this.prisma to be typed correctly
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  // @ts-ignore
  global.prisma = prisma;
}

export default prisma;
