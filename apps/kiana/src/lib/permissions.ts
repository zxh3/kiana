import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Who may do what, for Better Auth's admin plugin, as the browser and the
 * Worker (`src/server/auth.ts`) both see it. Better Auth's own statements
 * cover people and their sessions; `photo` is the gallery's.
 *
 * Each role is given only what the admin page uses, so an admin cannot,
 * say, sign in as someone else, though Better Auth could allow it.
 */
export const accessControl = createAccessControl({
  ...defaultStatements,
  photo: ["hide", "show"],
} as const);

export const roles = {
  user: accessControl.newRole({ user: [], session: [], photo: [] }),
  admin: accessControl.newRole({
    user: ["list", "set-role"],
    session: [],
    photo: ["hide", "show"],
  }),
};

export type Role = keyof typeof roles;

/** The role everyone who signs in starts with. */
export const DEFAULT_ROLE: Role = "user";

/**
 * Whether someone with `role` may hide photos from the gallery and show
 * them again. Better Auth keeps several roles as one comma-separated
 * string; any one of them will do.
 */
export function canManagePhotos(role: string | null | undefined) {
  return roleNames(role).some(
    (name) =>
      Object.hasOwn(roles, name) &&
      roles[name as Role].authorize({ photo: ["hide", "show"] }).success,
  );
}

/** Whether `role`, as Better Auth keeps it, includes admin. */
export function isAdmin(role: string | null | undefined) {
  return roleNames(role).includes("admin");
}

function roleNames(role: string | null | undefined) {
  return (role ?? DEFAULT_ROLE).split(",").map((name) => name.trim());
}
