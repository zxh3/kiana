import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import { parseHiddenChange } from "../lib/hidden-photos";
import type { RequestContext } from "../lib/request-context";
import { loadManifest, withoutHidden } from "./photos";

/**
 * The gallery's server functions. They run in the Worker, whether the page
 * is being drawn there or the browser calls them, and reach the database
 * through the request's context (`lib/request-context.ts`).
 */

/** The request's context, which the Worker always gives. */
function worker(context: RequestContext | undefined) {
  if (!context) throw new Error("Server functions need the Worker's context");
  return context;
}

/**
 * What the gallery shows: the current release, less the photos an admin
 * hid, which the page never carries.
 */
export const loadGallery = createServerFn({ method: "GET" }).handler(
  async ({ context }) => {
    const [assets, hidden] = await Promise.all([
      loadManifest(),
      worker(context).hiddenPhotoIds(),
    ]);
    return withoutHidden(assets, hidden);
  },
);

/**
 * The admin page's photos: every one in the release, and which are
 * hidden, by whom, and when, with who the admin is. Null for anyone who
 * is not an admin.
 */
export const loadAdminPhotos = createServerFn({ method: "GET" }).handler(
  async ({ context }) => {
    const admin = await worker(context).photoAdmin();
    if (!admin) return null;
    const [assets, hidden] = await Promise.all([
      loadManifest(),
      admin.hidden(),
    ]);
    return { admin: admin.account, assets, hidden };
  },
);

/**
 * Hides some photos from the gallery and shows others again, for an admin,
 * answering with every hidden photo after the change.
 */
export const changeHiddenPhotos = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => {
    const change = parseHiddenChange(raw);
    if (!change) {
      setResponseStatus(400);
      throw new Error("Not a change to hidden photos");
    }
    return change;
  })
  .handler(async ({ context, data }) => {
    const admin = await worker(context).photoAdmin();
    if (!admin) {
      setResponseStatus(403);
      throw new Error("Only admins can hide photos");
    }
    return admin.change(data);
  });
