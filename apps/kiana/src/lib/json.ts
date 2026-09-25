/**
 * A JSON object from text a browser sent, or null for anything else:
 * text longer than `max`, broken JSON, or JSON that is not an object.
 */
export function readJsonObject(
  raw: unknown,
  max: number,
): Record<string, unknown> | null {
  if (typeof raw !== "string" || raw.length > max) return null;
  try {
    const data: unknown = JSON.parse(raw);
    return typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
