import { env } from "cloudflare:workers";

import {
  FAVORITES_MAX,
  type FavoritesChange,
  parseFavoritesChange,
} from "../lib/favorites";
import type { Account } from "./account";

/** The largest request body read, enough for a whole library of ids. */
const BODY_MAX = 1_000_000;
/** Rows in one insert, within D1's limit of 100 values a statement. */
const ROWS_PER_INSERT = 33;

let table: Promise<unknown> | null = null;

/**
 * Creates the favorites table, in the accounts database, once for each
 * copy of the Worker. A failure is tried again with the next request.
 */
function tableReady() {
  table ??= env.AUTH_DB.prepare(
    `CREATE TABLE IF NOT EXISTS favorite (
      user_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, asset_id)
    )`,
  )
    .run()
    .catch((error: unknown) => {
      table = null;
      throw error;
    });
  return table;
}

/**
 * The favorites of someone signed in, at `FAVORITES_PATH`: GET answers
 * with their ids, oldest first, and POST adds and removes some
 * (`FavoritesChange`) and answers the same way. A guest has none.
 */
export async function handleFavorites(
  request: Request,
  account: Account | null,
) {
  if (!account) return answer({ error: "Sign in to keep favorites" }, 401);
  await tableReady();
  if (request.method === "POST") {
    const change = parseFavoritesChange(await readJson(request));
    if (!change) return answer({ error: "Not a change to favorites" }, 400);
    if (!(await apply(account.id, change))) {
      return answer({ error: "Too many favorites" }, 409);
    }
  } else if (request.method !== "GET") {
    return answer({ error: "Use GET or POST" }, 405);
  }
  const { results } = await env.AUTH_DB.prepare(
    "SELECT asset_id FROM favorite WHERE user_id = ? ORDER BY created_at, asset_id",
  )
    .bind(account.id)
    .all<{ asset_id: string }>();
  return answer({ ids: results.map((row) => row.asset_id) });
}

/**
 * Applies a change, all of it or none. False, changing nothing, when the
 * additions would take the account past `FAVORITES_MAX`.
 */
async function apply(user: string, { add, remove }: FavoritesChange) {
  const db = env.AUTH_DB;
  if (add.length > 0) {
    const count = await db
      .prepare("SELECT COUNT(*) AS count FROM favorite WHERE user_id = ?")
      .bind(user)
      .first<number>("count");
    if ((count ?? 0) + add.length > FAVORITES_MAX) return false;
  }
  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  for (let start = 0; start < add.length; start += ROWS_PER_INSERT) {
    const rows = add.slice(start, start + ROWS_PER_INSERT);
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO favorite (user_id, asset_id, created_at) VALUES ${rows.map(() => "(?, ?, ?)").join(", ")}`,
        )
        .bind(...rows.flatMap((asset) => [user, asset, now])),
    );
  }
  for (const asset of remove) {
    statements.push(
      db
        .prepare("DELETE FROM favorite WHERE user_id = ? AND asset_id = ?")
        .bind(user, asset),
    );
  }
  await db.batch(statements);
  return true;
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > BODY_MAX) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function answer(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
