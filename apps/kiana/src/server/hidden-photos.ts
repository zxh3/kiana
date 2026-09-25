import { env } from "cloudflare:workers";

import type { HiddenChange, HiddenPhoto } from "../lib/hidden-photos";
import type { PhotoAdmin } from "../lib/request-context";
import type { Account } from "./account";

/** D1 binds at most 100 values to a statement. */
const VALUES_PER_STATEMENT = 100;

/**
 * The photos hidden before admins could hide them, when the list lived in
 * the code. They are hidden once, as the table is made, so an admin can
 * show them again for good.
 */
const HIDDEN_BEFORE_ADMINS = [
  "3B5D2E57-4729-4162-BCBF-C564ACD828F8",
  "A1000D7E-742B-4A6B-9424-C558AF81E231",
  "F876BD7A-9160-414B-9953-B1392100174C",
];

let table: Promise<unknown> | null = null;

/**
 * Makes the hidden photos' table in the accounts database, once for each
 * copy of the Worker. It does not wait on signing in, since every visit to
 * the gallery reads it. A failure is tried again with the next request.
 */
function tableReady() {
  table ??= (async () => {
    const db = env.AUTH_DB;
    const exists = await db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'hidden_photo'",
      )
      .first();
    if (exists) return;
    const now = Date.now();
    // One transaction: if another copy of the Worker made the table first,
    // the create fails and the seed with it, so a photo an admin has since
    // shown is not hidden again.
    try {
      await db.batch([
        db.prepare(`CREATE TABLE hidden_photo (
          asset_id TEXT PRIMARY KEY,
          hidden_by TEXT,
          hidden_at INTEGER NOT NULL
        )`),
        ...HIDDEN_BEFORE_ADMINS.map((id) =>
          db
            .prepare(
              "INSERT INTO hidden_photo (asset_id, hidden_by, hidden_at) VALUES (?, NULL, ?)",
            )
            .bind(id, now),
        ),
      ]);
    } catch (error) {
      if (!String(error).includes("already exists")) throw error;
    }
  })().catch((error: unknown) => {
    table = null;
    throw error;
  });
  return table;
}

/** The ids of the photos hidden from the gallery, for every visit. */
export async function hiddenPhotoIds(): Promise<ReadonlySet<string>> {
  await tableReady();
  const { results } = await env.AUTH_DB.prepare(
    "SELECT asset_id FROM hidden_photo",
  ).all<{ asset_id: string }>();
  return new Set(results.map((row) => row.asset_id));
}

/**
 * What `admin` may do with the photos: see who hid each and when, and
 * change which are hidden. Whoever hid a photo first keeps the credit if
 * another admin hides it again.
 */
export function photoAdminFor(admin: Account): PhotoAdmin {
  const db = env.AUTH_DB;
  // Better Auth's own table, for the name of whoever hid each photo.
  const list = db.prepare(
    `SELECT hidden_photo.asset_id AS id, "user".name AS by, hidden_photo.hidden_at AS at
     FROM hidden_photo LEFT JOIN "user" ON "user".id = hidden_photo.hidden_by
     ORDER BY hidden_photo.hidden_at DESC, hidden_photo.asset_id`,
  );
  return {
    account: admin,
    async hidden() {
      await tableReady();
      const { results } = await list.all<HiddenPhoto>();
      return results;
    },
    async change({ hide, show }: HiddenChange) {
      await tableReady();
      const now = Date.now();
      const inserts = chunks(hide, VALUES_PER_STATEMENT / 3).map((rows) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO hidden_photo (asset_id, hidden_by, hidden_at) VALUES ${rows.map(() => "(?, ?, ?)").join(", ")}`,
          )
          .bind(...rows.flatMap((id) => [id, admin.id, now])),
      );
      const deletes = chunks(show, VALUES_PER_STATEMENT).map((ids) =>
        db
          .prepare(
            `DELETE FROM hidden_photo WHERE asset_id IN (${ids.map(() => "?").join(", ")})`,
          )
          .bind(...ids),
      );
      // The change and the list after it, together in one round trip.
      const results = await db.batch<HiddenPhoto>([
        ...inserts,
        ...deletes,
        list,
      ]);
      return results.at(-1)?.results ?? [];
    },
  };
}

/** `items` in runs of at most `size`. */
function chunks<T>(items: ReadonlyArray<T>, size: number) {
  const whole = Math.floor(size);
  const runs: T[][] = [];
  for (let start = 0; start < items.length; start += whole) {
    runs.push(items.slice(start, start + whole));
  }
  return runs;
}
