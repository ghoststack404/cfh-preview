import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  __cfh_prisma__?: PrismaClient
  prisma?: PrismaClient
}

function buildPrisma(): PrismaClient {
  const baseUrl = process.env.DATABASE_URL ?? ''
  const datasourceUrl =
    baseUrl && !baseUrl.includes('connection_limit')
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}connection_limit=5&pool_timeout=15`
      : baseUrl

  return new PrismaClient({
    datasourceUrl: datasourceUrl || undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma =
  globalForPrisma.__cfh_prisma__ ??
  globalForPrisma.prisma ??
  buildPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__cfh_prisma__ = prisma
  globalForPrisma.prisma = prisma
}

export * from '@prisma/client'
