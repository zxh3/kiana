/**
 * Client-side snapshot helpers.
 *
 * Two concerns that have to agree with each other: which snapshots a person
 * should see, and which ones this browser knows are gone. Modal has no
 * unpublish, so a deleted snapshot's tag keeps listing — the filtering has to
 * happen here, and it has to happen *before* twins are collapsed, or a count
 * and the list it opens can disagree.
 */

const key = (workspace: string) => `kitchen-deleted-snapshots:${workspace}`;

export function hiddenSnapshots(workspace: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(workspace)) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function hideSnapshot(workspace: string, tag: string): void {
  const tags = hiddenSnapshots(workspace);
  if (!tags.includes(tag)) {
    localStorage.setItem(key(workspace), JSON.stringify([...tags, tag]));
  }
}

/**
 * Forget hidden tags Modal has stopped listing. A hidden tag only earns its
 * keep while the tag still exists; once the snapshot has expired out of the
 * listing there is nothing left to filter. Scoped to one sandbox, since that
 * is all a listing proves anything about.
 */
export function pruneHiddenSnapshots(
  workspace: string,
  sandbox: string,
  listedTags: string[],
): void {
  const prefix = `kitchen-snap-${sandbox}:`;
  const kept = hiddenSnapshots(workspace).filter(
    (tag) => !tag.startsWith(prefix) || listedTags.includes(tag),
  );
  localStorage.setItem(key(workspace), JSON.stringify(kept));
}

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
 * What to show for a sandbox: drop what this browser deleted, then collapse
 * twins, then newest first. The single pipeline behind both the drawer's list
 * and the table's count — hiding *before* collapsing is what keeps them equal.
 */
export function visibleSnapshots<
  T extends { tag: string; createdAt: string; kind: string },
>(snapshots: T[], hidden: string[]): T[] {
  return collapseTwins(snapshots.filter((s) => !hidden.includes(s.tag))).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}
