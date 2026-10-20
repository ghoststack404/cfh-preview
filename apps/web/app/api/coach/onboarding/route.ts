import { NextResponse } from "next/server";
import { completeCoachOnboarding, getCoachOnboardingStatus, updateCoachProfile } from "@/app/actions/onboarding";

export async function GET() {
  const status = await getCoachOnboardingStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isUpdate = Boolean(body.isUpdate);
    const result = isUpdate
      ? await updateCoachProfile(body)
      : await completeCoachOnboarding(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, profileId: result.profileId, slug: result.slug });
  } catch (error: any) {
    console.error("API error in /api/coach/onboarding:", error);
    return NextResponse.json({ error: error?.message || "Error interno del servidor" }, { status: 500 });
  }
}
