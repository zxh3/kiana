import type { HiddenChange, HiddenPhoto } from "./hidden-photos";

/**
 * What the Worker (`src/server.ts`) hands TanStack Start with each
 * request, for the server functions in `src/data`: the few things they
 * need from the database, without the app's code reaching into the
 * Worker's. Each is only asked for when a server function needs it.
 */
export type RequestContext = {
  /** The ids of the photos hidden from the gallery. */
  hiddenPhotoIds: () => Promise<ReadonlySet<string>>;
  /**
   * What the admin making the request may do with photos, checked
   * afresh against the database; null for anyone who is not an admin.
   */
  photoAdmin: () => Promise<PhotoAdmin | null>;
};

/** An admin's hand on the gallery's photos. */
export type PhotoAdmin = {
  /** Who the admin is: their account's id, and their name. */
  account: { id: string; name: string };
  /** Every hidden photo, most recently hidden first. */
  hidden: () => Promise<HiddenPhoto[]>;
  /** Hides some photos and shows others, answering like `hidden`. */
  change: (change: HiddenChange) => Promise<HiddenPhoto[]>;
};

declare module "@tanstack/react-router" {
  interface Register {
    server: { requestContext: RequestContext };
  }
}
