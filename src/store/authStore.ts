import { create } from "zustand";

// Application-side user shape. Populated from an OIDC (Keycloak) access token
// via the OidcToStoreBridge in AuthProvider.tsx. Kept intentionally small:
// only the fields the rest of the app actually needs.
export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
  accessToken: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: AuthUser | null, loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // initially loading until the OIDC provider finishes hydrating
  setUser: (user, loading) => set({ user, isAuthenticated: !!user, isLoading: loading }),
}));
