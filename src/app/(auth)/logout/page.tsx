"use client";

// Logout trampoline: calls Keycloak's end-session endpoint and lets it redirect
// back to the configured post_logout_redirect_uri (/logged-out).

import { useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";

export default function LogoutPage() {
  const auth = useAuth();
  // One-shot guard — see the same pattern in /login/page.tsx for context.
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    if (auth.isLoading) return;
    triggered.current = true;
    void auth.signoutRedirect();
  }, [auth.isLoading, auth]);

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-80px)]">
      <p className="text-gray-600">ログアウト中...</p>
    </div>
  );
}
