import { getPostById, getUserSavedPostIds } from "@/app/actions/community";
import { getAuthenticatedUser } from "@/app/actions/onboarding";
import { getSuspensionDetails } from "@/lib/communityStrikes";
import { notFound } from "next/navigation";
import PostDetailClient from "@/components/PostDetailClient";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getAuthenticatedUser();

  const [post, suspensionDetails, savedPostIds] = await Promise.all([
    getPostById(id),
    auth?.id ? getSuspensionDetails(auth.id) : Promise.resolve(null),
    auth?.id ? getUserSavedPostIds() : Promise.resolve([]),
  ]);

  if (!post) {
    notFound();
  }

  const isSaved = Boolean(post && savedPostIds.includes(post.id));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <PostDetailClient 
        post={post} 
        currentUserId={auth?.id} 
        suspensionDetails={suspensionDetails}
        initialIsSaved={isSaved}
      />
    </div>
  );
}
