"use server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

import { prisma } from "@/lib/db";
import { communityPostLimiter, communityCommentLimiter } from "@/lib/rateLimit";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { PostType, UserRole, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  validateCommunitySafety,
  canEditPostOrComment,
  parseCommunityTags,
  serializeCommunityTags,
  parseCommunityMentions,
  type MentionedEntity,
} from "@/lib/communitySafety";
import {
  checkAndHandleCommunityStrike,
  checkAndAutoReactivateUser,
  getSuspensionDetails,
  type SuspensionDetails,
} from "@/lib/communityStrikes";
import {
  validateSpamRule,
  checkUserSpamTimeout,
} from "@/lib/spamModeration";
import { getRateLimitResult } from "@/lib/guardrails";

export type CommunityFilter = "GLOBAL" | "LOCAL" | "LATAM" | "NORTH_AMERICA" | "EUROPE" | "ASIA" | "AFRICA" | "OCEANIA" | "OTHER" | string;

export async function getCommunityPosts(
  filter: CommunityFilter = "GLOBAL",
  type?: PostType | string,
  search?: string,
  cursor?: string,
  limit: number = 10,
  tag?: string,
  sortBy: "RECENT" | "POPULAR" | "MOST_COMMENTED" = "RECENT"
) {
    const cookieStore_log = await cookies();
    console.log('--- GET_COMMUNITY_POSTS CALLED ---');
    console.log('Role cookie:', cookieStore_log.get('cfh_active_role')?.value);

  try {
    const auth = await getAuthenticatedUser();
    
    // If LOCAL filter is applied, we only show posts from users in the same region
    let regionFilter: any = undefined;
    if (filter === "LOCAL" && auth?.id) {
      const userRecord = await prisma.user.findUnique({
        where: { id: auth.id },
        select: { region: true },
      });
      if (userRecord?.region) {
        regionFilter = userRecord.region;
      }
    } else if (filter && filter !== "GLOBAL" && filter !== "LOCAL") {
      regionFilter = filter;
    }



    const cookieStore = await cookies();
    const activeRoleCookie = cookieStore.get("cfh_active_role")?.value;
    const activeRole = activeRoleCookie || auth?.role;
    const isCoach = activeRole === UserRole.COACH;

    let roleTypeCondition: any = {};
    if (!isCoach) {
      let baseFilter: any = {};
      if (type === "ANNOUNCEMENT" || type === "PROMOTION") {
        baseFilter = { postType: { in: [PostType.ANNOUNCEMENT, PostType.PROMOTION] } };
      } else if (type === "DOUBT") {
        baseFilter = { postType: PostType.DOUBT };
      } else if (type === "UNANSWERED") {
        baseFilter = { postType: PostType.DOUBT, comments: { none: {} } };
      } else if (type === "REQ_REC_COACH") {
        baseFilter = { postType: "REQ_REC_COACH" as any };
      } else if (type === "REQ_REC_COURSE") {
        baseFilter = { postType: "REQ_REC_COURSE" as any };
      } else {
        baseFilter = { postType: { notIn: [PostType.ANNOUNCEMENT, PostType.PROMOTION] } }; 
      }
      
      if (auth?.role === UserRole.COACH && auth?.id) {
           roleTypeCondition = {
             AND: [
               baseFilter,
               {
                 NOT: {
                   authorId: auth.id,
                   postType: { in: [PostType.PROMOTION, PostType.ANNOUNCEMENT] }
                 }
               }
             ]
           };
        } else {
         roleTypeCondition = baseFilter;
      }
    } else {
      if (type === "UNANSWERED") {
        roleTypeCondition = {
          postType: PostType.DOUBT,
          comments: { none: {} }
        };
      } else if (type === "ANNOUNCEMENT" || type === "PROMOTION") {
        roleTypeCondition = {
          postType: { in: [PostType.ANNOUNCEMENT, PostType.PROMOTION] },
          author: { role: UserRole.COACH }
        };
      } else {
        roleTypeCondition = {
          postType: { in: [PostType.ANNOUNCEMENT, PostType.PROMOTION] },
          author: { role: UserRole.COACH }
        };
      }
    }

    const orderQuery =
      sortBy === "POPULAR"
        ? [{ likes: { _count: "desc" as const } }, { createdAt: "desc" as const }]
        : sortBy === "MOST_COMMENTED"
        ? [{ comments: { _count: "desc" as const } }, { createdAt: "desc" as const }]
        : { createdAt: "desc" as const };

    const andConditions: any[] = [
      { isVisible: true },
      roleTypeCondition,
    ];

    if (regionFilter) {
      andConditions.push({ author: { region: regionFilter } });
    }

    if (search && search.trim()) {
      andConditions.push({
        OR: [
          { content: { contains: search.trim() } },
          { title: { contains: search.trim() } },
        ],
      });
    }

    if (tag && tag.trim()) {
      const raw = tag.trim();
      const withHash = raw.startsWith("#") ? raw : `#${raw}`;
      const withoutHash = withHash.replace(/^#/, "");
      const tagVariants = new Set<string>();
      tagVariants.add(withHash);
      tagVariants.add(withoutHash);
      tagVariants.add(withHash.toLowerCase());
      tagVariants.add(withoutHash.toLowerCase());

      const unaccented = withoutHash.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      tagVariants.add(`#${unaccented}`);
      tagVariants.add(unaccented);
      tagVariants.add(`#${unaccented.toLowerCase()}`);
      tagVariants.add(unaccented.toLowerCase());

      const tagOrConditions: any[] = [];
      for (const v of tagVariants) {
        tagOrConditions.push({ tags: { array_contains: v } });
        if (v.startsWith("#")) {
          tagOrConditions.push({ content: { contains: v } });
          tagOrConditions.push({ title: { contains: v } });
        }
      }
      andConditions.push({ OR: tagOrConditions });
    }

    const posts = await prisma.communityPost.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      where: {
        AND: andConditions,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            avatarUrl: true,
            region: true,
            coachProfile: {
              select: {
                photoUrl: true,
                slug: true,
                headline: true,
                hourlyRateCents: true,
                currency: true,
                averageRating: true,
                reviewCount: true,
                level: true,
                categories: {
                  select: {
                    category: {
                      select: { name: true }
                    }
                  }
                }
              }
            }
          },
        },
        _count: {
          select: { comments: true, likes: true },
        },
        likes: {
          select: { id: true, userId: true }, // reaction: true temporarily removed
        },
      },
      orderBy: orderQuery,
    });

    let nextCursor: typeof cursor | null = null;
    if (posts.length > limit) {
      const nextItem = posts.pop();
      nextCursor = nextItem?.id || null;
    }

    // Mapear entidades mencionadas y verificar en lote si el usuario puede interactuar
    const parsedPosts = posts.map((post) => {
      const { tags: cleanTags, isResolved, resolvedCommentId } = parseCommunityTags(post.tags);
      const mentionedEntity = parseCommunityMentions(post.tags);
      return {
        post,
        cleanTags,
        isResolved,
        resolvedCommentId,
        mentionedEntity,
      };
    });

    const mentionedCoachIds = new Set<string>();
    const mentionedCourseIds = new Set<string>();

    parsedPosts.forEach(({ mentionedEntity }) => {
      if (mentionedEntity?.type === "coach") {
        mentionedCoachIds.add(mentionedEntity.id);
      } else if (mentionedEntity?.type === "course") {
        mentionedCourseIds.add(mentionedEntity.id);
      }
    });

    const verifiedCoachIds = new Set<string>();
    const verifiedCourseIds = new Set<string>();

    if (auth?.id && auth.role !== UserRole.COACH && (mentionedCoachIds.size > 0 || mentionedCourseIds.size > 0)) {
      const [bookings, enrollmentsByCoach, directEnrollments] = await Promise.all([
        mentionedCoachIds.size > 0
          ? prisma.booking.findMany({
              where: {
                studentId: auth.id,
                coachId: { in: Array.from(mentionedCoachIds) },
                status: { in: ["COMPLETED", "CONFIRMED"] },
              },
              select: { coachId: true },
            })
          : Promise.resolve([]),
        mentionedCoachIds.size > 0
          ? prisma.enrollment.findMany({
              where: {
                studentId: auth.id,
                course: { coachId: { in: Array.from(mentionedCoachIds) } },
              },
              select: { course: { select: { coachId: true } } },
            })
          : Promise.resolve([]),
        mentionedCourseIds.size > 0
          ? prisma.enrollment.findMany({
              where: {
                studentId: auth.id,
                courseId: { in: Array.from(mentionedCourseIds) },
              },
              select: { courseId: true },
            })
          : Promise.resolve([]),
      ]);

      bookings.forEach((b) => verifiedCoachIds.add(b.coachId));
      enrollmentsByCoach.forEach((e) => {
        if (e.course?.coachId) verifiedCoachIds.add(e.course.coachId);
      });
      directEnrollments.forEach((e) => verifiedCourseIds.add(e.courseId));
    }

    return {
      posts: parsedPosts.map(({ post, cleanTags, isResolved, resolvedCommentId, mentionedEntity }) => {
        let canComment = true;
        let commentReason: string | undefined = undefined;

        if (isCoach) {
          canComment = false;
          commentReason = "Los coaches solo pueden publicar contenido publicitario y no participar en consultas ni encuestas de alumnos.";
        } else if (!auth?.id) {
          if (mentionedEntity) {
            canComment = false;
            commentReason = "Debes iniciar sesión para participar en esta consulta.";
          }
        } else if (mentionedEntity) {
          if (mentionedEntity.type === "coach") {
            const hasVerifiedHistory = verifiedCoachIds.has(mentionedEntity.id);
            if (!hasVerifiedHistory) {
              canComment = false;
              commentReason = `ðŸ”’ PublicaciÃ³n Verificada: Solo los estudiantes que han tomado clases o cursos con @${mentionedEntity.name} pueden compartir su experiencia o responder en esta consulta.`;
            }
          } else if (mentionedEntity.type === "course") {
            const hasVerifiedEnrollment = verifiedCourseIds.has(mentionedEntity.id);
            if (!hasVerifiedEnrollment) {
              canComment = false;
              commentReason = `ðŸ”’ PublicaciÃ³n Verificada: Solo los estudiantes inscritos en el curso "${mentionedEntity.name}" pueden compartir su experiencia o responder.`;
            }
          }
        }

        const userLike = auth?.id ? post.likes.find((l) => l.userId === auth.id) : null;
        const reactionTypes: string[] = []; // Array.from(new Set(post.likes.map((l) => l.reaction)));

        return {
          ...post,
          hasLiked: !!userLike,
          userReaction: null, // userLike ? userLike.reaction : null,
          reactionTypes,
          tags: cleanTags,
          mentionedEntity,
          isResolved,
          resolvedCommentId,
          canComment,
          commentReason,
          author: {
            id: post.author.id,
            name: post.author.name,
            role: post.author.role,
            avatarUrl: (post.author as any).coachProfile?.photoUrl || post.author.avatarUrl,
            region: post.author.region,
          },
        };
      }),
      nextCursor,
    };
  } catch (error) {
    console.error("Error fetching community posts:", error);
    return { posts: [], nextCursor: null };
  }
}

export async function getCoachAdQuota(coachUserId?: string) {
  try {
    const auth = await getAuthenticatedUser();
    const userId = coachUserId || auth?.id;
    if (!userId) {
      return { success: false, error: "No autenticado", quota: null };
    }

    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId },
      select: { currentTier: true },
    });

    const tier = coachProfile?.currentTier || "BASIC";

    // LÃ­mites semanales por plan:
    // BASIC / CURSOS_ONLY: 2 por semana
    // ELITE: 5 por semana
    // GOLD: 10 por semana
    // PLATINUM: Ilimitado
    const TIER_LIMITS: Record<string, number> = {
      BASIC: 2,
      CURSOS_ONLY: 2,
      ELITE: 5,
      GOLD: 10,
      PLATINUM: Infinity,
    };

    const limit = TIER_LIMITS[tier] ?? 2;
    const isUnlimited = limit === Infinity;

    // Conteo en los Ãºltimos 7 dÃ­as
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const usedThisWeek = await prisma.communityPost.count({
      where: {
        authorId: userId,
        postType: { in: [PostType.PROMOTION, PostType.ANNOUNCEMENT] },
        createdAt: { gte: sevenDaysAgo },
        isVisible: true,
      },
    });

    const remaining = isUnlimited ? Infinity : Math.max(0, limit - usedThisWeek);

    return {
      success: true,
      quota: {
        tier,
        tierName: tier === "BASIC" ? "BÃƒsico" : tier === "ELITE" ? "Ãƒâ€°lite" : tier === "PLATINUM" ? "Platino" : tier,
        limit: isUnlimited ? "Ilimitado" : limit,
        usedThisWeek,
        remaining: isUnlimited ? "Ilimitado" : remaining,
        canPost: isUnlimited || remaining > 0,
        isUnlimited,
      },
    };
  } catch (err: any) {
    console.error("Error al consultar cuota de publicidad:", err);
    return { success: false, error: err?.message, quota: null };
  }
}

export async function createPost(
  content: string,
  postType: PostType,
  tags: string[] = [],
  imageUrl?: string | string[],
  mentionedEntity?: MentionedEntity | null
) {
  try {
    console.log("createPost CALLED WITH TYPE:", postType);

    const auth = await getAuthenticatedUser();
    if (!auth?.id) {
      return { success: false, error: "Debes iniciar sesión para publicar." };
    }

    const rateLimit = getRateLimitResult(auth?.id || "", "community-post", 6, 60_000);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto antes de publicar otra vez.",
      };
    }

    const cookieStore = await cookies();
    const activeRoleCookie = cookieStore.get("cfh_active_role")?.value;
    const activeRole = activeRoleCookie || auth.role;

    // Verificar si el usuario estÃƒ suspendido
    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return {
        success: false,
        error: `Ã¢â€ºâ€  Tu cuenta estÃƒ suspendida por incumplimiento de las normas de la comunidad. PodrÃƒs volver a participar en ${reactivateCheck.remainingText}.`,
        isSuspended: true,
      };
    }

    // 0. Validación Anti-Spam (repetir más de 3 veces bloquea por 1:30h)
    const spamCheck = await validateSpamRule(auth.id, content);
    if (spamCheck.isSpam) {
      return {
        success: false,
        error: spamCheck.error,
        isSpamBlocked: true,
        remainingText: spamCheck.remainingText,
        timeoutUntil: spamCheck.timeoutUntil?.toISOString(),
        formattedHour: spamCheck.formattedHour,
      };
    }

    // 1. ValidaciÃ³n de seguridad Anti-Bypass
    const safety = validateCommunitySafety(content);
    if (!safety.isValid) {
      const strikeResult = await checkAndHandleCommunityStrike(auth.id, safety.reason || "InformaciÃ³n restringida", content);
      return {
        success: false,
        error: strikeResult.warningMessage,
        isSuspended: strikeResult.isSuspended,
      };
    }

    // 2. ValidaciÃ³n de seguridad en imÃƒgenes adjuntas
    if (imageUrl) {
      const urlsToCheck: string[] = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
      for (const imgUrl of urlsToCheck) {
        if (typeof imgUrl === "string" && imgUrl.startsWith("/uploads/")) {
          const filePath = path.join(process.cwd(), "public", imgUrl);
          if (fs.existsSync(filePath)) {
            try {
              const buffer = fs.readFileSync(filePath);
              const { moderateImageBuffer } = await import("@/lib/imageModeration");
              const imgSafety = await moderateImageBuffer(buffer);
              if (!imgSafety.isSafe) {
                try { fs.unlinkSync(filePath); } catch (_) {}
                const strikeResult = await checkAndHandleCommunityStrike(
                  auth.id,
                  imgSafety.reason || "Imagen con contenido prohibido o datos de contacto",
                  `[Imagen no permitida: ${imgSafety.extractedText || "datos restringidos"}]`
                );
                return {
                  success: false,
                  error: strikeResult.warningMessage,
                  isSuspended: strikeResult.isSuspended,
                };
              }
            } catch (imgErr) {
              console.warn("Advertencia validando imagen en createPost:", imgErr);
            }
          }
        }
      }
    }

    if (activeRole === UserRole.COACH) {
      const eligible = await getCoachPromotionEligibility(auth.id);
      if (!eligible) {
        return { success: false, error: "Requieres 1 mes de antigÃ¼edad y 5 alumnos activos para autopromocionarte." };
      }
      if (postType !== PostType.PROMOTION && postType !== PostType.ANNOUNCEMENT) {
        return { success: false, error: "Los coaches solo pueden publicar contenido de publicidad o anuncios sobre lo que hacen." };
      }

      // ValidaciÃ³n de cuota semanal por plan
      const quotaRes = await getCoachAdQuota(auth.id);
      if (quotaRes.success && quotaRes.quota && !quotaRes.quota.canPost) {
        return {
          success: false,
          error: `Has alcanzado el lÃ­mite de ${quotaRes.quota.limit} anuncios por semana permitido para tu Plan ${quotaRes.quota.tierName}. Mejora tu plan para obtener mÃƒs publicaciones.`
        };
      }
    } else {
// Los aprendices pueden publicar dudas (Busco Coach / Busco Curso)
      if (postType !== ("REQ_REC_COACH" as any) && postType !== ("REQ_REC_COURSE" as any)) {
        postType = PostType.DOUBT;
      }

    }

    const serializedImage = Array.isArray(imageUrl)
      ? JSON.stringify(imageUrl)
      : (imageUrl || null);

    const post = await prisma.communityPost.create({
      data: {
        title: "Comunidad Post", 
        content,
        postType,
        tags: serializeCommunityTags(tags, false, undefined, mentionedEntity),
        authorId: auth.id,
        imageUrl: serializedImage,
      },
    });

    revalidatePath("/comunidad");
    await checkAndNotifyMentions(content, auth.name || "Usuario", post.id); return { success: true, post };
  } catch (error) {
    console.error("Error creating post:", error);
    return { success: false, error: "OcurriÃ³ un error al crear la publicaciÃ³n." };
  }
}

export async function toggleLike(postId: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {

    const rateLimit = getRateLimitResult(auth?.id || "", "community-like", 30, 60_000);
    if (!rateLimit.allowed) {
      return { success: false, error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto." };
    }
      return { success: false, error: "Debes iniciar sesión para reaccionar." };
    }

    // Verificar si el usuario está suspendido
    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return {
        success: false,
        error: `⛔ Tu cuenta está suspendida. Podrás volver a interactuar en ${reactivateCheck.remainingText}.`,
        isSuspended: true,
      };
    }

    const existingLike = await prisma.communityLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: auth.id,
        },
      },
      select: {
        id: true,
        // reaction: true,
      },
    });

    if (existingLike) {
      // if (existingLike.reaction === reaction) {
      if (true) { // Temporary: until DB is updated, any second click removes the like
        // Misma reacción: desmarcar (quitar reacción)
        await prisma.communityLike.delete({
          where: { id: existingLike.id },
        });
        revalidatePath("/comunidad");
        revalidatePath(`/comunidad/post/${postId}`);
        return { success: true, liked: false, reaction: null };
      } else {
        // Reacción diferente: actualizar tipo de reacción
        /*
        await prisma.communityLike.update({
          where: { id: existingLike.id },
          data: { reaction },
        });
        revalidatePath("/comunidad");
        revalidatePath(`/comunidad/post/${postId}`);
        return { success: true, liked: true, reaction, changed: true };
        */
      }
    } else {
      const newLike = await prisma.communityLike.create({
        data: {
          postId,
          userId: auth.id,
          // reaction,
        },
        select: {
          id: true,
          post: {
            select: {
              authorId: true,
              title: true,
              authorRole: true,
            },
          },
        },
      });

      // Crear notificación para el autor del post (si no es el mismo que reacciona)
      if (newLike.post?.authorId && newLike.post.authorId !== auth.id) {
        try {
          const targetRole = newLike.post.authorRole === "COACH" ? "coach" : "student";
          await prisma.notification.create({
            data: {
              userId: newLike.post.authorId,
              type: NotificationType.SYSTEM,
              title: "Nuevo 'Me gusta' en tu publicación",
              body: `${auth.name || 'Un usuario'} le dio 'Me gusta' a tu publicación.`,
              link: `/comunidad/post/${postId}?role=${targetRole}`,
            }
          });
        } catch (e) {
          console.error("Error creating like notification", e);
        }
      }

      revalidatePath("/comunidad");
      revalidatePath(`/comunidad/post/${postId}`);
      return { success: true, liked: true };
    }
  } catch (error) {
    console.error("Error toggling like:", error);
    return { success: false, error: "Error al registrar la reacción." };
  }
}

export async function getCommunitySidebarData() {
  try {
    // Miembros activos en vivo: consultamos las sesiones activas en la base de datos
    const activeSessions = await prisma.session.findMany({
      where: {
        expiresAt: { gt: new Date() },
        user: { status: "ACTIVE" },
      },
      select: {
        userId: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            avatarUrl: true,
            interests: true,
            updatedAt: true,
            coachProfile: { select: { photoUrl: true, headline: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    const seenUsers = new Set<string>();
    let activeMembers: any[] = [];
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    for (const s of activeSessions) {
      if (!s.user || seenUsers.has(s.user.id)) continue;
      seenUsers.add(s.user.id);
      const lastActiveMs = Math.max(s.createdAt ? new Date(s.createdAt).getTime() : 0, s.user.updatedAt ? new Date(s.user.updatedAt).getTime() : 0);
      const isRecent = now - lastActiveMs <= FIVE_MINUTES;
      const isOnlineHidden = Array.isArray(s.user.interests) ? (s.user.interests).includes("_ONLINE_HIDDEN") : false;
      activeMembers.push({ id: s.user.id, name: s.user.name, role: s.user.role, headline: s.user.coachProfile?.headline || (s.user.role === "COACH" ? "Coach CFH" : s.user.role === "ADMIN" ? "Equipo CFH" : "Aprendiz CFH"), avatarUrl: s.user.coachProfile?.photoUrl || s.user.avatarUrl, isOnline: isOnlineHidden ? false : isRecent });
      if (activeMembers.length >= 8) break;
    }

    // Complementar con miembros de la comunidad para mostrar también desconectados
    if (activeMembers.length < 8) {
      const dbFallback = await prisma.user.findMany({
        where: {
          id: { notIn: Array.from(seenUsers) },
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          role: true,
          avatarUrl: true,
          interests: true,
          coachProfile: { select: { photoUrl: true, headline: true } },
        },
        take: 8 - activeMembers.length,
      });

      dbFallback.forEach((u) => {
        seenUsers.add(u.id);
        const isOnlineHidden = Array.isArray(u.interests) ? (u.interests).includes("_ONLINE_HIDDEN") : false;

        activeMembers.push({
          id: u.id,
          name: u.name,
          role: u.role,
          headline: u.coachProfile?.headline || (u.role === "COACH" ? "Coach CFH" : u.role === "ADMIN" ? "Equipo CFH" : "Aprendiz CFH"),
          avatarUrl: u.coachProfile?.photoUrl || u.avatarUrl,
          isOnline: false,
        });
      });
    }
    
    // Sort so online users appear first
    activeMembers.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));

    // Temas Populares (Tags)
    const recentPostsWithTags = await prisma.communityPost.findMany({
      where: { isVisible: true },
      select: { tags: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    const tagCounts: Record<string, number> = {};
    recentPostsWithTags.forEach((post) => {
      const { tags: cleanPostTags } = parseCommunityTags(post.tags);
      cleanPostTags.forEach((tag: string) => {
        if (
          typeof tag === "string" &&
          tag.trim().length > 1 &&
          !tag.startsWith("__") &&
          !tag.startsWith("_CFH_") &&
          !tag.includes("RESOLVED")
        ) {
          let formatted = tag.trim();
          // Corregir posibles errores de codificación
          formatted = formatted
            .replace(/Programaci[Ãã][³o]n/gi, "Programación")
            .replace(/Dise[Ãã][±n]oUI/gi, "DiseñoUI");
          const cleanTag = formatted.startsWith("#") ? formatted : `#${formatted}`;
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        }
      });
    });

    const curatedFallbacks = ["#Programación", "#Frontend", "#IA", "#Coaching", "#DiseñoUI", "#CursosOnline"];
    let popularTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    // Si hay menos de 6 etiquetas reales, complementar con temas destacados
    if (popularTags.length < 6) {
      const existing = new Set(popularTags.map(t => t.toLowerCase()));
      for (const fallback of curatedFallbacks) {
        if (!existing.has(fallback.toLowerCase())) {
          popularTags.push(fallback);
          if (popularTags.length >= 6) break;
        }
      }
    } else {
      popularTags = popularTags.slice(0, 6);
    }

    return { activeMembers, popularTags };
  } catch (error) {
    console.error("Error getting sidebar data:", error);
    return { activeMembers: [], popularTags: [] };
  }
}

export async function reportPost(postId: string, reason: string, details?: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {

    const rateLimit = getRateLimitResult(auth?.id || "", "community-report", 5, 60_000);
    if (!rateLimit.allowed) {
      return { success: false, error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto." };
    }
      return { success: false, error: "Debes iniciar sesión para reportar una publicaciÃ³n." };
    }

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });

    if (!post) {
      return { success: false, error: "La publicaciÃ³n no existe o fue eliminada." };
    }

    if (post.authorId === auth.id) {
      return { success: false, error: "No puedes reportar tu propia publicaciÃ³n." };
    }

    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: auth.id,
        reportedPostId: postId,
      },
    });

    if (existingReport) {
      return { success: false, error: "Ya has enviado un reporte para esta publicaciÃ³n anteriormente." };
    }

    const fullReason = details?.trim() ? `${reason} - ${details.trim()}` : reason;

    await prisma.report.create({
      data: {
        reporterId: auth.id,
        reportedPostId: postId,
        reportedUserId: post.authorId,
        reason: fullReason,
        status: "PENDING",
      },
    });

    // Auto-moderaciÃ³n preventiva: Si acumula 3 o mÃƒs reportes pendientes, ocultar el post preventivamente
    const pendingReportsCount = await prisma.report.count({
      where: {
        reportedPostId: postId,
        status: "PENDING",
      },
    });

    if (pendingReportsCount >= 3) {
      await prisma.communityPost.update({
        where: { id: postId },
        data: { isVisible: false },
      });
      revalidatePath("/comunidad");
    }

    return { success: true, message: "Tu reporte ha sido enviado con Ã©xito y serÃƒ revisado por el equipo de moderaciÃ³n." };
  } catch (error) {
    console.error("Error reporting post:", error);
    return { success: false, error: "OcurriÃ³ un error al procesar el reporte. IntÃ©ntalo de nuevo mÃƒs tarde." };
  }
}

export async function reportComment(commentId: string, reason: string, details?: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {
      return { success: false, error: "Debes iniciar sesión para reportar un comentario." };
    }

    const comment = await prisma.communityComment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, postId: true },
    });

    if (!comment) {
      return { success: false, error: "El comentario no existe o fue eliminado." };
    }

    if (comment.authorId === auth.id) {
      return { success: false, error: "No puedes reportar tu propio comentario." };
    }

    const fullReason = details?.trim() ? `${reason} - ${details.trim()}` : reason;

    await prisma.report.create({
      data: {
        reporterId: auth.id,
        reportedUserId: comment.authorId,
        reportedPostId: comment.postId,
        reason: `[Comentario: ${commentId}] ${fullReason}`,
        status: "PENDING",
      },
    });

    // Auto-moderaciÃ³n de comentario: si acumula 3 reportes, ocultarlo
    const commentReportsCount = await prisma.report.count({
      where: {
        reportedPostId: comment.postId,
        reason: { startsWith: `[Comentario: ${commentId}]` },
        status: "PENDING",
      },
    });

    if (commentReportsCount >= 3) {
      await prisma.communityComment.update({
        where: { id: commentId },
        data: { isVisible: false },
      });
      revalidatePath(`/comunidad/post/${comment.postId}`);
      revalidatePath("/comunidad");
    }

    return { success: true, message: "El comentario ha sido reportado con Ã©xito." };
  } catch (error) {
    console.error("Error reporting comment:", error);
    return { success: false, error: "Error al reportar el comentario." };
  }
}

export async function getPublicUserProfile(userId: string) {
  try {
    const auth = await getAuthenticatedUser();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        avatarUrl: true,
        region: true,
        countryCode: true,
        interests: true,
        goals: true,
        createdAt: true,
        coachProfile: {
          select: {
            id: true,
            slug: true,
            headline: true,
            biography: true,
            currentTier: true,
            approvalStatus: true,
            photoUrl: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const [totalPosts, totalComments] = await Promise.all([
      prisma.communityPost.count({
        where: { authorId: userId, isVisible: true },
      }),
      prisma.communityComment.count({
        where: { authorId: userId, isVisible: true },
      }),
    ]);

    // Obtener publicaciones públicas del usuario
    const userPosts = await prisma.communityPost.findMany({
      where: { authorId: userId, isVisible: true },
      include: {
        _count: {
          select: { comments: true, likes: true },
        },
        likes: {
          select: { id: true, userId: true }, // reaction: true temporarily removed
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalLikesReceived = userPosts.reduce((acc, p) => acc + p._count.likes, 0);

    const finalAvatarUrl = (user as any).coachProfile?.photoUrl || user.avatarUrl;

    const posts = userPosts.map((post) => {
      const userLike = auth?.id ? post.likes.find((l) => l.userId === auth.id) : null;
        const reactionTypes: string[] = []; // Array.from(new Set(post.likes.map((l) => l.reaction)));
        return {
          ...post,
          hasLiked: !!userLike,
          userReaction: null, // userLike ? userLike.reaction : null,
          reactionTypes,
        tags: Array.isArray(post.tags) ? post.tags : [],
        author: {
          id: user.id,
          name: user.name,
          role: user.role,
          avatarUrl: finalAvatarUrl,
          region: user.region,
        },
      };
    });

    return {
      user: {
        ...user,
        avatarUrl: finalAvatarUrl,
        stats: {
          totalPosts,
          totalComments,
          totalLikesReceived,
        },
      },
      posts,
      isCurrentUser: auth?.id === userId,
    };
  } catch (error) {
    console.error("Error fetching public user profile:", error);
    return null;
  }
}

export async function createComment(postId: string, content: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {
      return { success: false, error: "Debes iniciar sesión para comentar." };
    }

    const rateLimit = getRateLimitResult(auth?.id || "", "community-comment", 20, 60_000);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto antes de comentar otra vez.",
      };
    }

    const cookieStore = await cookies();
    const activeRole = cookieStore.get("cfh_active_role")?.value || auth.role;

    if (activeRole === UserRole.COACH) {
      return { success: false, error: "Los coaches solo pueden compartir publicidad y no participar en comentarios de dudas." };
    }

    if (!content.trim()) {
      return { success: false, error: "El comentario no puede estar vacÃ­o." };
    }

    // Verificar si el usuario estÃƒ suspendido
    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return {
        success: false,
        error: `Ã¢â€ºâ€ Tu cuenta estÃƒ suspendida por incumplimiento de las normas de la comunidad. PodrÃƒs volver a participar en ${reactivateCheck.remainingText}.`,
        isSuspended: true,
      };
    }

    // 0. Validación Anti-Spam (repetir más de 3 veces bloquea por 1:30h)
    const spamCheck = await validateSpamRule(auth.id, content);
    if (spamCheck.isSpam) {
      return {
        success: false,
        error: spamCheck.error,
        isSpamBlocked: true,
        remainingText: spamCheck.remainingText,
        timeoutUntil: spamCheck.timeoutUntil?.toISOString(),
        formattedHour: spamCheck.formattedHour,
      };
    }

    // 1. ValidaciÃ³n de seguridad Anti-Bypass
    const safety = validateCommunitySafety(content);
    if (!safety.isValid) {
      const strikeResult = await checkAndHandleCommunityStrike(auth.id, safety.reason || "InformaciÃ³n restringida", content);
      return {
        success: false,
        error: strikeResult.warningMessage,
        isSuspended: strikeResult.isSuspended,
      };
    }

    // 2. ValidaciÃ³n de respuestas verificadas (Solo alumnos con clase/curso previo del coach o curso mencionado)
    const canCommentCheck = await canUserCommentOnPost(postId);
    if (!canCommentCheck.canComment) {
      return {
        success: false,
        error: canCommentCheck.reason || "No tienes permiso para comentar en esta publicaciÃ³n.",
      };
    }

    const comment = await prisma.communityComment.create({
      data: {
        postId,
        authorId: auth.id,
        content: content.trim(),
      },
      include: {
        post: {
          select: {
            authorId: true,
            authorRole: true,
          },
        },
      },
    });

    if (comment.post?.authorId && comment.post.authorId !== auth.id) {
      try {
        const targetRole = comment.post.authorRole === "COACH" ? "coach" : "student";
        await prisma.notification.create({
          data: {
            userId: comment.post.authorId,
            type: NotificationType.SYSTEM,
            title: "Nuevo comentario",
            body: `${auth.name || 'Un usuario'} comentó en tu publicación.`,
            link: `/comunidad/post/${postId}?role=${targetRole}`,
          },
        });
      } catch (e) {
        console.error("Error creating comment notification", e);
      }
    }

    revalidatePath("/comunidad");
    revalidatePath(`/comunidad/post/${postId}`);
    await checkAndNotifyMentions(content, auth.name || "Usuario", postId);
    return { success: true, commentId: comment.id, comment };
  } catch (error) {
    console.error("Error creating comment:", error);
    return { success: false, error: "Hubo un error al crear el comentario." };
  }
}

export async function deletePost(postId: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) return { success: false, error: "No autorizado" };

    const rateLimit = getRateLimitResult(auth?.id || "", "community-post-delete", 10, 60_000);
    if (!rateLimit.allowed) {
      return { success: false, error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto." };
    }

    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return { success: false, error: "Tu cuenta estÃƒ suspendida.", isSuspended: true };
    }

    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== auth.id) return { success: false, error: "No autorizado" };

    await prisma.communityPost.delete({ where: { id: postId } });
    revalidatePath("/comunidad");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error al borrar el post" };
  }
}

export async function updatePost(postId: string, content: string, imageUrl?: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) return { success: false, error: "No autorizado" };

    const rateLimit = getRateLimitResult(auth?.id || "", "community-post-edit", 15, 60_000);
    if (!rateLimit.allowed) {
      return { success: false, error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto." };
    }

    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.authorId !== auth.id) return { success: false, error: "No autorizado" };

    // ValidaciÃ³n de ventana de ediciÃ³n de 15 minutos
    const editCheck = canEditPostOrComment(post.createdAt, 15);
    if (!editCheck.canEdit) {
      return { success: false, error: "El tiempo lÃ­mite para editar esta publicaciÃ³n (15 minutos) ha expirado." };
    }

    // Verificar si el usuario estÃƒ suspendido
    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return {
        success: false,
        error: `Ã¢â€ºâ€ Tu cuenta estÃƒ suspendida. PodrÃƒs volver a participar en ${reactivateCheck.remainingText}.`,
        isSuspended: true,
      };
    }

    // 0. Validación Anti-Spam (repetir más de 3 veces bloquea por 1:30h)
    const spamCheck = await validateSpamRule(auth.id, content);
    if (spamCheck.isSpam) {
      return {
        success: false,
        error: spamCheck.error,
        isSpamBlocked: true,
        remainingText: spamCheck.remainingText,
        timeoutUntil: spamCheck.timeoutUntil?.toISOString(),
        formattedHour: spamCheck.formattedHour,
      };
    }

    // ValidaciÃ³n de seguridad Anti-Bypass
    const safety = validateCommunitySafety(content);
    if (!safety.isValid) {
      const strikeResult = await checkAndHandleCommunityStrike(auth.id, safety.reason || "InformaciÃ³n restringida", content);
      return {
        success: false,
        error: strikeResult.warningMessage,
        isSuspended: strikeResult.isSuspended,
      };
    }

    await prisma.communityPost.update({
      where: { id: postId },
      data: { content, ...(imageUrl !== undefined ? { imageUrl } : {}) }
    });
    revalidatePath("/comunidad");
    revalidatePath(`/comunidad/post/${postId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error al actualizar el post" };
  }
}

export async function deleteComment(commentId: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) return { success: false, error: "No autorizado" };

    const rateLimit = getRateLimitResult(auth?.id || "", "community-comment-delete", 10, 60_000);
    if (!rateLimit.allowed) {
      return { success: false, error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto." };
    }

    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return { success: false, error: "Tu cuenta estÃƒ suspendida.", isSuspended: true };
    }

    const comment = await prisma.communityComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== auth.id) return { success: false, error: "No autorizado" };

    await prisma.communityComment.delete({ where: { id: commentId } });
    revalidatePath("/comunidad");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error al borrar el comentario" };
  }
}

export async function updateComment(commentId: string, content: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) return { success: false, error: "No autorizado" };

    const rateLimit = getRateLimitResult(auth?.id || "", "community-comment-edit", 15, 60_000);
    if (!rateLimit.allowed) {
      return { success: false, error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto." };
    }

    const comment = await prisma.communityComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.authorId !== auth.id) return { success: false, error: "No autorizado" };

    // ValidaciÃ³n de ventana de ediciÃ³n de 15 minutos
    const editCheck = canEditPostOrComment(comment.createdAt, 15);
    if (!editCheck.canEdit) {
      return { success: false, error: "El tiempo lÃ­mite para editar este comentario (15 minutos) ha expirado." };
    }

    // Verificar si el usuario estÃƒ suspendido
    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return {
        success: false,
        error: `Ã¢â€ºâ€ Tu cuenta estÃƒ suspendida. PodrÃƒs volver a participar en ${reactivateCheck.remainingText}.`,
        isSuspended: true,
      };
    }

    // ValidaciÃ³n de seguridad Anti-Bypass
    const safety = validateCommunitySafety(content);
    if (!safety.isValid) {
      const strikeResult = await checkAndHandleCommunityStrike(auth.id, safety.reason || "InformaciÃ³n restringida", content);
      return {
        success: false,
        error: strikeResult.warningMessage,
        isSuspended: strikeResult.isSuspended,
      };
    }

    await prisma.communityComment.update({
      where: { id: commentId },
      data: { content }
    });
    revalidatePath("/comunidad");
    revalidatePath(`/comunidad/post/${comment.postId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: "Error al actualizar el comentario" };
  }
}

export async function getPostComments(postId: string) {
  try {
    const comments = await prisma.communityComment.findMany({
      where: { postId, isVisible: true },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            coachProfile: {
              select: {
                photoUrl: true,
                slug: true,
                headline: true,
                hourlyRateCents: true,
                currency: true,
                averageRating: true,
                reviewCount: true,
                level: true,
                categories: {
                  select: {
                    category: { select: { name: true } }
                  }
                }
              }
            }
          }
        },
        recommendedCoach: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            coachProfile: { select: { headline: true, photoUrl: true, slug: true } }
          }
        },
        _count: {
          select: { likes: true }
        }
      },
      orderBy: { createdAt: "asc" }
    });
    return comments.map(c => ({
      ...c,
      author: {
        ...c.author,
        avatarUrl: (c.author as any).coachProfile?.photoUrl || c.author.avatarUrl
      },
      recommendedCoach: c.recommendedCoach ? {
        ...c.recommendedCoach,
        avatarUrl: (c.recommendedCoach as any).coachProfile?.photoUrl || c.recommendedCoach.avatarUrl
      } : null
    }));
  } catch (error) {
    console.error("Error fetching comments:", error);
    return [];
  }
}

export async function getPostById(postId: string) {
  try {
    const auth = await getAuthenticatedUser();
    const cookieStore = await cookies();
    const activeRoleCookie = cookieStore.get("cfh_active_role")?.value;
    const activeRole = activeRoleCookie || auth?.role;
    const isCoach = activeRole === UserRole.COACH;
    
    const post = await prisma.communityPost.findFirst({
      where: { id: postId, isVisible: true },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            avatarUrl: true,
            region: true,
            coachProfile: {
              select: {
                photoUrl: true,
                slug: true,
                headline: true,
                hourlyRateCents: true,
                currency: true,
                averageRating: true,
                reviewCount: true,
                level: true,
                categories: {
                  select: {
                    category: { select: { name: true } }
                  }
                }
              }
            },
          },
        },
        _count: {
          select: { comments: true, likes: true },
        },
        comments: {
          where: { isVisible: true },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                role: true,
                coachProfile: {
                  select: {
                    photoUrl: true,
                    slug: true,
                    headline: true,
                    hourlyRateCents: true,
                    currency: true,
                    averageRating: true,
                    reviewCount: true,
                    level: true,
                    categories: {
                      select: {
                        category: { select: { name: true } }
                      }
                    }
                  }
                }
              }
            },
            recommendedCoach: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                coachProfile: { select: { headline: true, photoUrl: true, slug: true } }
              }
            }
          },
          orderBy: { createdAt: "asc" }
        },
        likes: {
          select: { id: true, userId: true }, // reaction: true temporarily removed
        },
      },
    });

    if (!post) return null;

    const { tags: cleanTags, isResolved, resolvedCommentId } = parseCommunityTags(post.tags);
    const mentionedEntity = parseCommunityMentions(post.tags);

    let canComment = true;
    let commentReason: string | undefined = undefined;

    if (isCoach) {
          canComment = false;
          commentReason = "Los coaches solo pueden publicar contenido publicitario y no participar en consultas ni encuestas de alumnos.";
    } else if (!auth?.id) {
      if (mentionedEntity) {
        canComment = false;
        commentReason = "Debes iniciar sesión para participar en esta consulta.";
      }
    } else if (mentionedEntity) {
      if (mentionedEntity.type === "coach") {
        const [bookingCount, enrollmentCount] = await Promise.all([
          prisma.booking.count({
            where: {
              studentId: auth.id,
              coachId: mentionedEntity.id,
              status: { in: ["COMPLETED", "CONFIRMED"] },
            },
          }),
          prisma.enrollment.count({
            where: {
              studentId: auth.id,
              course: { coachId: mentionedEntity.id },
            },
          }),
        ]);
        if (bookingCount === 0 && enrollmentCount === 0) {
          canComment = false;
          commentReason = `🔒 Publicación Verificada: Solo los estudiantes que han tomado clases o cursos con @${mentionedEntity.name} pueden compartir su experiencia o responder en esta consulta.`;
        }
      } else if (mentionedEntity.type === "course") {
        const enrollmentCount = await prisma.enrollment.count({
          where: {
            studentId: auth.id,
            courseId: mentionedEntity.id,
          },
        });
        if (enrollmentCount === 0) {
          canComment = false;
          commentReason = `🔒 Publicación Verificada: Solo los estudiantes inscritos en el curso "${mentionedEntity.name}" pueden compartir su experiencia o responder en esta consulta.`;
        }
      }
    }

    const userLike = auth?.id ? post.likes.find((l) => l.userId === auth.id) : null;
    const reactionTypes: string[] = []; // Array.from(new Set(post.likes.map((l) => l.reaction)));

    return {
      ...post,
      hasLiked: !!userLike,
      userReaction: null, // userLike?.reaction || null,
      reactionTypes,
      tags: cleanTags,
      mentionedEntity,
      isResolved,
      resolvedCommentId,
      canComment,
      commentReason,
      author: {
        ...post.author,
        avatarUrl: (post.author as any).coachProfile?.photoUrl || post.author.avatarUrl
      },
      currentUserId: auth?.id || null,
      comments: post.comments.map(c => ({
        ...c,
        hasLiked: false, // CommentLike table missing in DB
        likesCount: 0, // CommentLike table missing in DB
        author: {
          ...c.author,
          avatarUrl: (c.author as any).coachProfile?.photoUrl || c.author.avatarUrl
        },
        recommendedCoach: (c as any).recommendedCoach ? {
          ...(c as any).recommendedCoach,
          avatarUrl: (c as any).recommendedCoach.coachProfile?.photoUrl || (c as any).recommendedCoach.avatarUrl
        } : null
      })),
    };
  } catch (error: any) {
    console.error("Error fetching post by id:", error);
    return null;
  }
}

export async function toggleCommentLike(commentId: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {
      return { success: false, error: "Debes iniciar sesión." };
    }

    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return {
        success: false,
        error: `Ã¢â€ºâ€ Tu cuenta estÃƒ suspendida. PodrÃƒs volver a interactuar en ${reactivateCheck.remainingText}.`,
        isSuspended: true,
      };
    }

    const existing = await prisma.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId: auth.id,
        },
      },
    });

    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
      return { success: true, liked: false };
    } else {
      await prisma.commentLike.create({
        data: { commentId, userId: auth.id },
      });
      return { success: true, liked: true };
    }
  } catch (error) {
    console.error("Error toggling comment like:", error);
    return { success: false, error: "Error al procesar." };
  }
}

export async function getCoachPromotionEligibility(coachId: string): Promise<boolean> {
  try {
    const coach = await prisma.user.findUnique({
      where: { id: coachId },
      select: { createdAt: true }
    });

    if (!coach) return false;

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    
    if (coach.createdAt > oneMonthAgo) {
      return false;
    }

    const completedBookings = await prisma.booking.findMany({
      where: { coachId, status: 'COMPLETED' },
      select: { studentId: true }
    });

    const activeEnrollments = await prisma.enrollment.findMany({
      where: { 
        status: 'ACTIVE',
        course: { coachId } 
      },
      select: { studentId: true }
    });

    const uniqueStudentIds = new Set([
      ...completedBookings.map(b => b.studentId),
      ...activeEnrollments.map(e => e.studentId)
    ]);

    return uniqueStudentIds.size >= 5;
  } catch (error) {
    console.error("Error checking coach promotion eligibility:", error);
    return false;
  }
}
export async function getRecommendableCoaches(studentId: string) {
  // 1. Get coaches from courses bought
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: { course: { select: { coach: { select: { id: true, name: true, avatarUrl: true } } } } }
  });

  const enrolledCoaches = enrollments.map(e => e.course.coach);

  // 2. Get coaches from >= 2 completed bookings
  const completedBookings = await prisma.booking.groupBy({
    by: ['coachId'],
    where: { studentId, status: 'COMPLETED', isFreeIntro: false },
    _count: { id: true },
    having: { id: { _count: { gte: 2 } } }
  });

  const bookedCoachIds = completedBookings.map(b => b.coachId);
  
  const bookedCoaches = await prisma.user.findMany({
    where: { id: { in: bookedCoachIds } },
    select: { id: true, name: true, avatarUrl: true }
  });

  // Combine and deduplicate
  const allCoaches = [...enrolledCoaches, ...bookedCoaches];
  const uniqueCoachesMap = new Map();
  for (const c of allCoaches) {
    if (c && !uniqueCoachesMap.has(c.id)) {
      uniqueCoachesMap.set(c.id, c);
    }
  }

  return Array.from(uniqueCoachesMap.values());
}



export async function getMyRecommendableCoaches() {
  const auth = await getAuthenticatedUser();
  if (!auth?.id) return { success: false, error: 'Unauthorized' };
  
  const coaches = await getRecommendableCoaches(auth.id);
  return { success: true, coaches };
}

export async function recommendCoachInPost(postId: string, recommendedCoachId: string, content: string) {
  const auth = await getAuthenticatedUser();
  if (!auth?.id || auth.role !== 'STUDENT') {
    return { success: false, error: 'Solo los alumnos pueden recomendar coaches.' };
  }

  // Verificar si el usuario estÃƒ suspendido
  const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
  if (reactivateCheck.isSuspended) {
    return {
      success: false,
      error: `Ã¢â€ºâ€ Tu cuenta estÃƒ suspendida. PodrÃƒs volver a participar en ${reactivateCheck.remainingText}.`,
      isSuspended: true,
    };
  }

  // ValidaciÃ³n de seguridad Anti-Bypass
  const safety = validateCommunitySafety(content);
  if (!safety.isValid) {
    const strikeResult = await checkAndHandleCommunityStrike(auth.id, safety.reason || "InformaciÃ³n restringida", content);
    return {
      success: false,
      error: strikeResult.warningMessage,
      isSuspended: strikeResult.isSuspended,
    };
  }

  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post || (post.postType as string) !== 'REQ_REC_COACH') {
    return { success: false, error: 'Solo puedes recomendar coaches en posts de Busco Coach.' };
  }
  
  const recCheck = await canRecommendCoach(auth.id, recommendedCoachId);
  if (!recCheck.success) {
    return recCheck;
  }

  const eligibleCoaches = await getRecommendableCoaches(auth.id);
  if (!eligibleCoaches.find(c => c.id === recommendedCoachId)) {
    return { success: false, error: 'No cumples los requisitos para recomendar a este coach.' };
  }

  const comment = await prisma.communityComment.create({
    data: {
      postId,
      authorId: auth.id,
      content: content || 'Te recomiendo a este coach.',
      recommendedCoachId
    }
  });

  await notifyCoachStudentsOfMention(recommendedCoachId, auth.name || "Usuario", postId); return { success: true, comment };
}

export async function markQuestionResolved(postId: string, resolvedCommentId?: string) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) return { success: false, error: "Debes iniciar sesión para realizar esta acciÃ³n." };

    const rateLimit = getRateLimitResult(auth?.id || "", "community-mark-resolved", 10, 60_000);
    if (!rateLimit.allowed) {
      return { success: false, error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto." };
    }

    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return {
        success: false,
        error: `Ã¢â€ºâ€ Tu cuenta estÃƒ suspendida. PodrÃƒs volver a interactuar en ${reactivateCheck.remainingText}.`,
        isSuspended: true,
      };
    }

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, postType: true, tags: true }
    });

    if (!post) return { success: false, error: "PublicaciÃ³n no encontrada." };
    if (post.authorId !== auth.id && (auth as any).role !== "ADMIN") {
      return { success: false, error: "Solo el autor de la pregunta puede marcarla como resuelta." };
    }

    const parsed = parseCommunityTags(post.tags);
    // Si ya estaba resuelta con este mismo comentario, toggle para desmarcar
    const isSameComment = parsed.isResolved && parsed.resolvedCommentId === resolvedCommentId;
    const shouldResolve = !isSameComment;
    const newTags = serializeCommunityTags(parsed.tags, shouldResolve, shouldResolve ? resolvedCommentId : undefined);

    await prisma.communityPost.update({
      where: { id: postId },
      data: { tags: newTags },
    });

    revalidatePath("/comunidad");
    revalidatePath(`/comunidad/post/${postId}`);

    return {
      success: true,
      isResolved: shouldResolve,
      resolvedCommentId: shouldResolve ? resolvedCommentId : undefined,
      message: shouldResolve ? "Ã‚Pregunta marcada como resuelta!" : "Pregunta desmarcada como resuelta.",
    };
  } catch (err: any) {
    console.error("Error en markQuestionResolved:", err);
    return { success: false, error: err?.message || "Error al actualizar el estado de la pregunta." };
  }
}

export async function canRecommendCoach(studentId: string, coachId: string): Promise<{ success: boolean; error?: string }> {
  if (studentId === coachId) return { success: false, error: "No puedes recomendarte a ti mismo." };

  const enrollmentCount = await prisma.enrollment.count({
    where: { studentId, course: { coachId } }
  });
  if (enrollmentCount > 0) return { success: true };
  
  // 2 COMPLETED bookings (paid)
  const count = await prisma.booking.count({
    where: {
      studentId,
      coachId,
      status: 'COMPLETED',
      isFreeIntro: false
    }
  });

  if (count >= 2) return { success: true };
  return { success: false, error: "Debes haber completado al menos 2 sesiones de pago o estar inscrito en un curso con este coach para poder recomendarlo." };
}

export async function canRecommendCourse(studentId: string, courseId: string): Promise<{ success: boolean; error?: string }> {
  // Get all lessons for the course
  const totalLessons = await prisma.courseLesson.count({
    where: { moduleId: { in: await prisma.courseModule.findMany({ where: { courseId }, select: { id: true } }).then(m => m.map(x => x.id)) } }
  });

  if (totalLessons === 0) return { success: true }; // Empty course is recommendable? Or maybe false? Let's say false.
  
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, courseId }
  });

  if (!enrollment) return { success: false, error: "Debes estar inscrito en este curso para recomendarlo." };

  const completedLessons = await prisma.lessonProgress.count({
    where: {
      enrollmentId: enrollment.id,
      completedAt: { not: null }
    }
  });

  if (completedLessons / totalLessons > 0.5) return { success: true };
  
  return { success: false, error: "Debes haber completado mÃƒs del 50% del curso para poder recomendarlo." };
}

export async function getSuspensionInfo(targetUserId?: string): Promise<SuspensionDetails> {
  try {
    const auth = await getAuthenticatedUser();
    const userId = targetUserId || auth?.id;
    if (!userId) return { isSuspended: false };
    return await getSuspensionDetails(userId);
  } catch (err) {
    console.error("Error al consultar detalles de suspensiÃ³n:", err);
    return { isSuspended: false };
  }
}


async function notifyCoachStudentsOfMention(coachId: string, authorName: string, postId: string, commentId?: string) {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        course: { coachId },
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      select: { studentId: true }
    });

    const bookings = await prisma.booking.findMany({
      where: {
        coachId,
        status: { in: ["CONFIRMED", "COMPLETED", "REQUESTED"] }
      },
      select: { studentId: true }
    });

    const studentIds = new Set<string>();
    enrollments.forEach(e => studentIds.add(e.studentId));
    bookings.forEach(b => studentIds.add(b.studentId));
    studentIds.delete(coachId); // No notificar al propio coach
    
    if (studentIds.size > 0) {
      const notifications = Array.from(studentIds).map(userId => ({
        userId,
        type: NotificationType.COMMUNITY,
        title: "Coach Mencionado",
        body: `Tu coach ha sido mencionado o recomendado en la comunidad por ${authorName}. Quizas te interese ver lo que dicen!`,
        link: commentId ? `/comunidad/post/${postId}?role=student#comment-${commentId}` : `/comunidad/post/${postId}?role=student`,
      }));

      await prisma.notification.createMany({
        data: notifications
      });
    }
  } catch (error) {
    console.error("Error notifyCoachStudentsOfMention:", error);
  }
}

async function checkAndNotifyMentions(content: string, authorName: string, postId: string, commentId?: string) {
  try {
    const coaches = await prisma.user.findMany({
      where: { role: "COACH", status: "ACTIVE" },
      select: { id: true, name: true }
    });
    
    for (const coach of coaches) {
      // Escape special characters in coach name for regex
      const escapedName = coach.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escapedName}\\b`, "i");
      
      if (regex.test(content) || content.includes(`@${coach.name}`)) {
        await notifyCoachStudentsOfMention(coach.id, authorName, postId, commentId);
      }
    }
  } catch (error) {
    console.error("Error checkAndNotifyMentions:", error);
  }
}

export async function searchMentionableEntities(query: string = "") {
  try {
    const cleanQ = query.trim().toLowerCase();

    // 1. Buscar coaches registrados con perfil pÃºblico activo
    const coaches = await prisma.user.findMany({
      where: {
        role: UserRole.COACH,
        coachProfile: { isNot: null },
        ...(cleanQ
          ? {
              OR: [
                { name: { contains: cleanQ } },
                { coachProfile: { headline: { contains: cleanQ } } },
                { coachProfile: { slug: { contains: cleanQ } } },
              ],
            }
          : {}),
      },
      take: 6,
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        coachProfile: {
          select: {
            slug: true,
            photoUrl: true,
            headline: true,
          },
        },
      },
    });

    // 2. Buscar cursos publicados en la plataforma
    const courses = await prisma.course.findMany({
      where: {
        status: "PUBLISHED" as any,
        ...(cleanQ
          ? {
              OR: [
                { title: { contains: cleanQ } },
                { slug: { contains: cleanQ } },
                { summary: { contains: cleanQ } },
              ],
            }
          : {}),
      },
      take: 6,
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnailUrl: true,
        coach: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      coaches: coaches.map((c) => ({
        type: "coach" as const,
        id: c.id,
        slug: c.coachProfile?.slug || c.id,
        name: c.name || "Coach",
        avatarUrl: c.coachProfile?.photoUrl || c.avatarUrl || null,
        headline: c.coachProfile?.headline || "Coach en CoachingFromHome",
      })),
      courses: courses.map((cr) => ({
        type: "course" as const,
        id: cr.id,
        slug: cr.slug,
        name: cr.title,
        avatarUrl: cr.thumbnailUrl || null,
        headline: `Por ${cr.coach?.name || "Coach CFH"}`,
      })),
    };
  } catch (err: any) {
    console.error("Error searching mentionable entities:", err);
    return { success: false, coaches: [], courses: [] };
  }
}

export async function canUserCommentOnPost(postId: string): Promise<{
  canComment: boolean;
  reason?: string;
  mentionedEntity?: MentionedEntity | null;
}> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {
      return { canComment: false, reason: "Debes iniciar sesión para comentar." };
    }

    const cookieStore = await cookies();
    const activeRole = cookieStore.get("cfh_active_role")?.value || auth?.role;
    if (activeRole === UserRole.COACH) {
      return {
        canComment: false,
        reason: "Los coaches solo pueden publicar contenido publicitario y no participar en comentarios de dudas.",
      };
    }

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, tags: true },
    });

    if (!post) {
      return { canComment: false, reason: "PublicaciÃ³n no encontrada." };
    }

    const mentionedEntity = parseCommunityMentions(post.tags);
    if (!mentionedEntity) {
      // Si la publicaciÃ³n no menciona a un coach o curso especÃ­fico, cualquier estudiante puede comentar o interactuar
      return { canComment: true };
    }

    if (mentionedEntity.type === "coach") {
      // Regla estricta: Solo estudiantes que hayan completado una clase/reserva con este coach
      // O estÃ©n inscritos en alguno de los cursos de este coach pueden responder o votar
      const [bookingCount, enrollmentCount] = await Promise.all([
        prisma.booking.count({
          where: {
            studentId: auth.id,
            coachId: mentionedEntity.id,
            status: { in: ["COMPLETED", "CONFIRMED"] },
          },
        }),
        prisma.enrollment.count({
          where: {
            studentId: auth.id,
            course: { coachId: mentionedEntity.id },
          },
        }),
      ]);

      if (bookingCount > 0 || enrollmentCount > 0) {
        return { canComment: true, mentionedEntity };
      }

      return {
        canComment: false,
        reason: `ðŸ”’ PublicaciÃ³n Verificada: Solo los estudiantes que han tomado clases o cursos con @${mentionedEntity.name} pueden compartir su experiencia o responder en esta consulta.`,
        mentionedEntity,
      };
    }

    if (mentionedEntity.type === "course") {
      // Regla estricta: Solo estudiantes inscritos en este curso pueden responder o votar
      const enrollmentCount = await prisma.enrollment.count({
        where: {
          studentId: auth.id,
          courseId: mentionedEntity.id,
        },
      });

      if (enrollmentCount > 0) {
        return { canComment: true, mentionedEntity };
      }

      return {
        canComment: false,
        reason: `ðŸ”’ PublicaciÃ³n Verificada: Solo los estudiantes inscritos en el curso "${mentionedEntity.name}" pueden compartir su experiencia o responder en esta consulta.`,
        mentionedEntity,
      };
    }

    return { canComment: true, mentionedEntity };
  } catch (err: any) {
    console.error("Error in canUserCommentOnPost:", err);
    return { canComment: true };
  }
}

export async function votePollOption(postId: string, optionIndex: number) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {
      return { success: false, error: "Debes iniciar sesión para votar en la encuesta." };
    }

    // Verificar si el usuario estÃ¡ suspendido
    const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
    if (reactivateCheck.isSuspended) {
      return {
        success: false,
        error: `â›” Tu cuenta estÃ¡ suspendida. PodrÃ¡s volver a interactuar en ${reactivateCheck.remainingText}.`,
        isSuspended: true,
      };
    }

    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true, tags: true },
    });

    if (!post) {
      return { success: false, error: "PublicaciÃ³n no encontrada." };
    }

    // Validar permiso de interacciÃ³n verificada
    const perm = await canUserCommentOnPost(postId);
    if (!perm.canComment) {
      return {
        success: false,
        error: perm.reason || "ðŸ”’ Respuestas reservadas: Solo los estudiantes que han tomado clases o cursos con la persona o curso consultado pueden responder o votar.",
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error voting in poll:", err);
    return { success: false, error: "OcurriÃ³ un error al registrar el voto en la encuesta." };
  }
}

export async function getRecommendableCourses(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: { course: { select: { id: true, title: true, thumbnailUrl: true, coach: { select: { name: true } } } } }
  });
  return enrollments.map(e => e.course);
}

export async function getMyRecommendableCourses() {
  const auth = await getAuthenticatedUser();
  if (!auth?.id) return { success: false, error: 'Unauthorized' };
  
  const courses = await getRecommendableCourses(auth.id);
  return { success: true, courses };
}

export async function recommendCourseInPost(postId: string, recommendedCourseId: string, content: string) {
  const auth = await getAuthenticatedUser();
  if (!auth?.id || auth.role !== 'STUDENT') {
    return { success: false, error: 'Solo los alumnos pueden recomendar cursos.' };
  }

  const reactivateCheck = await checkAndAutoReactivateUser(auth.id);
  if (reactivateCheck.isSuspended) {
    return {
      success: false,
      error: `Tu cuenta está suspendida. Podrás volver a participar en ${reactivateCheck.remainingText}.`,
      isSuspended: true,
    };
  }

  const eligibleCourses = await getRecommendableCourses(auth.id);
  const course = eligibleCourses.find(c => c.id === recommendedCourseId);
  if (!course) {
    return { success: false, error: 'No cumples los requisitos para recomendar este curso (debes estar inscrito).' };
  }

  const safety = validateCommunitySafety(content);
  const meta = JSON.stringify({
    id: course.id,
    title: course.title,
    coachName: course.coach.name,
    thumbnailUrl: course.thumbnailUrl
  });
  
  let finalContent = content.trim() || "¡Te recomiendo mucho este curso!";
  finalContent += "\n\n[REC_COURSE:" + meta + "]";

  const comment = await prisma.communityComment.create({
    data: {
      postId,
      authorId: auth.id,
      content: finalContent,
    }
  });

  revalidatePath('/comunidad');
  return { success: true, commentId: comment.id };
}

export async function getSpamStatus() {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) return { isBlocked: false, remainingMinutes: 0, remainingText: "" };
    return await checkUserSpamTimeout(auth.id);
  } catch (err) {
    console.error("Error al consultar estado de spam:", err);
    return { isBlocked: false, remainingMinutes: 0, remainingText: "" };
  }
}

/**
 * Toggles saved/bookmarked status of a community post for the authenticated user.
 * Persists directly to the database via SavedPost Prisma model.
 */
export async function toggleSavePost(postId: string): Promise<{
  success: boolean;
  saved?: boolean;
  isSaved?: boolean;
  error?: string;
  requiresAuth?: boolean;
}> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) {

    const rateLimit = getRateLimitResult(auth?.id || "", "community-save", 30, 60_000);
    if (!rateLimit.allowed) {
      return { success: false, error: "Estás realizando acciones demasiado rápido. Por favor, espera un minuto." };
    }
      return {
        success: false,
        error: "Debes iniciar sesión para guardar publicaciones.",
        requiresAuth: true,
      };
    }

    // Verificar si el post existe y está visible
    const targetPost = await (prisma as any).communityPost.findUnique({
      where: { id: postId },
      select: { id: true, isVisible: true },
    });

    if (!targetPost || !targetPost.isVisible) {
      return {
        success: false,
        error: "La publicación no existe o no está disponible.",
      };
    }

    const existing = await (prisma as any).savedPost.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: auth.id,
        },
      },
    });

    if (existing) {
      await (prisma as any).savedPost.delete({
        where: { id: existing.id },
      });
      revalidatePath("/comunidad");
      revalidatePath(`/comunidad/post/${postId}`);
      return { success: true, saved: false, isSaved: false };
    } else {
      await (prisma as any).savedPost.create({
        data: {
          postId,
          userId: auth.id,
        },
      });
      revalidatePath("/comunidad");
      revalidatePath(`/comunidad/post/${postId}`);
      return { success: true, saved: true, isSaved: true };
    }
  } catch (error) {
    console.error("Error toggling saved post:", error);
    return {
      success: false,
      error: "Ocurrió un error al actualizar la publicación guardada.",
    };
  }
}
/**
 * Fetches all post IDs saved by the currently authenticated user.
 * Returns empty array if unauthenticated.
 */
export async function getUserSavedPostIds(): Promise<string[]> {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth?.id) return [];

    const saved = await (prisma as any).savedPost.findMany({
      where: { userId: auth.id },
      select: { postId: true },
      orderBy: { createdAt: "desc" },
    });

    return saved.map((s: any) => s.postId);
  } catch (error) {
    console.error("Error fetching user saved post ids:", error);
    return [];
  }
}


export async function updateUserPresence() { try { const auth = await getAuthenticatedUser(); if (!auth?.id) return { success: false }; await prisma.user.update({ where: { id: auth.id }, data: { updatedAt: new Date() } }); return { success: true }; } catch (error) { return { success: false }; } }
