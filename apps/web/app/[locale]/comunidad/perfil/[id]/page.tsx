import { getPublicUserProfile } from "@/app/actions/community";
import UserProfileClient from "@/components/UserProfileClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PublicUserProfilePage({ params }: Props) {
  const { id } = await params;

  const profileData = await getPublicUserProfile(id);

  if (!profileData) {
    notFound();
  }

  return (
    <UserProfileClient
      user={profileData.user as any}
      initialPosts={profileData.posts}
      isCurrentUser={profileData.isCurrentUser}
    />
  );
}
