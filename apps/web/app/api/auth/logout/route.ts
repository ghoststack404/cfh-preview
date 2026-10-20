import { destroySession } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { assertSameOrigin } from "@/lib/security";

export async function POST() {
  try {
    await assertSameOrigin();
    await destroySession();
    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
