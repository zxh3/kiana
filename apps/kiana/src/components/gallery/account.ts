import { cleanName } from "../../lib/chat";

/**
 * The viewer's Google account: whether they are signed in, and as whom,
 * for favorites and the player's live apps. Kept free of React so the
 * rules can be tested on their own; `use-account.ts` feeds it Better
 * Auth's session.
 */

export type AccountStatus =
  /** Asking the Worker for the session. */
  | "checking"
  /** Signing in is not set up, or the Worker could not say. */
  | "unavailable"
  | "guest"
  | "member";

/** Someone signed in: their account's id, and their name as shown. */
export type Member = { id: string; name: string };

export type PodAccount = { status: AccountStatus; member: Member | null };

/** What Better Auth's session says, as the pod's account. */
export function podAccount(session: {
  data: { user: { id: string; name: string } } | null | undefined;
  isPending: boolean;
  error: unknown;
}): PodAccount {
  const user = session.data?.user;
  if (user) {
    return {
      status: "member",
      member: { id: user.id, name: cleanName(user.name) },
    };
  }
  if (session.isPending) return { status: "checking", member: null };
  if (session.error) return { status: "unavailable", member: null };
  return { status: "guest", member: null };
}
