"use client";

// Login trampoline: redirects unauthenticated users to Keycloak's hosted
// login page, and sends already-authenticated users back to /.
// The body text is deliberately stable so E2E tests can anchor on it before
// the browser leaves for Keycloak.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "react-oidc-context";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  // One-shot guard: react-oidc-context re-creates `auth` on every internal
  // state change, so depending on `auth` in useEffect fires repeatedly.
  // Guard with a ref so we only initiate the redirect once.
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    if (auth.isLoading) return;

    if (auth.isAuthenticated) {
      triggered.current = true;
      router.replace("/");
      return;
    }

    triggered.current = true;
    void auth.signinRedirect();
  }, [auth.isLoading, auth.isAuthenticated, auth, router]);

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-80px)]">
      <p className="text-gray-600">ログインページへリダイレクト中...</p>
    </div>
  );
}
