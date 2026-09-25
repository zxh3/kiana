import { describe, expect, it } from "vitest";

import { initialPodState } from "./machine";
import { describePod, type PodView, podRows } from "./rows";

describe("pocket player screen", () => {
  it("describes the screen for a screen reader", () => {
    const view: PodView = {
      playlist: [
        { videoId: "a", title: "One", artist: "First" },
        { videoId: "b", title: "Two", artist: "Second" },
      ],
      index: 1,
      shuffle: false,
      repeat: "all",
      backlight: "timed",
      clicker: true,
      finish: "silver",
      spinner: "stealth",
      face: "curious",
      account: { status: "guest", member: null },
      chat: {
        name: "kiana",
        status: "open",
        others: [{ id: "p2", name: "amy", verified: true }],
        last: { id: "m", from: "p2", name: "amy", text: "hi", at: 1 },
      },
      videoOpen: false,
      volume: 42,
      current: 65,
      duration: 200,
    };
    const rows = podRows(view);
    const state = initialPodState(1);
    expect(describePod(state, rows, view)).toBe("Now Playing: Two, Second");
    expect(describePod({ ...state, overlay: "volume" }, rows, view)).toBe(
      "Volume 42%",
    );
    expect(describePod({ ...state, overlay: "scrub" }, rows, view)).toBe(
      "Position 1:05 of 3:20",
    );
    expect(
      describePod(
        {
          ...state,
          screen: "settings",
          selected: { ...state.selected, settings: 4 },
        },
        rows,
        view,
      ),
    ).toBe("Clicker, On");
    expect(rows.songs[1].current).toBe(true);
    expect(describePod({ ...state, screen: "chat" }, rows, view)).toBe(
      "Chat Room, 2 online. amy: hi",
    );
    expect(describePod({ ...state, screen: "online" }, rows, view)).toBe(
      "kiana, You",
    );
    expect(rows.online.map((row) => row.label)).toEqual(["kiana", "amy"]);
    expect(
      describePod(
        {
          ...state,
          screen: "online",
          selected: { ...state.selected, online: 1 },
        },
        rows,
        view,
      ),
    ).toBe("amy, verified");
    expect(rows.settings[0]).toMatchObject({
      label: "Account",
      detail: "Guest",
      opens: true,
    });
    expect(rows.settings.at(-1)).toMatchObject({
      label: "Finger Spinner",
      detail: undefined,
      opens: true,
    });
    expect(rows.looks.map((row) => `${row.label}: ${row.detail}`)).toEqual([
      "Spinner: Stealth",
      "Kiana: Curious",
    ]);
    expect(rows.menu.map((row) => row.label)).toEqual([
      "Music",
      "Apps",
      "Settings",
      "Shuffle Songs",
      "Now Playing",
    ]);
    expect(rows.music.map((row) => row.label)).toEqual(["Cover Flow", "Songs"]);
    expect(rows.account.map((row) => row.label)).toEqual([
      "Sign In with Google",
    ]);
  });

  it("shows someone signed in by their Google name, which they keep", () => {
    const view: PodView = {
      playlist: [{ videoId: "a", title: "One", artist: "First" }],
      index: 0,
      shuffle: false,
      repeat: "all",
      backlight: "timed",
      clicker: true,
      finish: "silver",
      spinner: "stealth",
      face: "curious",
      account: { status: "member", member: { id: "u1", name: "Xiaohua" } },
      chat: { name: "Xiaohua", status: "open", others: [], last: undefined },
      videoOpen: false,
      volume: 50,
      current: 0,
      duration: 100,
    };
    const rows = podRows(view);
    expect(rows.settings[0]?.detail).toBe("Xiaohua");
    expect(rows.account.map((row) => row.label)).toEqual([
      "Xiaohua",
      "Sign Out",
    ]);
    expect(rows.online[0]).toMatchObject({ opens: false, verified: true });
  });
});
