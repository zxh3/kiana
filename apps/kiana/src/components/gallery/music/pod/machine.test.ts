import { describe, expect, it } from "vitest";

import {
  initialPodState,
  type PodAction,
  type PodContext,
  type PodEffect,
  type PodState,
  podReducer,
  seekStep,
} from "./machine";

const context: PodContext = {
  count: 5,
  index: 0,
  volume: 60,
  current: 30,
  duration: 180,
  clicker: true,
  videoOpen: false,
  videoCovers: false,
  online: 3,
};

/** Applies actions one after another, as the hook does, collecting effects. */
function run(
  actions: PodAction[],
  state: PodState = initialPodState(0),
  facts: PodContext = context,
) {
  const effects: PodEffect[] = [];
  let current = state;
  for (const action of actions) {
    const result = podReducer(current, action, facts);
    current = result.state;
    effects.push(...result.effects);
  }
  return { state: current, effects };
}

const at = (screen: PodState["screen"]): PodState => ({
  ...initialPodState(0),
  screen,
});

describe("pocket player machine", () => {
  it("counts every click of a fast turn", () => {
    const { state, effects } = run(
      [
        { type: "step", steps: 1 },
        { type: "step", steps: 1 },
        { type: "step", steps: 1 },
      ],
      at("menu"),
    );
    expect(state.selected.menu).toBe(3);
    expect(effects.filter((effect) => effect.type === "cue")).toHaveLength(3);
  });

  it("stops at the ends of a list without clicking", () => {
    const { state, effects } = run([{ type: "step", steps: -2 }], at("menu"));
    expect(state.selected.menu).toBe(0);
    expect(effects).toEqual([]);
  });

  it("stays quiet when the clicker is off", () => {
    const { effects } = run([{ type: "step", steps: 1 }], at("menu"), {
      ...context,
      clicker: false,
    });
    expect(effects).toEqual([]);
  });

  it("turns the volume on Now Playing, and under the video anywhere", () => {
    expect(run([{ type: "step", steps: 2 }]).effects).toContainEqual({
      type: "volume",
      volume: 66,
    });
    const covered = run([{ type: "step", steps: 1 }], at("settings"), {
      ...context,
      videoCovers: true,
    });
    expect(covered.state.selected.settings).toBe(0);
    expect(covered.effects).toContainEqual({ type: "volume", volume: 63 });
  });

  it("scrubs with the wheel and lands the seek once it settles", () => {
    const { state } = run([{ type: "select" }, { type: "step", steps: 2 }]);
    expect(state.overlay).toBe("scrub");
    expect(state.scrubAt).toBe(36);
    expect(state.seekPending).toBe(true);
    const settled = run([{ type: "commitSeek" }], state);
    expect(settled.effects).toEqual([{ type: "seek", seconds: 36 }]);
  });

  it("never lets a scrub aimed at one song land on the next", () => {
    const scrubbing = run([{ type: "select" }, { type: "step", steps: 2 }]);
    const skipped = run([{ type: "next" }], scrubbing.state);
    expect(skipped.state.scrubAt).toBeNull();
    expect(skipped.state.seekPending).toBe(false);
    expect(run([{ type: "commitSeek" }], skipped.state).effects).toEqual([]);
  });

  it("seeks when a finger lets go of the bar, and keeps the bar while held", () => {
    const dragging = run([{ type: "scrubTo", fraction: 0.5, done: false }]);
    expect(dragging.effects).toEqual([]);
    expect(dragging.state.touching).toBe(true);
    const expired = run(
      [{ type: "overlayExpired", stamp: dragging.state.overlayStamp }],
      dragging.state,
    );
    expect(expired.state.overlay).toBe("scrub");
    const released = run(
      [{ type: "scrubTo", fraction: 0.5, done: true }],
      dragging.state,
    );
    expect(released.effects).toEqual([{ type: "seek", seconds: 89.5 }]);
  });

  it("ignores an overlay timer that an earlier showing set", () => {
    const shown = run([{ type: "step", steps: 1 }]);
    const again = run([{ type: "step", steps: 1 }], shown.state);
    const stale = run(
      [{ type: "overlayExpired", stamp: shown.state.overlayStamp }],
      again.state,
    );
    expect(stale.state.overlay).toBe("volume");
  });

  it("locks every control while held, showing the padlock", () => {
    const held = run([{ type: "toggleHold" }], at("menu")).state;
    const { state, effects } = run(
      [
        { type: "step", steps: 1 },
        { type: "select" },
        { type: "next" },
        { type: "pick", screen: "menu", index: 2 },
        { type: "hover", screen: "menu", index: 3 },
      ],
      held,
    );
    expect(effects).toEqual([]);
    expect(state.selected.menu).toBe(0);
    expect(state.screen).toBe("menu");
    expect(state.lockShown).toBe(true);
  });

  it("goes back one screen at a time and nowhere from the top", () => {
    const { state } = run([{ type: "back" }, { type: "back" }], at("songs"));
    expect(state.screen).toBe("menu");
    expect(state.direction).toBe(-1);
  });

  it("closes the video before going back", () => {
    const { state, effects } = run([{ type: "back" }], at("settings"), {
      ...context,
      videoOpen: true,
      videoCovers: true,
    });
    expect(state.screen).toBe("settings");
    expect(effects).toContainEqual({ type: "video", on: false });
  });

  it("toggles the video from the cover, but not while held", () => {
    expect(run([{ type: "toggleVideo" }]).effects).toContainEqual({
      type: "video",
      on: true,
    });
    const shown = { ...context, videoOpen: true, videoCovers: true };
    expect(
      run([{ type: "toggleVideo" }], undefined, shown).effects,
    ).toContainEqual({ type: "video", on: false });
    const held = run([{ type: "toggleHold" }]).state;
    expect(run([{ type: "toggleVideo" }], held).effects).toEqual([]);
  });

  it("fast-forwards while ⏭ is held, faster over time, and lands on release", () => {
    const holding = run([{ type: "holdStart", zone: "next" }]);
    expect(holding.state.seeking).toBe(1);
    expect(holding.state.overlay).toBe("scrub");
    const ticked = run(
      Array.from({ length: 12 }, () => ({ type: "seekTick" }) as const),
      holding.state,
    );
    // Ten ticks of 2s, then two of 5s, from 0:30.
    expect(ticked.state.scrubAt).toBe(30 + 10 * 2 + 2 * 5);
    expect(seekStep(0)).toBe(2);
    expect(seekStep(30)).toBe(10);
    const released = run([{ type: "holdEnd", zone: "next" }], ticked.state);
    expect(released.state.seeking).toBe(0);
    expect(released.effects).toEqual([{ type: "seek", seconds: 60 }]);
  });

  it("rewinds while ⏮ is held, stopping at the start", () => {
    const holding = run([{ type: "holdStart", zone: "previous" }]).state;
    const ticked = run(
      Array.from({ length: 40 }, () => ({ type: "seekTick" }) as const),
      holding,
    );
    expect(ticked.state.scrubAt).toBe(0);
  });

  it("sleeps when play is held, and the next touch only wakes it", () => {
    const asleep = run([{ type: "holdStart", zone: "play" }], at("menu"));
    expect(asleep.state.asleep).toBe(true);
    expect(asleep.effects).toContainEqual({ type: "pause" });
    const woken = run([{ type: "step", steps: 1 }], asleep.state);
    expect(woken.state.asleep).toBe(false);
    expect(woken.state.selected.menu).toBe(0);
    expect(woken.effects).toEqual([]);
  });

  it("toggles the backlight when Menu is held", () => {
    expect(run([{ type: "holdStart", zone: "menu" }]).effects).toContainEqual({
      type: "backlight",
    });
  });

  it("locks the held buttons too while the hold switch is on", () => {
    const held = run([{ type: "toggleHold" }]).state;
    const { state, effects } = run([{ type: "holdStart", zone: "play" }], held);
    expect(effects).toEqual([]);
    expect(state.asleep).toBe(false);
    expect(state.lockShown).toBe(true);
  });

  it("opens song lists on the song that is playing", () => {
    const menu = { ...at("menu"), selected: { ...at("menu").selected } };
    const { state } = run([{ type: "pick", screen: "menu", index: 0 }], menu, {
      ...context,
      index: 3,
    });
    expect(state.screen).toBe("covers");
    expect(state.selected.covers).toBe(3);
  });

  it("brings a tapped side cover to the middle, and plays the middle one", () => {
    const covers = at("covers");
    const side = run([{ type: "pick", screen: "covers", index: 2 }], covers);
    expect(side.state.selected.covers).toBe(2);
    expect(side.effects).not.toContainEqual({ type: "play", index: 2 });
    const middle = run(
      [{ type: "pick", screen: "covers", index: 2 }],
      side.state,
    );
    expect(middle.state.screen).toBe("now");
    expect(middle.effects).toContainEqual({ type: "play", index: 2 });
  });

  it("follows the song that is playing in the song lists", () => {
    const { state } = run([{ type: "trackChanged", index: 4 }], at("covers"));
    expect(state.selected.covers).toBe(4);
    expect(state.selected.songs).toBe(4);
  });

  it("opens the finger spinner from Apps, and goes back the same way", () => {
    const menu = at("menu");
    const { state } = run(
      [{ type: "pick", screen: "menu", index: 3 }, { type: "select" }],
      menu,
    );
    expect(state.screen).toBe("spinner");
    expect(run([{ type: "back" }], state).state.screen).toBe("apps");
  });

  it("winds the finger spinner with each click and flicks it with the centre", () => {
    const { state, effects } = run(
      [
        { type: "step", steps: 2 },
        { type: "step", steps: -1 },
        { type: "select" },
        { type: "select" },
      ],
      at("spinner"),
    );
    expect(state.spin).toEqual({ steps: 1, flicks: 2 });
    expect(state.screen).toBe("spinner");
    expect(effects).toContainEqual({ type: "cue", cue: "wheel" });
    const quiet = run([{ type: "step", steps: 1 }], at("spinner"), {
      ...context,
      clicker: false,
    });
    expect(quiet.effects).toEqual([]);
    expect(quiet.state.spin.steps).toBe(1);
  });

  it("goes from Apps to the Chat Room, its Online list, and Your Name", () => {
    const { state } = run(
      [
        { type: "pick", screen: "apps", index: 1 },
        { type: "select" },
        { type: "select" },
      ],
      at("apps"),
    );
    expect(state.screen).toBe("name");
    const back = run(
      [{ type: "back" }, { type: "back" }, { type: "back" }],
      state,
    );
    expect(back.state.screen).toBe("apps");
  });

  it("scrolls the Chat Room with the wheel", () => {
    const { state, effects } = run(
      [
        { type: "step", steps: 2 },
        { type: "step", steps: -3 },
      ],
      at("chat"),
    );
    expect(state.chat.steps).toBe(-1);
    expect(effects).toContainEqual({ type: "cue", cue: "wheel" });
  });

  it("moves through the Online list, and only the viewer's row opens", () => {
    const moved = run([{ type: "step", steps: 5 }], at("online"));
    expect(moved.state.selected.online).toBe(2);
    const other = run([{ type: "select" }], moved.state);
    expect(other.state.screen).toBe("online");
    expect(other.effects).toEqual([]);
  });

  it("saves a name from Your Name and goes back to the list", () => {
    const pressed = run([{ type: "select" }], at("name"));
    expect(pressed.state.chat.saves).toBe(1);
    expect(pressed.state.screen).toBe("name");
    const { state, effects } = run(
      [{ type: "saveName", name: "kiana" }],
      pressed.state,
    );
    expect(state.screen).toBe("online");
    expect(effects).toContainEqual({ type: "rename", name: "kiana" });
    // A second save, from Enter and the centre at once, does nothing more.
    expect(run([{ type: "saveName", name: "k" }], state).effects).toEqual([]);
  });

  it("sends a message with a click", () => {
    const { effects } = run([{ type: "say", text: "hi" }], at("chat"));
    expect(effects).toEqual([
      { type: "cue", cue: "select" },
      { type: "say", text: "hi" },
    ]);
  });
});
