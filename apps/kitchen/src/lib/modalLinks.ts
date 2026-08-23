/**
 * Links back to Modal's own dashboard.
 *
 * The console shows a sandbox's state; Modal shows its logs, its container,
 * and the billing behind it. Linking out is cheaper than reproducing any of
 * that, and it tells the reader where the truth lives.
 */

const BASE = "https://modal.com/apps";
/** The Modal app sandboxes and the deployed console share (see APP_NAME). */
const APP = "kitchen";

/** Modal shows the workspace default environment under the name `main`. */
function env(environment: string | null | undefined): string {
  return environment && environment.length > 0 ? environment : "main";
}

export function workspaceUrl(
  workspace: string,
  environment: string | null | undefined,
): string {
  return `${BASE}/${workspace}/${env(environment)}`;
}

/**
 * A specific sandbox, in the app's sandbox tab. Deep-linking needs the app to
 * be deployed in that environment, which it is wherever this console runs from
 * Modal; a workspace that only ever created sandboxes through the SDK would
 * land on the app page instead.
 */
export function sandboxUrl(
  workspace: string,
  environment: string | null | undefined,
  sandboxId: string,
): string {
  const query = new URLSearchParams({
    activeTab: "sandboxes",
    live: "true",
    sandboxSection: "sandboxes",
    sandboxId,
  });
  return `${BASE}/${workspace}/${env(environment)}/deployed/${APP}?${query}`;
}
