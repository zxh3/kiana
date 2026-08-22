/**
 * Restore points the user deleted.
 *
 * Modal has no unpublish: deleting a snapshot image leaves its tag listed, and
 * the tag even keeps resolving — only a sandbox create reveals the truth. So a
 * deletion is remembered here, and the drawer filters against it.
 *
 * Browser-local, like the sandbox rows. Another browser may still list a point
 * this one deleted; using it fails with a clear "no longer available" message,
 * which is the honest outcome rather than a silent one.
 */

const key = (workspace: string) => `kitchen-deleted-points:${workspace}`;

export function hiddenPoints(workspace: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(workspace)) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function hidePoint(workspace: string, tag: string): void {
  const tags = hiddenPoints(workspace);
  if (!tags.includes(tag)) {
    localStorage.setItem(key(workspace), JSON.stringify([...tags, tag]));
  }
}
