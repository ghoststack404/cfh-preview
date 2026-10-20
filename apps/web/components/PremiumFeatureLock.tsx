
"use client";

import { useEffect, useState } from "react";
import { Lock, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { getCurrentCoachSubscription } from "@/app/actions/subscriptions";

export default function PremiumFeatureLock({
  feature,
  title,
  description,
  children
}: {
  feature: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        const sub = await getCurrentCoachSubscription();
        if (!sub || !sub.plan) {
          // Si no tiene plan, ver si el plan Básico lo tiene (generalmente false)
          setHasAccess(false);
          return;
        }
        setHasAccess((sub.plan as Record<string, any>)[feature] === true);
      } catch (e) {
        setHasAccess(false);
      }
    }
    checkAccess();
  }, [feature]);

  if (hasAccess === null) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/90 z-0 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 border border-blue-500/30">
          <Lock className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">{title}</h2>
        <p className="text-slate-400 max-w-md mx-auto mb-8">
          {description}
        </p>
        <Link 
          href="/coach/plans"
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Mejorar Plan
        </Link>
      </div>
    </div>
  );
}

