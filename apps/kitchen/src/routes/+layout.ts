import { redirect } from "@sveltejs/kit";
import { ApiError, api } from "$lib/api";
import { loadCredentials } from "$lib/creds";
import type { ConnectionInfo } from "$lib/types";
import type { LayoutLoad } from "./$types";

// No server-side accounts or database: credentials live in localStorage, so
// every page is client-rendered and loads run in the browser only.
export const ssr = false;

export const load: LayoutLoad = async ({ url, fetch }) => {
  // Settings has to stay reachable even when the credentials are wrong — it is
  // where they get fixed — so failures there resolve to "no connection"
  // instead of redirecting.
  const isSettings = url.pathname.startsWith("/connect");
  const stored = loadCredentials();
  if (stored) {
    return {
      connection: {
        workspace: stored.workspace,
        environment: stored.environment ?? null,
        source: "browser",
      } as ConnectionInfo,
    };
  }
  // No browser credentials — the server itself may hold them (env vars).
  try {
    const connection = await api<ConnectionInfo>("/api/connection", {}, fetch);
    return { connection };
  } catch (e) {
    if (isSettings) return { connection: null as ConnectionInfo | null };
    if (e instanceof ApiError && e.status === 401) redirect(307, "/connect");
    throw e;
  }
};
