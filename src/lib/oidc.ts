// OIDC (Keycloak) configuration for react-oidc-context.
//
// Authorization Code + PKCE is used. The browser exchanges the code at the
// Keycloak token endpoint and keeps the access token in memory; oidc-client-ts
// handles silent renewal via a hidden iframe against `webOrigins` on the
// phox-ui client in Keycloak.

import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";

const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "";
const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "";
const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "";

export const oidcConfig: AuthProviderProps = {
  authority: `${keycloakUrl}/realms/${realm}`,
  client_id: clientId,
  // These are computed at runtime because Next.js may statically evaluate
  // `window` at build time otherwise.
  redirect_uri: typeof window !== "undefined" ? `${window.location.origin}/callback` : "",
  // NOTE: must NOT be `${origin}/` — the root page is a server component that
  // 307-redirects to /book, which strips the signout callback query params
  // before react-oidc-context can observe them. Use a dedicated static route.
  post_logout_redirect_uri:
    typeof window !== "undefined" ? `${window.location.origin}/logged-out` : "",
  response_type: "code",
  scope: "openid profile email",
  automaticSilentRenew: true,
  loadUserInfo: false,
  userStore:
    typeof window !== "undefined"
      ? new WebStorageStateStore({ store: window.localStorage })
      : undefined,
  // Remove the `?code=...&state=...` fragment from the URL bar after a
  // successful signin callback — otherwise users see it until the next
  // navigation.
  onSigninCallback: () => {
    if (typeof window !== "undefined") {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  },
};
