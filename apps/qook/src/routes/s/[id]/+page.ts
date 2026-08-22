import { redirect } from "@sveltejs/kit";
import { ApiError, api } from "$lib/api";
import type { SessionInfo } from "$lib/types";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:session");
  try {
    const session = await api<SessionInfo>(
      `/api/sandboxes/${params.id}`,
      {},
      fetch,
    );
    return { session, id: params.id };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(307, "/connect");
    if (e instanceof ApiError && e.status === 404) {
      return { session: null, id: params.id };
    }
    throw e;
  }
};
