import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import { CoachApprovalStatus, UserRole, UserStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;

    const search = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const maxPrice = parseInt(searchParams.get("maxPrice") || "0", 10);

    const restrictedTerms = ["salud", "medicina", "medico", "medica", "terapia medica", "terapia-medica"];

    const auth = await getAuthenticatedUser();
    const where: any = {
      
      ...(auth?.id ? { userId: { not: auth.id } } : {}),
      approvalStatus: CoachApprovalStatus.APPROVED,
      currentTier: { not: "CURSOS_ONLY" },
      user: {
        role: UserRole.COACH,
        status: UserStatus.ACTIVE,
      },
      categories: {
        none: {
          category: {
            OR: restrictedTerms.map(term => ({
              slug: { contains: term }
            }))
          }
        }
      }
    };

    if (category) {
      where.categories.some = {
        category: { slug: category }
      };
    }

    if (maxPrice > 0) {
      where.hourlyRateCents = { lte: maxPrice * 100 };
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search } },
        { user: { name: { contains: search } } },
        { headline: { contains: search } },
        { biography: { contains: search } }
      ];
    }

    const [coaches, total] = await Promise.all([
      prisma.coachProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          certificates: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              countryCode: true,
              coachSubscriptions: {
                where: { status: "ACTIVE" },
                include: { plan: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            }
          },
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                }
              }
            }
          }
        },
        orderBy: [
          { currentTier: 'asc' },
          { averageRating: 'desc' },
          { reviewCount: 'desc' }
        ]
      }),
      prisma.coachProfile.count({ where })
    ]);

    const data = coaches.map(coach => ({
      ...coach,
      currentTier: coach.user?.coachSubscriptions?.[0]?.plan?.tier || coach.currentTier || "BASIC",
      showCertificates: coach.showCertificates ?? false,
      certificates: coach.certificates || [],
      categories: coach.categories.map(c => c.category)
    }));

    return Response.json({
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("[COACHES_GET_ERROR]", error);
    return Response.json(
      { error: "Error al obtener la lista de coaches." }, 
      { status: 500 }
    );
  }
}
