import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { AUTH_PATH } from "./auth";
import { accessControl, roles } from "./permissions";

/**
 * Better Auth in the browser: the session, and signing in and out, with
 * the admin plugin's calls for the admin page.
 */
export const authClient = createAuthClient({
  basePath: AUTH_PATH,
  plugins: [adminClient({ ac: accessControl, roles })],
});
