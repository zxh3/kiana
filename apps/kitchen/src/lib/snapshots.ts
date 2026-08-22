/**
 * Turning a raw snapshot list into what a person should see.
 *
 * Deletions are filtered server-side now (a deleted snapshot's tag is pointed
 * at a marker image), so this is purely about presentation — and about the two
 * views agreeing: a count that disagrees with the list it opens is worse than
 * no count.
 */

/**
 * Keeping a snapshot republishes the same state, leaving its expiring twin
 * behind. Collapse that twin so one captured state is one entry — but never
 * two *named* keeps at the same state, which are two deliberate bookmarks.
 */
export function collapseTwins<T extends { createdAt: string; kind: string }>(
  snapshots: T[],
): T[] {
  const kept = new Set(
    snapshots.filter((s) => s.kind === "keep").map((s) => s.createdAt),
  );
  return snapshots.filter((s) => s.kind === "keep" || !kept.has(s.createdAt));
}

/**
 * What to show for a sandbox: collapse kept twins, newest first. Deletions are
 * already gone — the server filters snapshots whose tag points at the deletion
 * marker — so this is the one pipeline behind both the drawer's list and the
 * table's count.
 */
export function visibleSnapshots<
  T extends { tag: string; createdAt: string; kind: string },
>(snapshots: T[]): T[] {
  return collapseTwins(snapshots).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
