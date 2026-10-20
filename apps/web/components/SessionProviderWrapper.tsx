'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

interface NextAuthSessionProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

export default function NextAuthSessionProvider({ children, session }: NextAuthSessionProviderProps) {
  return <SessionProvider basePath="/api/auth" session={session}>{children}</SessionProvider>;
}
