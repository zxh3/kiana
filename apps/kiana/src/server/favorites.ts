import { env } from "cloudflare:workers";

import {
  FAVORITES_MAX,
  type FavoritesChange,
  parseFavoritesChange,
} from "../lib/favorites";
import { readJsonObject } from "../lib/json";
import type { Account } from "./account";

/** The largest request body read, enough for a whole library of ids. */
const BODY_MAX = 1_000_000;
/** Rows in one insert, within D1's limit of 100 values a statement. */
const ROWS_PER_INSERT = 33;

/** The favorites table, in the accounts database, made by `databaseReady`. */
export const FAVORITES_TABLE = `CREATE TABLE IF NOT EXISTS favorite (
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, asset_id)
)`;

/**
 * The favorites of someone signed in, at `FAVORITES_PATH`: GET answers
 * with their ids, oldest first, and POST adds and removes some
 * (`FavoritesChange`) and answers the same way. A guest has none. The
 * table is ready by the time there is an account, since checking the
 * session readies the database.
 */
export async function handleFavorites(
  request: Request,
  account: Account | null,
) {
  if (!account) return answer({ error: "Sign in to keep favorites" }, 401);
  const db = env.AUTH_DB;
  const list = db
    .prepare(
      "SELECT asset_id FROM favorite WHERE user_id = ? ORDER BY created_at, asset_id",
    )
    .bind(account.id);
  if (request.method === "GET") {
    const { results } = await list.all<{ asset_id: string }>();
    return answer({ ids: results.map((row) => row.asset_id) });
  }
  if (request.method !== "POST") {
    return answer({ error: "Use GET or POST" }, 405);
  }
  const change = parseFavoritesChange(
    readJsonObject(await request.text(), BODY_MAX),
  );
  if (!change) return answer({ error: "Not a change to favorites" }, 400);
  if (!(await roomFor(account.id, change.add.length))) {
    return answer({ error: "Too many favorites" }, 409);
  }
  // The change and the favorites after it, together in one round trip.
  const results = await db.batch<{ asset_id: string }>([
    ...statements(account.id, change),
    list,
  ]);
  const ids = results.at(-1)?.results.map((row) => row.asset_id) ?? [];
  return answer({ ids });
}

/** Whether `adding` more favorites stay within `FAVORITES_MAX`. */
async function roomFor(user: string, adding: number) {
  if (adding === 0) return true;
  const count = await env.AUTH_DB.prepare(
    "SELECT COUNT(*) AS count FROM favorite WHERE user_id = ?",
  )
    .bind(user)
    .first<number>("count");
  return (count ?? 0) + adding <= FAVORITES_MAX;
}

/** The inserts and deletes that make a change, all of it or none. */
function statements(user: string, { add, remove }: FavoritesChange) {
  const db = env.AUTH_DB;
  const now = Date.now();
  const inserts: D1PreparedStatement[] = [];
  for (let start = 0; start < add.length; start += ROWS_PER_INSERT) {
    const rows = add.slice(start, start + ROWS_PER_INSERT);
    inserts.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO favorite (user_id, asset_id, created_at) VALUES ${rows.map(() => "(?, ?, ?)").join(", ")}`,
        )
        .bind(...rows.flatMap((asset) => [user, asset, now])),
    );
  }
  const deletes = remove.map((asset) =>
    db
      .prepare("DELETE FROM favorite WHERE user_id = ? AND asset_id = ?")
      .bind(user, asset),
  );
  return [...inserts, ...deletes];
}

function answer(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
