import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import MessagesClient from "@/components/MessagesClient";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/?auth=login&redirect=/messages");
  }

  const store = await cookies();
  const activeRoleCookie = store.get("cfh_active_role")?.value;
  const effectiveRole = (activeRoleCookie === "COACH" || activeRoleCookie === "STUDENT")
    ? activeRoleCookie
    : user.role;

  return (
    <MessagesClient 
      currentUserId={user.id} 
      activeRole={effectiveRole || undefined}
    />
  );
}
