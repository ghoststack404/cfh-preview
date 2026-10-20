// tests/e2e/harness/mock-env.mjs
// Domain models, contract simulations, and fixture helpers for E2E testing

import { EventEmitter } from 'node:events';

/**
 * In-memory Mock Database Store simulating Prisma schema
 */
export class MockDatabase {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = new Map([
      ['student-1', { id: 'student-1', email: 'student@example.com', name: 'Ana Estudiante', role: 'STUDENT', onboardingCompleted: true }],
      ['student-new', { id: 'student-new', email: 'newbie@example.com', name: 'Carlos Nuevo', role: 'STUDENT', onboardingCompleted: false }],
      ['coach-1', { id: 'coach-1', email: 'coach@example.com', name: 'Mónica Coach', role: 'COACH', onboardingCompleted: true, hourlyRate: 50, freeIntroEnabled: true, freeIntroMinutes: 15 }],
      ['coach-nofree', { id: 'coach-nofree', email: 'strict@example.com', name: 'Profesor Riguroso', role: 'COACH', onboardingCompleted: true, hourlyRate: 80, freeIntroEnabled: false, freeIntroMinutes: 0 }],
      ['admin-1', { id: 'admin-1', email: 'admin@example.com', name: 'Admin Root', role: 'ADMIN', onboardingCompleted: true }],
    ]);

    this.courses = new Map([
      ['course-101', {
        id: 'course-101',
        slug: 'intro-coaching-emocional',
        title: 'Introducción al Coaching Emocional',
        price: 49.99,
        priceCents: 4999,
        coachId: 'coach-1',
        coachName: 'Mónica Coach',
        introVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        modules: [
          {
            id: 'mod-1',
            title: 'Módulo 1: Fundamentos',
            lessons: [
              { id: 'les-1', title: 'Bienvenida al curso', durationMinutes: 10, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
              { id: 'les-2', title: 'Autoconocimiento práctico', durationMinutes: 20, videoUrl: 'https://vimeo.com/76979871' },
            ]
          },
          {
            id: 'mod-2',
            title: 'Módulo 2: Herramientas de Gestión',
            lessons: [
              { id: 'les-3', title: 'Manejo del estrés', durationMinutes: 15, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
            ]
          }
        ]
      }],
      ['course-special-chars', {
        id: 'course-special-chars',
        slug: 'curso-gestion-estres-guia-rapida',
        title: 'Curso de Gestión del Estrés & Ansiedad: ¡Guía Práctica 100%!',
        price: 29.00,
        priceCents: 2900,
        coachId: 'coach-1',
        coachName: 'Mónica Coach',
        introVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        modules: [
          {
            id: 'mod-s1',
            title: 'Módulo Único',
            lessons: [
              { id: 'les-s1', title: 'Técnica 1: Respiración guiada', durationMinutes: 12, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
            ]
          }
        ]
      }]
    ]);

    this.enrollments = new Map(); // key: `${userId}:${courseId}` -> { id, studentId, courseId, progress: Map<lessonId, completedAt> }
    this.bookings = []; // { id, studentId, coachId, type, durationMinutes, price, status, scheduledAt }
    this.communityPosts = new Map([
      ['post-1', { id: 'post-1', authorId: 'student-1', authorName: 'Ana Estudiante', title: '¿Cómo mantener el hábito?', content: 'Llevo 2 semanas practicando meditación y me ha servido mucho.', type: 'DISCUSSION', likesCount: 4, commentsCount: 2, createdAt: new Date() }],
      ['post-2', { id: 'post-2', authorId: 'coach-1', authorName: 'Mónica Coach', title: 'Consejo para afrontar la semana', content: 'Recuerden priorizar descansos activos durante el día.', type: 'ANNOUNCEMENT', likesCount: 15, commentsCount: 5, createdAt: new Date() }]
    ]);
    this.postLikes = new Set(); // `${userId}:${postId}`
    this.postComments = []; // { id, postId, userId, content, createdAt }
    this.savedPosts = new Set(); // `${userId}:${postId}`
    this.conversations = new Map(); // id -> { id, studentId, coachId, lastMessageAt }
    this.messages = []; // { id, conversationId, senderId, senderRole, content, createdAt }
  }

  // Enrollment helpers
  createEnrollment(studentId, courseId) {
    const key = `${studentId}:${courseId}`;
    const enrollment = {
      id: `enr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      studentId,
      courseId,
      progress: new Map(),
      createdAt: new Date()
    };
    this.enrollments.set(key, enrollment);
    return enrollment;
  }

  getEnrollment(studentId, courseId) {
    return this.enrollments.get(`${studentId}:${courseId}`) || null;
  }

  setLessonProgress(studentId, courseId, lessonId, completed) {
    const enrollment = this.getEnrollment(studentId, courseId);
    if (!enrollment) {
      throw new Error('FORBIDDEN_NOT_ENROLLED');
    }
    if (completed) {
      enrollment.progress.set(lessonId, new Date());
    } else {
      enrollment.progress.delete(lessonId);
    }
    return { success: true, completed };
  }

  // Booking helpers
  checkFreeIntroEligibility(studentId, coachId) {
    const coach = this.users.get(coachId);
    if (!coach || !coach.freeIntroEnabled) {
      return { eligible: false, reason: 'FREE_INTRO_NOT_SUPPORTED' };
    }
    const priorBooking = this.bookings.find(
      (b) => b.studentId === studentId && b.coachId === coachId && b.type === 'FREE_INTRO'
    );
    if (priorBooking) {
      return { eligible: false, reason: 'ALREADY_BOOKED' };
    }
    return { eligible: true, durationMinutes: 15, price: 0 };
  }

  createBooking({ studentId, coachId, type, scheduledAt, priceManipulated }) {
    const coach = this.users.get(coachId);
    if (!coach) throw new Error('COACH_NOT_FOUND');

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now() - 60000) {
      throw new Error('INVALID_DATE_SLOT');
    }

    // Check collision on slot
    const collision = this.bookings.find(
      (b) => b.coachId === coachId && Math.abs(new Date(b.scheduledAt).getTime() - scheduledDate.getTime()) < 15 * 60000
    );
    if (collision) {
      throw new Error('SLOT_UNAVAILABLE');
    }

    if (type === 'FREE_INTRO') {
      const eligibility = this.checkFreeIntroEligibility(studentId, coachId);
      if (!eligibility.eligible) {
        throw new Error(eligibility.reason);
      }
      const booking = {
        id: `bk-${Date.now()}`,
        studentId,
        coachId,
        type: 'FREE_INTRO',
        durationMinutes: 15,
        price: 0, // Enforces $0.00 regardless of priceManipulated
        currency: 'USD',
        status: 'CONFIRMED',
        scheduledAt: scheduledDate.toISOString(),
        label: 'Gratuita'
      };
      this.bookings.push(booking);
      return booking;
    }

    const booking = {
      id: `bk-${Date.now()}`,
      studentId,
      coachId,
      type: 'PAID',
      durationMinutes: 60,
      price: coach.hourlyRate,
      currency: 'USD',
      status: 'CONFIRMED',
      scheduledAt: scheduledDate.toISOString(),
      label: 'Sesión Estándar'
    };
    this.bookings.push(booking);
    return booking;
  }

  // Saved Post helpers
  toggleSavePost(userId, postId) {
    if (!this.communityPosts.has(postId)) {
      throw new Error('POST_NOT_FOUND');
    }
    const key = `${userId}:${postId}`;
    if (this.savedPosts.has(key)) {
      this.savedPosts.delete(key);
      return { success: true, saved: false };
    } else {
      this.savedPosts.add(key);
      return { success: true, saved: true };
    }
  }

  getSavedPosts(userId) {
    const result = [];
    for (const key of this.savedPosts) {
      const [uId, pId] = key.split(':');
      if (uId === userId) {
        const post = this.communityPosts.get(pId);
        if (post) result.push(post);
      }
    }
    return result;
  }
}

/**
 * Middleware Guard Simulator adhering strictly to PROJECT.md § M1
 */
export class MiddlewareSimulator {
  static protectedRoutes = ['/sesion', '/dashboard', '/coach/', '/student', '/checkout'];

  static handle(req) {
    const { pathname, searchParams, cookies = {} } = req;
    const isAuthenticated = Boolean(cookies['cfh_session'] || cookies['next-auth.session-token']);
    const role = cookies['cfh_active_role'] || cookies['cfh_user_role'] || null;
    const isOnboardingCompleted = cookies['cfh_onboarding_completed'] === 'true';

    const isCoach = role === 'COACH';
    const isStudent = role === 'STUDENT' || role === 'APPRENTICE';

    // 1. Root redirect logic
    if (pathname === '/') {
      if (isAuthenticated) {
        if (isCoach && isOnboardingCompleted) {
          return { status: 307, redirect: '/coach/dashboard' };
        } else if (isCoach && !isOnboardingCompleted) {
          return { status: 307, redirect: '/coach/onboarding' };
        } else if (isStudent && isOnboardingCompleted) {
          return { status: 307, redirect: '/dashboard' };
        } else if (isStudent && !isOnboardingCompleted) {
          return { status: 307, redirect: '/student/onboarding' };
        }
      }
      return { status: 200, action: 'next' };
    }

    // 2. Unauthenticated Checkout Guard
    if (pathname === '/checkout' || pathname.startsWith('/checkout/')) {
      if (!isAuthenticated) {
        const queryString = searchParams ? searchParams.toString() : '';
        const callbackUrl = queryString ? `${pathname}?${queryString}` : pathname;
        const decoded = decodeURIComponent(callbackUrl);
        // Sanitize open redirects
        if (decoded.includes('://') || decoded.startsWith('//') || (searchParams && searchParams.get('callbackUrl')?.includes('://'))) {
          return { status: 307, redirect: '/?auth=login&callbackUrl=/checkout' };
        }
        return {
          status: 307,
          redirect: `/?auth=login&callbackUrl=${encodeURIComponent(callbackUrl)}`
        };
      }
      return { status: 200, action: 'next' };
    }

    // 3. Student Dashboard Guard
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
      if (!isAuthenticated) {
        return { status: 307, redirect: '/?auth=login' };
      }
      if (isStudent && !isOnboardingCompleted) {
        return { status: 307, redirect: '/student/onboarding' };
      }
      return { status: 200, action: 'next' };
    }

    // 4. Student Onboarding Guard
    if (pathname === '/student/onboarding' || pathname.startsWith('/student/onboarding/')) {
      if (!isAuthenticated) {
        return { status: 307, redirect: '/?auth=login' };
      }
      return { status: 200, action: 'next' };
    }

    // 5. Coach Portal Guard
    if (pathname === '/coach' || pathname.startsWith('/coach/')) {
      if (!isAuthenticated) {
        return { status: 307, redirect: '/?auth=login' };
      }
      if (isStudent) {
        return { status: 307, redirect: isOnboardingCompleted ? '/dashboard' : '/student/onboarding' };
      }
      if (isCoach && !isOnboardingCompleted && pathname !== '/coach/onboarding') {
        return { status: 307, redirect: '/coach/onboarding' };
      }
      return { status: 200, action: 'next' };
    }

    // 6. Generic Protected Routes Guard
    const isProtected = MiddlewareSimulator.protectedRoutes.some((route) => pathname.startsWith(route));
    if (isProtected && !isAuthenticated) {
      return { status: 307, redirect: '/?auth=login' };
    }

    // Public unauthenticated routes: /cursos, /comunidad, etc.
    return { status: 200, action: 'next' };
  }
}

/**
 * WebSocket / Pusher Real-Time Simulator for chat and presence
 */
export class RealtimeChannelHub extends EventEmitter {
  constructor() {
    super();
    this.presenceChannels = new Map(); // channelName -> Set<userObject>
    this.userSockets = new Map(); // socketId -> { userId, channelName }
  }

  joinPresence(channelName, user) {
    if (!user || !user.id) {
      throw new Error('PRESENCE_AUTH_REQUIRED');
    }
    if (!this.presenceChannels.has(channelName)) {
      this.presenceChannels.set(channelName, new Map());
    }
    const channelMap = this.presenceChannels.get(channelName);
    const wasAlreadyPresent = channelMap.has(user.id);
    channelMap.set(user.id, {
      id: user.id,
      name: user.name,
      role: user.role,
      joinedAt: Date.now()
    });

    if (!wasAlreadyPresent) {
      this.emit(`${channelName}:member_added`, channelMap.get(user.id));
    }
    return Array.from(channelMap.values());
  }

  leavePresence(channelName, userId) {
    const channelMap = this.presenceChannels.get(channelName);
    if (!channelMap || !channelMap.has(userId)) return;
    const removedUser = channelMap.get(userId);
    channelMap.delete(userId);
    this.emit(`${channelName}:member_removed`, removedUser);
  }

  getPresenceMembers(channelName) {
    const channelMap = this.presenceChannels.get(channelName);
    return channelMap ? Array.from(channelMap.values()) : [];
  }

  broadcastMessage(conversationId, message) {
    const channelName = `private-conversation-${conversationId}`;
    this.emit(`${channelName}:new-message`, message);
  }
}

/**
 * Chat safety scanner replicating apps/web/lib/chat.ts
 */
export function scanContactPolicy(content) {
  if (!content || typeof content !== 'string') return { allowed: false, error: 'EMPTY_CONTENT' };
  const emailPattern = /\b[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[A-Z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[A-Z]{2,}\b/i;
  const phonePattern = /(?:\+?\d[\s().-]*){7,}/;
  const urlPattern = /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|mx|net|org|io|me|co|app|dev)\b)/i;
  const socialPattern = /\b(?:whats?app|telegram|instagram|insta|facebook|fb|tiktok|snapchat|discord|linkedin)\b|(?:^|\s)@[a-z0-9._-]{3,}/i;

  const violations = [];
  if (emailPattern.test(content)) violations.push('EMAIL');
  if (phonePattern.test(content)) violations.push('PHONE');
  if (urlPattern.test(content)) violations.push('URL');
  if (socialPattern.test(content)) violations.push('SOCIAL');

  return {
    allowed: violations.length === 0,
    violations,
    flagged: violations.length > 0
  };
}

/**
 * Course Player embed URL parser replicating CourseDetailClient & Classroom
 */
export function getEmbedVideoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  }
  const vimeoMatch = url.match(/(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+))/i);
  if (vimeoMatch && (vimeoMatch[3] || vimeoMatch[2])) {
    const vimeoId = vimeoMatch[3] || vimeoMatch[2];
    return `https://player.vimeo.com/video/${vimeoId}`;
  }
  return null;
}
