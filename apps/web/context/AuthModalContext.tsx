'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type RegisterRole = 'STUDENT' | 'COACH' | 'APPRENTICE';

type AuthModalContextType = {
  isLoginOpen: boolean;
  isRegisterOpen: boolean;
  initialRegisterRole: 'STUDENT' | 'COACH' | null;
  openLogin: () => void;
  closeLogin: () => void;
  openRegister: () => void;
  openRegisterWithRole: (role: RegisterRole) => void;
  closeRegister: () => void;
  switchToLogin: () => void;
  switchToRegister: (role?: RegisterRole) => void;
};

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [initialRegisterRole, setInitialRegisterRole] = useState<'STUDENT' | 'COACH' | null>(null);
  
  const { data: session } = useSession();
  const router = useRouter();

  const normalizeRole = (role?: RegisterRole): 'STUDENT' | 'COACH' | null => {
    if (!role) return null;
    return role === 'COACH' ? 'COACH' : 'STUDENT';
  };

  const openLogin = React.useCallback(() => {
    setIsRegisterOpen(false);
    setIsLoginOpen(true);
  }, []);
  const closeLogin = React.useCallback(() => setIsLoginOpen(false), []);
  
  const openRegister = React.useCallback(() => {
    if (session?.user) {
      const userRole = (session.user as any)?.role;
      router.push(userRole === 'COACH' ? '/coach/dashboard' : '/dashboard');
      return;
    }
    setIsLoginOpen(false);
    setInitialRegisterRole(null);
    setIsRegisterOpen(true);
  }, [session, router]);

  const openRegisterWithRole = React.useCallback((role: RegisterRole) => {
    if (session?.user) {
      const userRole = (session.user as any)?.role;
      if (role === 'COACH') {
        router.push(userRole === 'COACH' ? '/coach/dashboard' : '/coach/onboarding');
      } else {
        router.push('/dashboard');
      }
      return;
    }
    setIsLoginOpen(false);
    setInitialRegisterRole(normalizeRole(role));
    setIsRegisterOpen(true);
  }, [session, router]);

  const closeRegister = React.useCallback(() => {
    setIsRegisterOpen(false);
    setInitialRegisterRole(null);
  }, []);

  const switchToLogin = React.useCallback(() => {
    setIsRegisterOpen(false);
    setIsLoginOpen(true);
  }, []);

  const switchToRegister = React.useCallback((role?: RegisterRole) => {
    setIsLoginOpen(false);
    if (role) {
      setInitialRegisterRole(normalizeRole(role));
    }
    setIsRegisterOpen(true);
  }, []);

  return (
    <AuthModalContext.Provider
      value={{
        isLoginOpen,
        isRegisterOpen,
        initialRegisterRole,
        openLogin,
        closeLogin,
        openRegister,
        openRegisterWithRole,
        closeRegister,
        switchToLogin,
        switchToRegister,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}
