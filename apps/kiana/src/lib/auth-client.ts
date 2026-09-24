import { createAuthClient } from "better-auth/react";

import { AUTH_PATH } from "./auth";

/** Better Auth in the browser: the session, and signing in and out. */
export const authClient = createAuthClient({ basePath: AUTH_PATH });
