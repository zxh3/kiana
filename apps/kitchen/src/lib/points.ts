/**
 * The one rule for turning a raw list of restore points into what a person
 * should see. Shared by the server listing and the table's point counts —
 * a count that disagrees with the list it opens is worse than no count.
 */

/**
 * Collapse the expiring twin a kept point leaves behind, so one captured state
 * is one entry. Two *named* keeps at the same state are two deliberate
 * bookmarks and both survive.
 */
export function collapseTwins<T extends { createdAt: string; kind: string }>(
  points: T[],
): T[] {
  const kept = new Set(
    points.filter((p) => p.kind === "keep").map((p) => p.createdAt),
  );
  return points.filter((p) => p.kind === "keep" || !kept.has(p.createdAt));
}
