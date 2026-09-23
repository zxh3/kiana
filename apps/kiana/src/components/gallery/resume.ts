import type { CollectionId } from "./collections";

const RESUME_KEY = "kiana.resume";

/** Where date order last left each collection, as asset ids. */
export type ResumePositions = Partial<Record<CollectionId, string>>;

export const resumeKey = RESUME_KEY;

export function parseResume(raw: string | null): ResumePositions {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ) as ResumePositions;
  } catch {
    return {};
  }
}
