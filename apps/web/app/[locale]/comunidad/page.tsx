import { cookies } from "next/headers";
import { getCommunityPosts, getCommunitySidebarData, getCoachPromotionEligibility, getUserSavedPostIds } from "@/app/actions/community";
import CommunityClient from "@/components/CommunityClient";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { getSuspensionDetails } from "@/lib/communityStrikes";

export const dynamic = "force-dynamic";

export default async function ComunidadPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const store = await cookies();
  const searchParams = await props.searchParams;
  const tagParam = searchParams?.tag;
  const initialTag = typeof tagParam === 'string' ? tagParam.replace(/^#/, "") : undefined;
  const activeRoleCookie = store.get("cfh_active_role")?.value;
  const auth = await getAuthenticatedUser();
  const activeRole = activeRoleCookie || auth?.role;
  let canPromote = false;
  if (auth?.role === 'COACH' && auth?.id) {
    canPromote = await getCoachPromotionEligibility(auth.id);
  }

  const [initialPostsRes, sidebarData, suspensionDetails, savedPostIds] = await Promise.all([
    getCommunityPosts("GLOBAL", undefined, undefined, undefined, 10, initialTag),
    getCommunitySidebarData(),
    auth?.id ? getSuspensionDetails(auth.id) : Promise.resolve(null),
    auth?.id ? getUserSavedPostIds() : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Luces de ambiente sutiles en el fondo para profundidad visual */}
      <div className="absolute -top-24 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/12 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-72 -right-24 w-[450px] h-[450px] bg-teal-500/10 dark:bg-teal-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[750px] -left-20 w-[400px] h-[400px] bg-blue-500/5 dark:bg-blue-500/8 rounded-full blur-3xl pointer-events-none -z-10" />

      <CommunityClient initialTag={initialTag} 
        currentUserId={auth?.id} 
        initialPosts={initialPostsRes.posts} 
        initialNextCursor={initialPostsRes.nextCursor ?? null} 
        sidebarData={sidebarData} 
        currentUserRole={activeRole}
        canPromote={canPromote}
        currentUserAvatar={auth?.avatarUrl || undefined}
        suspensionDetails={suspensionDetails || undefined}
        initialSavedPostIds={savedPostIds}
      />
    </div>
  );
}
