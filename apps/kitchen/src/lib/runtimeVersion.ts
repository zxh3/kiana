/**
 * The runtime version the console is currently building sandboxes with.
 *
 * Mirrors `RUNTIME_VERSION` in server/runtime.ts, which the client cannot
 * import (it would pull the whole boot script into the bundle). Snapshots
 * record the version they were taken on, so the UI can mark one as older than
 * what a fresh sandbox would get.
 */
export const RUNTIME_VERSION = 5;
