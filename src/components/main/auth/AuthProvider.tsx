"use client";

import { useEffect } from "react";
import { AuthProvider as OidcAuthProvider, useAuth } from "react-oidc-context";
import { oidcConfig } from "@/lib/oidc";
import { useAuthStore, type AuthUser } from "@/store/authStore";

// Bridges react-oidc-context state into the Zustand store so the rest of the
// app can keep reading `useAuthStore((s) => s.user)` as before.
//
// Stability note: oidc-client-ts may replace the `auth.user` reference on
// silent token renewal even when nothing the app cares about has actually
// changed. This bridge intentionally compares the incoming user against the
// current store value and only writes when something meaningful changed,
// so downstream `useEffect` hooks keyed on `user` don't refetch gratuitously.
function OidcToStoreBridge({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    const store = useAuthStore.getState();

    if (auth.isLoading) {
      if (!store.isLoading || store.user !== null) {
        store.setUser(null, true);
      }
      return;
    }

    if (auth.isAuthenticated && auth.user) {
      const profile = auth.user.profile;
      const next: AuthUser = {
        sub: profile.sub ?? "",
        email: typeof profile.email === "string" ? profile.email : undefined,
        name: typeof profile.name === "string" ? profile.name : undefined,
        accessToken: auth.user.access_token,
      };

      if (!isSameAuthUser(store.user, next) || store.isLoading) {
        store.setUser(next, false);
      }
      return;
    }

    if (store.user !== null || store.isLoading) {
      store.setUser(null, false);
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user]);

  return <>{children}</>;
}

function isSameAuthUser(a: AuthUser | null, b: AuthUser): boolean {
  if (a === null) return false;
  return (
    a.sub === b.sub &&
    a.email === b.email &&
    a.name === b.name &&
    a.accessToken === b.accessToken
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <OidcAuthProvider {...oidcConfig}>
      <OidcToStoreBridge>{children}</OidcToStoreBridge>
    </OidcAuthProvider>
  );
}
