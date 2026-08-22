import { redirect } from "@sveltejs/kit";
import { ApiError, api } from "$lib/api";
import { loadCredentials } from "$lib/creds";
import type { ConnectionInfo } from "$lib/types";
import type { LayoutLoad } from "./$types";

// No server-side accounts or database: credentials live in localStorage, so
// every page is client-rendered and loads run in the browser only.
export const ssr = false;

export const load: LayoutLoad = async ({ url, fetch }) => {
  if (url.pathname.startsWith("/connect")) {
    return { connection: null as ConnectionInfo | null };
  }
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
    if (e instanceof ApiError && e.status === 401) redirect(307, "/connect");
    throw e;
  }
};
