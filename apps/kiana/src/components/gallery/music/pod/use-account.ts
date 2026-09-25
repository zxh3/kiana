import { authClient } from "../../../../lib/auth-client";
import { podAccount } from "./account";

/**
 * The viewer's Google account, by Better Auth's session. Signing in goes
 * to Google and comes back to this same page; signing out stays on it.
 */
export function useAccount() {
  const session = authClient.useSession();
  return {
    ...podAccount(session),
    signIn: () =>
      authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.href,
      }),
    signOut: () => authClient.signOut(),
  };
}

export type PodAccountControls = ReturnType<typeof useAccount>;
