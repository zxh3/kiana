import { describe, expect, it } from "vitest";

import { canManagePhotos, isAdmin, roles } from "./permissions";

describe("canManagePhotos", () => {
  it("lets admins hide photos, and no one else", () => {
    expect(canManagePhotos("admin")).toBe(true);
    expect(canManagePhotos("user")).toBe(false);
    expect(canManagePhotos(null)).toBe(false);
    expect(canManagePhotos(undefined)).toBe(false);
  });

  it("reads Better Auth's comma-separated roles", () => {
    expect(canManagePhotos("user,admin")).toBe(true);
  });

  it("ignores roles it does not know", () => {
    expect(canManagePhotos("owner")).toBe(false);
    expect(canManagePhotos("constructor")).toBe(false);
    expect(canManagePhotos("")).toBe(false);
  });
});

describe("roles", () => {
  it("gives admins only what the admin page uses", () => {
    const { admin } = roles;
    expect(admin.authorize({ user: ["list", "set-role"] }).success).toBe(true);
    expect(admin.authorize({ user: ["impersonate"] }).success).toBe(false);
    expect(admin.authorize({ user: ["delete"] }).success).toBe(false);
  });
});

describe("isAdmin", () => {
  it("finds admin among Better Auth's roles", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("user, admin")).toBe(true);
    expect(isAdmin("user")).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
