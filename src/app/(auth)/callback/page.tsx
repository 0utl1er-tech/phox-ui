"use client";

// OIDC Authorization Code redirect target. react-oidc-context's AuthProvider
// detects the `?code=...&state=...` query string automatically and runs the
// token exchange, so this page just waits and bounces to `/` when done.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "react-oidc-context";

export default function CallbackPage() {
  const auth = useAuth();
  const router = useRouter();
  // One-shot guard — see /login/page.tsx for context.
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    if (auth.isLoading) return;
    if (auth.isAuthenticated) {
      triggered.current = true;
      router.replace("/");
    } else if (auth.error) {
      triggered.current = true;
      router.replace("/login");
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.error, auth, router]);

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-80px)]">
      <p className="text-gray-600">認証中...</p>
    </div>
  );
}
