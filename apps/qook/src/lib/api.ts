import { credentialHeaders } from "$lib/creds";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Call a qook API endpoint with the browser's Modal credentials attached. */
export async function api<T>(
  path: string,
  init: RequestInit = {},
  fetchFn: typeof fetch = fetch,
): Promise<T> {
  const res = await fetchFn(path, {
    ...init,
    headers: { ...credentialHeaders(), ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? `Request failed (${res.status}).`,
    );
  }
  return body as T;
}
