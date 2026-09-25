import { describe, expect, it } from "vitest";

import { podAccount } from "./account";
import { accountItems } from "./music/pod/menu";

describe("podAccount", () => {
  const user = { id: "u1", name: "  Xiaohua " };

  it("is checking until the session answers", () => {
    expect(podAccount({ data: null, isPending: true, error: null })).toEqual({
      status: "checking",
      member: null,
    });
  });

  it("is a guest without a session, and a member with one", () => {
    expect(podAccount({ data: null, isPending: false, error: null })).toEqual({
      status: "guest",
      member: null,
    });
    expect(
      podAccount({ data: { user }, isPending: false, error: null }),
    ).toEqual({ status: "member", member: { id: "u1", name: "Xiaohua" } });
  });

  it("keeps a member while the session is checked again", () => {
    expect(
      podAccount({ data: { user }, isPending: true, error: null }).status,
    ).toBe("member");
  });

  it("is unavailable when the Worker cannot say", () => {
    expect(
      podAccount({ data: null, isPending: false, error: new Error("503") })
        .status,
    ).toBe("unavailable");
  });
});

describe("accountItems", () => {
  it("offers a way in to a guest and a way out to a member", () => {
    expect(accountItems("guest")).toEqual(["signIn"]);
    expect(accountItems("member")).toEqual(["member", "signOut"]);
    expect(accountItems("checking")).toEqual(["checking"]);
    expect(accountItems("unavailable")).toEqual(["unavailable"]);
  });
});
