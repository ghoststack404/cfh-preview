import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { defaultLocale, locales } from "@/i18n";

export const dynamic = "force-dynamic";

export default async function MessagesRootPage() {
  const store = await cookies();
  const rawLocale = store.get("NEXT_LOCALE")?.value?.toLowerCase() || store.get("cfh_language")?.value?.toLowerCase();
  const locale = rawLocale && locales.includes(rawLocale) ? rawLocale : defaultLocale;
  redirect(`/${locale}/messages`);
}
