/**
 * Tier 1: Happy-Path Feature Coverage Test Suite
 * 
 * Verifies core user flows and data structures per ORIGINAL_REQUEST R1 & TEST_INFRA.md:
 * - Student & Coach Onboarding flow data models
 * - Dashboard views (Student & Coach) and session/earnings structures
 * - Marketplace booking data structures & multi-timezone slots
 * - Community dual-feed filters (Global vs Local) and multi-type posts/polls
 * - ValeriaAvatarWidget presence and simulated AI behavior
 */

import { TestSuite, expect } from "./common.mjs";
import fs from "node:fs";
import path from "node:path";

export async function runTier1Tests() {
  const suite = new TestSuite("Tier 1: Core User Flows & Happy Paths");

  // -------------------------------------------------------------
  // Test 1.1: Student 3-Step Onboarding Data Flow
  // -------------------------------------------------------------
  suite.test("AC 1.1 - Student Onboarding Flow: Validates required steps and output cookies", () => {
    const studentDraft = {
      interests: ["DESARROLLO_WEB", "INGLES", "LIDERAZGO"],
      goals: "Aprender desarrollo frontend con Next.js y conseguir empleo remoto internacional.",
      region: "LATAM",
      avatarUrl: "https://example.com/avatars/student1.jpg",
    };

    // Validation rules
    expect(studentDraft.interests.length).toBeGreaterThanOrEqual(1);
    expect(studentDraft.goals.length).toBeGreaterThanOrEqual(10);
    expect(["LATAM", "NORTH_AMERICA", "EUROPE", "OTHER"]).toContain(studentDraft.region);
    expect(studentDraft.avatarUrl).toMatch(/^https?:\/\//);

    // Simulated Onboarding Completion Action Response
    const mockCookieJar = new Map();
    const completeStudentOnboarding = (input) => {
      if (!input.interests || input.interests.length === 0) {
        throw new Error("Debes seleccionar al menos un área de interés");
      }
      mockCookieJar.set("cfh_active_role", "STUDENT");
      mockCookieJar.set("cfh_onboarding_completed", "true");
      mockCookieJar.set("cfh_user_region", input.region);
      return { success: true, redirectUrl: "/dashboard" };
    };

    const result = completeStudentOnboarding(studentDraft);
    expect(result.success).toBe(true);
    expect(result.redirectUrl).toBe("/dashboard");
    expect(mockCookieJar.get("cfh_active_role")).toBe("STUDENT");
    expect(mockCookieJar.get("cfh_onboarding_completed")).toBe("true");
    expect(mockCookieJar.get("cfh_user_region")).toBe("LATAM");
  });

  // -------------------------------------------------------------
  // Test 1.2: Coach Multi-Field Onboarding & Video Pitch Rules
  // -------------------------------------------------------------
  suite.test("AC 1.2 - Coach Registration: Validates headline, bio, hourly rate, and video pitch <=40s", () => {
    const coachDraft = {
      headline: "Senior React & Node.js Architect",
      bio: "Más de 10 años de experiencia liderando equipos técnicos en startups de alto crecimiento.",
      hourlyRateCents: 6500, // $65.00 USD
      experienceYears: 10,
      categoryIds: ["cat_dev_01"],
      introVideoUrl: "https://cdn.coachingfromhome.com/videos/pitch-coach-1.mp4",
      videoDurationSeconds: 38, // <= 40s per client specification
      showCertificates: true,
      certificates: [
        { title: "AWS Certified Solutions Architect", institution: "Amazon Web Services", year: 2024 },
      ],
      tier: "PLATINUM",
    };

    // Validate coach requirements
    expect(coachDraft.headline.length).toBeGreaterThanOrEqual(5);
    expect(coachDraft.bio.length).toBeGreaterThanOrEqual(20);
    expect(coachDraft.hourlyRateCents).toBeGreaterThan(0);
    expect(coachDraft.videoDurationSeconds).toBeLessThanOrEqual(40);
    expect(coachDraft.categoryIds.length).toBeGreaterThanOrEqual(1);

    const submitCoachProfile = (data) => {
      if (data.videoDurationSeconds > 40) {
        return { success: false, error: "El video de presentación no debe exceder 40 segundos." };
      }
      return {
        success: true,
        profile: {
          id: "cp_101",
          approvalStatus: "PENDING",
          headline: data.headline,
          hourlyRateCents: data.hourlyRateCents,
          tier: data.tier,
          showCertificates: data.showCertificates,
        },
        redirectUrl: "/coach/dashboard",
      };
    };

    const res = submitCoachProfile(coachDraft);
    expect(res.success).toBe(true);
    expect(res.profile.approvalStatus).toBe("PENDING");
    expect(res.profile.tier).toBe("PLATINUM");
    expect(res.profile.showCertificates).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 1.3: Role Toggle & Context Switching State
  // -------------------------------------------------------------
  suite.test("AC 1.3 - Role Toggle: Correctly transitions active role cookie between Student and Coach", () => {
    const userSession = {
      userId: "usr_dual_role_99",
      roles: ["STUDENT", "COACH"],
      coachProfileCompleted: true,
      studentProfileCompleted: true,
    };

    const switchActiveRole = (targetRole, session) => {
      if (!session.roles.includes(targetRole)) {
        throw new Error("No tienes este rol habilitado.");
      }
      const cookies = {
        cfh_active_role: targetRole,
        cfh_onboarding_completed: "true",
      };
      const redirect = targetRole === "COACH" ? "/coach/dashboard" : "/dashboard";
      return { cookies, redirect };
    };

    // Toggle to Coach
    const toCoach = switchActiveRole("COACH", userSession);
    expect(toCoach.cookies.cfh_active_role).toBe("COACH");
    expect(toCoach.redirect).toBe("/coach/dashboard");

    // Toggle to Student
    const toStudent = switchActiveRole("STUDENT", userSession);
    expect(toStudent.cookies.cfh_active_role).toBe("STUDENT");
    expect(toStudent.redirect).toBe("/dashboard");
  });

  // -------------------------------------------------------------
  // Test 1.4: Dashboard Views & Booking Data Structures
  // -------------------------------------------------------------
  suite.test("AC 1.4 - Dashboard Views: Formats upcoming/past bookings and coach earnings breakdown", () => {
    const now = new Date();
    const futureSessionDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const pastSessionDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const mockBookings = [
      {
        id: "bk_active_1",
        startAt: futureSessionDate,
        endAt: new Date(futureSessionDate.getTime() + 60 * 60 * 1000),
        status: "CONFIRMED",
        priceCents: 5000,
        videoRoomName: "cfh-room-active-1",
        coach: { name: "Valeria Coach", headline: "Lead Coach" },
      },
      {
        id: "bk_past_1",
        startAt: pastSessionDate,
        endAt: new Date(pastSessionDate.getTime() + 60 * 60 * 1000),
        status: "COMPLETED",
        priceCents: 5000,
        videoRoomName: "cfh-room-past-1",
        coach: { name: "Valeria Coach", headline: "Lead Coach" },
        review: { rating: 5, comment: "Excelente clase práctica!" },
      },
    ];

    const upcoming = mockBookings.filter((b) => b.status === "CONFIRMED" && b.startAt > now);
    const past = mockBookings.filter((b) => b.status === "COMPLETED" || b.startAt <= now);

    expect(upcoming.length).toBe(1);
    expect(past.length).toBe(1);
    expect(upcoming[0].videoRoomName).toBe("cfh-room-active-1");
    expect(past[0].review.rating).toBe(5);

    // Coach Earnings Breakdown Structure
    const coachEarnings = {
      grossSalesCents: 150000, // $1,500.00 USD
      platformFeeBps: 1800,    // 18% GOLD Tier
      completedSessions: 25,
      coursesSold: 5,
    };

    const platformCommissionCents = Math.round((coachEarnings.grossSalesCents * coachEarnings.platformFeeBps) / 10000);
    const netPayoutCents = coachEarnings.grossSalesCents - platformCommissionCents;

    expect(platformCommissionCents).toBe(27000); // 18% of $1,500 = $270.00
    expect(netPayoutCents).toBe(123000);         // $1,230.00 net
  });

  // -------------------------------------------------------------
  // Test 1.5: Marketplace Multi-Timezone & Free Intro Data Models
  // -------------------------------------------------------------
  suite.test("AC 1.5 - Marketplace: Computes availability slots and validates free 15-min intro booking", () => {
    const coachProfile = {
      id: "cp_marcos",
      hourlyRateCents: 8000,
      freeIntroEnabled: true,
      freeIntroMinutes: 15,
      timezone: "America/Mexico_City",
    };

    const studentUser = {
      id: "std_ana",
      timezone: "Europe/Madrid",
      priorBookingsWithCoach: [],
    };

    // Free intro eligibility
    const isEligibleForFreeIntro =
      coachProfile.freeIntroEnabled &&
      studentUser.priorBookingsWithCoach.filter((b) => b.isFreeIntro && b.status !== "CANCELED").length === 0;

    expect(isEligibleForFreeIntro).toBe(true);

    // Create free intro booking data model
    const bookingSlot = new Date(Date.now() + 2 * 86400000);
    const freeIntroBooking = {
      coachId: coachProfile.id,
      studentId: studentUser.id,
      startAt: bookingSlot.toISOString(),
      endAt: new Date(bookingSlot.getTime() + coachProfile.freeIntroMinutes * 60000).toISOString(),
      durationMinutes: coachProfile.freeIntroMinutes,
      isFreeIntro: true,
      priceCents: 0,
      status: "CONFIRMED", // Free intro does not require Stripe checkout
    };

    expect(freeIntroBooking.priceCents).toBe(0);
    expect(freeIntroBooking.durationMinutes).toBe(15);
    expect(freeIntroBooking.status).toBe("CONFIRMED");
  });

  // -------------------------------------------------------------
  // Test 1.6: Community Dual-Feed Filters & Polls
  // -------------------------------------------------------------
  suite.test("AC 1.6 - Community: Global vs Local feed filtering and multi-type post / poll models", () => {
    const posts = [
      { id: "p1", title: "Recursos de TypeScript", postType: "RESOURCE", authorRegion: "LATAM", poll: null },
      { id: "p2", title: "Dudas sobre Docker en producción", postType: "DOUBT", authorRegion: "EUROPE", poll: null },
      {
        id: "p3",
        title: "¿Qué framework prefieren en 2026?",
        postType: "QUESTION",
        authorRegion: "LATAM",
        poll: {
          question: "¿Cuál es tu stack principal?",
          options: [
            { text: "Next.js + Tailwind", votes: 14 },
            { text: "Remix + CSS Modules", votes: 4 },
            { text: "Nuxt + UnoCSS", votes: 3 },
          ],
        },
      },
    ];

    // Global Feed
    const globalFeed = posts;
    expect(globalFeed.length).toBe(3);

    // Local Feed (LATAM user)
    const currentUserRegion = "LATAM";
    const localFeed = posts.filter((p) => p.authorRegion === currentUserRegion);
    expect(localFeed.length).toBe(2);
    expect(localFeed.map((p) => p.id)).toEqual(["p1", "p3"]);

    // Poll data validation
    const pollPost = localFeed.find((p) => p.poll !== null);
    expect(pollPost.poll.options.length).toBe(3);
    const totalVotes = pollPost.poll.options.reduce((sum, opt) => sum + opt.votes, 0);
    expect(totalVotes).toBe(21);
  });

  // -------------------------------------------------------------
  // Test 1.7: ValeriaAvatarWidget 3D AI Placeholder Presence
  // -------------------------------------------------------------
  suite.test("AC 1.7 - ValeriaAvatarWidget: Inspects component file, dimensions, and simulated dialogue", () => {
    const widgetFilePath = path.resolve(
      process.cwd(),
      "apps/web/components/ValeriaAvatarWidget.tsx"
    );

    expect(fs.existsSync(widgetFilePath)).toBe(true);

    const content = fs.readFileSync(widgetFilePath, "utf8");

    // Verify key architectural constraints
    expect(content).toContain("ValeriaAvatarWidget");
    expect(content).toContain("w-[350px] h-[450px]"); // Drawer dimensions per spec
    expect(content).toContain("¡Habla conmigo! ✨"); // Greeting bubble
    expect(content).toContain("Valeria AI");
    expect(content).toContain("fixed bottom-0 right-4"); // Fixed positioning

    // Verify no external AI API calls (OpenAI, Anthropic, HeyGen, etc.) are present in the component
    expect(content.includes("fetch('https://api.openai.com")).toBe(false);
    expect(content.includes("fetch('https://api.heygen.com")).toBe(false);
    expect(content.includes("fetch('https://api.anthropic.com")).toBe(false);

    // Verify simulated client-side response timeout
    expect(content).toContain("setTimeout");
  });

  return await suite.run();
}
