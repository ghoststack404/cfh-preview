"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const AuthModals = dynamic(() => import("@/components/AuthModals"), { ssr: false });
const RegionSelector = dynamic(() => import("@/components/RegionSelector"), { ssr: false });
const SessionExpiredToast = dynamic(() => import("@/components/SessionExpiredToast"), { ssr: false });
const CartDrawer = dynamic(() => import("@/components/CartDrawer"), { ssr: false });

export default function ClientGlobalModals() {
  return (
    <>
      <RegionSelector />
      <AuthModals />
      <CartDrawer />
      <Suspense fallback={null}>
        <SessionExpiredToast />
      </Suspense>
    </>
  );
}
