"use client";

// Post-logout landing page.
//
// This is set as `post_logout_redirect_uri` in oidcConfig. Keycloak's
// end-session endpoint redirects here after destroying its session. We
// intentionally use a dedicated route instead of `/` because `/` is a server
// component that 307-redirects to `/book`, which would strip the signout
// callback query params before react-oidc-context can observe them.
//
// We also explicitly call `removeUser()` as a belt-and-suspenders clearing in
// case the in-memory oidc-client-ts user survived the Keycloak round-trip.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "react-oidc-context";

export default function LoggedOutPage() {
  const auth = useAuth();
  const [cleared, setCleared] = useState(false);
  // One-shot guard — see /login/page.tsx for context.
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    if (auth.isLoading) return;
    triggered.current = true;
    void (async () => {
      try {
        await auth.removeUser();
      } finally {
        setCleared(true);
      }
    })();
  }, [auth.isLoading, auth]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] gap-4">
      <p className="text-gray-700 text-lg">ログアウトしました</p>
      {cleared && (
        <Link href="/login" className="text-blue-600 hover:underline">
          再度ログインする
        </Link>
      )}
    </div>
  );
}
