import { env } from "cloudflare:workers";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";

import { AUTH_PATH } from "../lib/auth";
import type { Account } from "./account";
import { FAVORITES_TABLE } from "./favorites";

/**
 * Signing in with Google, by Better Auth. People and their sessions are
 * kept in the `AUTH_DB` D1 database, and a signed copy of the session is
 * cached in a cookie for five minutes, so the live apps can check who is
 * connecting without asking the database each time.
 *
 * Without its secrets (in development, before `.env` is filled in)
 * there is no signing in, and everyone is a guest.
 */
const options = {
  appName: "Kiana",
  basePath: AUTH_PATH,
  // The site itself, and the development server; Google sends people back
  // to whichever they signed in from, so both are registered with it.
  baseURL: {
    allowedHosts: ["kiana.me", "localhost:3000"],
    fallback: "https://kiana.me",
  },
  secret: env.BETTER_AUTH_SECRET,
  database: env.AUTH_DB,
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
      // Only the first name, since it is what the chat room shows.
      mapProfileToUser: (profile) => ({
        name: profile.given_name || profile.name,
      }),
    },
  },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  telemetry: { enabled: false },
} satisfies BetterAuthOptions;

const auth =
  env.BETTER_AUTH_SECRET && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? betterAuth(options)
    : null;

let schema: Promise<unknown> | null = null;

/**
 * Creates or updates the accounts database's tables, Better Auth's and the
 * favorites, once for each copy of the Worker, so a new database or a
 * newer Better Auth needs no step of its own. A failure is tried again
 * with the next request.
 */
function databaseReady() {
  schema ??= getMigrations(options)
    .then((migrations) => migrations.runMigrations())
    .then(() => env.AUTH_DB.prepare(FAVORITES_TABLE).run())
    .catch((error: unknown) => {
      schema = null;
      throw error;
    });
  return schema;
}

/** Answers Better Auth's own routes, under `AUTH_PATH`. */
export async function handleAuth(request: Request) {
  if (!auth) return new Response("Signing in is not set up", { status: 503 });
  await databaseReady();
  return auth.handler(request);
}

/**
 * The account a request's session cookie belongs to, or null for a guest.
 * A request without Better Auth's cookie is a guest without asking, and
 * so is anyone whose session cannot be checked, so the live apps keep
 * working if the database does not answer.
 */
export async function accountOf(request: Request): Promise<Account | null> {
  if (!auth) return null;
  if (!request.headers.get("Cookie")?.includes("better-auth.session_token")) {
    return null;
  }
  try {
    await databaseReady();
    const session = await auth.api.getSession({ headers: request.headers });
    return session ? { id: session.user.id, name: session.user.name } : null;
  } catch (error) {
    console.error("Could not check the session", error);
    return null;
  }
}
