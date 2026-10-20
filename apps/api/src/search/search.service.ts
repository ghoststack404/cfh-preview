import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SearchFilters {
  query?: string;
  specialty?: string;
  language?: string;
  maxPrice?: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchCoaches(filters: SearchFilters): Promise<any> {
    const { query, specialty, language, maxPrice } = filters;
    
    return this.prisma.coachProfile.findMany({
      where: {
        approvalStatus: 'APPROVED',
        //...(specialty && {
        //  specialties: {
        //    has: specialty,
        //  },
        //}),
        //...(language && {
        //  languages: {
        //    has: language,
        //  },
        //}),
        ...(maxPrice !== undefined && {
          hourlyRateCents: {
            lte: maxPrice * 100,
          },
        }),
        ...(query && {
          user: {
            // Asumiendo que quieres buscar por algo como nombre, 
            // pero como no hay un campo name en User, buscaremos por email por ahora.
            // Si después se agrega 'name' o 'firstName', se cambiaría.
            email: {
              contains: query
            },
          },
        }),
      },
      include: {
        user: {
          select: {
            email: true,
            // name: true, // Si se agrega
          },
        },
      },
      orderBy: {
        // Orden por defecto, podría ser por rating, etc.
        user: {
          createdAt: 'desc'
        }
      }
    });
  }
}
