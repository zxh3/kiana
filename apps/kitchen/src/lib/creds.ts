/**
 * Modal credentials live only in this browser's localStorage — there is no
 * server-side account or database. Clearing them (or the browser's storage)
 * disconnects the workspace.
 */

export interface StoredCredentials {
  tokenId: string;
  tokenSecret: string;
  environment?: string;
  workspace: string;
}

const KEY = "kitchen-modal-credentials";

export function loadCredentials(): StoredCredentials | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.tokenId || !parsed?.tokenSecret) return null;
    return parsed as StoredCredentials;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: StoredCredentials): void {
  localStorage.setItem(KEY, JSON.stringify(creds));
}

export function clearCredentials(): void {
  localStorage.removeItem(KEY);
}

/** Headers for API calls; empty when the server holds credentials itself. */
export function credentialHeaders(): Record<string, string> {
  const creds = loadCredentials();
  if (!creds) return {};
  const headers: Record<string, string> = {
    "x-modal-token-id": creds.tokenId,
    "x-modal-token-secret": creds.tokenSecret,
  };
  if (creds.environment) headers["x-modal-environment"] = creds.environment;
  return headers;
}
