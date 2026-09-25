import { useCallback } from "react";

import { authClient } from "../../lib/auth-client";
import { podAccount } from "./account";

/**
 * The viewer's Google account, by Better Auth's session, which every
 * caller shares. Signing in goes to Google and comes back to `returnTo`,
 * this same page unless given; signing out stays on it.
 */
export function useAccount() {
  const session = authClient.useSession();
  const signIn = useCallback(
    (returnTo = window.location.href) =>
      authClient.signIn.social({ provider: "google", callbackURL: returnTo }),
    [],
  );
  const signOut = useCallback(() => authClient.signOut(), []);
  return { ...podAccount(session), signIn, signOut };
}
