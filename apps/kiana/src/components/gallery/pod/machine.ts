import type { CueName } from "../../../lib/sounds";
import type { AccountStatus } from "../account";
import type { HoldZone } from "./device/wheel";
import {
  accountItems,
  appItems,
  type ChoiceScreen,
  clamp,
  menuItems,
  moveSelection,
  type Screen,
  screens,
  settingsItems,
  type ToggleSetting,
} from "./menu";

/**
 * The pocket player's behaviour as a pure state machine: every press, turn,
 * tap, and timer is an action, and the result is the next state plus the
 * effects to carry out (sounds, playback, settings). Actions apply to the
 * latest state one after another, so fast wheel turns never drop clicks,
 * and the rules can be tested without React.
 */

/** What Now Playing shows in place of the progress bar. */
export type Overlay = "volume" | "scrub";

export type PodState = {
  screen: Screen;
  /** Which way the last screen change slid: deeper (1) or back (-1). */
  direction: 1 | -1;
  /** The highlight on each screen that has one. */
  selected: Record<ChoiceScreen, number>;
  overlay: Overlay | null;
  /** Bumped whenever the overlay shows again, so its timer restarts. */
  overlayStamp: number;
  /** A finger is on one of Now Playing's bars, so the overlay stays. */
  touching: boolean;
  /** Where the scrubber points, until the song catches up. */
  scrubAt: number | null;
  /** The scrubber moved by the wheel and the song has not jumped there yet. */
  seekPending: boolean;
  held: boolean;
  lockShown: boolean;
  /** Bumped whenever the padlock shows again, so its timer restarts. */
  lockStamp: number;
  /** Rewinding (-1) or fast-forwarding (1) while ⏮ or ⏭ is held. */
  seeking: -1 | 0 | 1;
  /** Ticks since the seek began, so it speeds up the longer it is held. */
  seekTicks: number;
  /** Put to sleep by holding play: paused, the screen dark. */
  asleep: boolean;
  /**
   * What the wheel has done on an app's own screen, counted up: its clicks
   * (signed), which wind the finger spinner and scroll the Chat Room, and
   * presses of the centre button, which flick the spinner and save Your
   * Name. The screen showing turns each new one into motion or an action,
   * counting from where they were when it opened.
   */
  wheel: { steps: number; presses: number };
};

/** What the machine needs to know about the music and the widget. */
export type PodContext = {
  /** Songs in the playlist. */
  count: number;
  /** The song that is playing. */
  index: number;
  volume: number;
  current: number;
  duration: number;
  clicker: boolean;
  /** The viewer turned the video on. */
  videoOpen: boolean;
  /** The video covers the display (turned on, or YouTube needs a tap). */
  videoCovers: boolean;
  /** Rows in the Chat Room's Online list, the viewer's own first. */
  online: number;
  /** Whether the viewer is signed in with Google. */
  account: AccountStatus;
};

export type PodEffect =
  | { type: "cue"; cue: CueName }
  | { type: "play"; index: number }
  | { type: "next" }
  | { type: "previous" }
  | { type: "toggle" }
  | { type: "shuffle" }
  | { type: "volume"; volume: number }
  | { type: "seek"; seconds: number }
  | { type: "pause" }
  | { type: "backlight" }
  | { type: "setting"; item: ToggleSetting }
  | { type: "video"; on: boolean }
  | { type: "say"; text: string }
  | { type: "rename"; name: string }
  | { type: "pat" }
  | { type: "signIn" }
  | { type: "signOut" };

export type PodAction =
  // The click wheel.
  | { type: "step"; steps: number }
  | { type: "select" }
  | { type: "back" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "playPause" }
  | { type: "holdStart"; zone: HoldZone }
  | { type: "holdEnd"; zone: HoldZone }
  // The touch screen.
  | { type: "toggleVideo" }
  | { type: "pick"; screen: ChoiceScreen; index: number }
  | { type: "hover"; screen: ChoiceScreen; index: number }
  | { type: "scrubTo"; fraction: number; done: boolean }
  | { type: "volumeTo"; fraction: number; done: boolean }
  // The Chat Room's text fields.
  | { type: "say"; text: string }
  | { type: "saveName"; name: string }
  // The hold switch.
  | { type: "toggleHold" }
  // The world and the clock.
  | { type: "trackChanged"; index: number }
  | { type: "overlayExpired"; stamp: number }
  | { type: "commitSeek" }
  | { type: "seekTick" }
  | { type: "lockExpired"; stamp: number };

export const VOLUME_STEP = 3;
export const SCRUB_STEP = 3;
export const overlayDurations: Record<Overlay, number> = {
  volume: 1_600,
  scrub: 3_500,
};
export const LOCK_SHOWS_FOR = 1_100;
/** The wheel's scrubber seeks once it rests this long. */
export const SEEK_SETTLE = 300;
/** How often a held ⏮ or ⏭ moves the scrubber. */
export const SEEK_TICK = 150;

/** Seconds a held ⏮ or ⏭ moves per tick, faster the longer it is held. */
export function seekStep(ticks: number) {
  if (ticks < 10) return 2;
  if (ticks < 25) return 5;
  return 10;
}

/** Actions that come from the controls, which the hold switch locks. */
const lockable = new Set<PodAction["type"]>([
  "step",
  "select",
  "back",
  "next",
  "previous",
  "playPause",
  "holdStart",
  "toggleVideo",
  "pick",
  "scrubTo",
  "volumeTo",
]);

type Result = { state: PodState; effects: PodEffect[] };

export function initialPodState(index: number): PodState {
  return {
    screen: "now",
    direction: 1,
    selected: {
      menu: 0,
      covers: index,
      songs: index,
      apps: 0,
      online: 0,
      settings: 0,
      account: 0,
    },
    overlay: null,
    overlayStamp: 0,
    touching: false,
    scrubAt: null,
    seekPending: false,
    held: false,
    lockShown: false,
    lockStamp: 0,
    seeking: 0,
    seekTicks: 0,
    asleep: false,
    wheel: { steps: 0, presses: 0 },
  };
}

function choiceCount(screen: ChoiceScreen, context: PodContext) {
  if (screen === "menu") return menuItems.length;
  if (screen === "settings") return settingsItems.length;
  if (screen === "apps") return appItems.length;
  if (screen === "online") return context.online;
  if (screen === "account") return accountItems(context.account).length;
  return context.count;
}

/** The wheel's own tick, unless the clicker is off. */
function tick(context: PodContext): PodEffect[] {
  return context.clicker ? [{ type: "cue", cue: "wheel" }] : [];
}

/** The wheel's clicks and presses, counted up for the app showing. */
function countWheel(state: PodState, steps: number, presses: number) {
  const { wheel } = state;
  return {
    ...state,
    wheel: { steps: wheel.steps + steps, presses: wheel.presses + presses },
  };
}

function show(state: PodState, overlay: Overlay): PodState {
  return { ...state, overlay, overlayStamp: state.overlayStamp + 1 };
}

/** Drops the scrubber, landing any seek it still owes first. */
function clearScrub(state: PodState): Result {
  const effects: PodEffect[] =
    state.seekPending && state.scrubAt !== null
      ? [{ type: "seek", seconds: state.scrubAt }]
      : [];
  return {
    state: {
      ...state,
      overlay: null,
      touching: false,
      scrubAt: null,
      seekPending: false,
    },
    effects,
  };
}

function go(state: PodState, screen: Screen, direction: 1 | -1): Result {
  const cleared = clearScrub(state);
  return { ...cleared, state: { ...cleared.state, screen, direction } };
}

function choose(state: PodState, screen: ChoiceScreen, index: number) {
  return { ...state, selected: { ...state.selected, [screen]: index } };
}

function turnVolume(
  state: PodState,
  steps: number,
  context: PodContext,
): Result {
  const volume = clamp(context.volume + steps * VOLUME_STEP, 0, 100);
  return {
    state: show(state, "volume"),
    effects:
      volume === context.volume
        ? []
        : [...tick(context), { type: "volume", volume }],
  };
}

function turnScrubber(
  state: PodState,
  steps: number,
  context: PodContext,
): Result {
  if (context.duration <= 0) return { state, effects: [] };
  const scrubAt = clamp(
    (state.scrubAt ?? context.current) + steps * SCRUB_STEP,
    0,
    context.duration - 1,
  );
  return {
    state: { ...show(state, "scrub"), scrubAt, seekPending: true },
    effects: tick(context),
  };
}

function activate(
  state: PodState,
  screen: ChoiceScreen,
  index: number,
  context: PodContext,
): Result {
  const chosen = choose(state, screen, index);
  const select: PodEffect = { type: "cue", cue: "select" };

  if (screen === "songs" || screen === "covers") {
    const next = go(chosen, "now", 1);
    return {
      ...next,
      effects: [select, ...next.effects, { type: "play", index }],
    };
  }
  if (screen === "settings") {
    const item = settingsItems[index];
    if (item === "account") {
      const next = go(chosen, "account", 1);
      return { ...next, effects: [select, ...next.effects] };
    }
    return { state: chosen, effects: [select, { type: "setting", item }] };
  }
  // Signing in leaves for Google and comes back; signing out stays, with
  // the highlight on the way back in.
  if (screen === "account") {
    const item = accountItems(context.account)[index];
    if (item === "signIn") {
      return { state: chosen, effects: [select, { type: "signIn" }] };
    }
    if (item === "signOut") {
      return {
        state: choose(chosen, "account", 0),
        effects: [select, { type: "signOut" }],
      };
    }
    return { state: chosen, effects: [] };
  }
  if (screen === "apps") {
    const next = go(chosen, appItems[index], 1);
    return { ...next, effects: [select, ...next.effects] };
  }
  // In the Online list only the viewer's own row, the first, opens: to
  // change their name, unless they go by their Google account's.
  if (screen === "online") {
    if (index !== 0 || context.account === "member") {
      return { state: chosen, effects: [] };
    }
    const next = go(chosen, "name", 1);
    return { ...next, effects: [select, ...next.effects] };
  }

  const item = menuItems[index];
  if (item === "shuffle") {
    const next = go(chosen, "now", 1);
    return { ...next, effects: [select, ...next.effects, { type: "shuffle" }] };
  }
  // Song lists open on the song that is playing.
  const opened =
    item === "covers" || item === "songs"
      ? choose(chosen, item, context.index)
      : chosen;
  const next = go(opened, item, 1);
  return { ...next, effects: [select, ...next.effects] };
}

export function podReducer(
  state: PodState,
  action: PodAction,
  context: PodContext,
): Result {
  const unchanged: Result = { state, effects: [] };

  // With the hold switch on, the controls only show the padlock.
  if (state.held && lockable.has(action.type)) {
    return {
      state: { ...state, lockShown: true, lockStamp: state.lockStamp + 1 },
      effects: [],
    };
  }
  // Asleep, the first touch only wakes it.
  if (state.asleep && lockable.has(action.type)) {
    return { state: { ...state, asleep: false }, effects: [] };
  }

  switch (action.type) {
    case "step": {
      // Under the video, as on Now Playing, the wheel is the volume.
      if (context.videoCovers) {
        return turnVolume(state, action.steps, context);
      }
      if (state.screen === "now") {
        return state.overlay === "scrub"
          ? turnScrubber(state, action.steps, context)
          : turnVolume(state, action.steps, context);
      }
      // The finger spinner winds with every click, and the Chat Room
      // scrolls; both click to be felt.
      if (state.screen === "spinner" || state.screen === "chat") {
        return {
          state: countWheel(state, action.steps, 0),
          effects: tick(context),
        };
      }
      if (state.screen === "name" || state.screen === "muyu") return unchanged;
      const screen = state.screen;
      const index = moveSelection(
        state.selected[screen],
        action.steps,
        choiceCount(screen, context),
      );
      if (index === state.selected[screen]) return unchanged;
      return { state: choose(state, screen, index), effects: tick(context) };
    }

    case "select": {
      const press: PodEffect = { type: "cue", cue: "press" };
      if (context.videoCovers) return { state, effects: [press] };
      // The centre button flicks the finger spinner.
      if (state.screen === "spinner") {
        return { state: countWheel(state, 0, 1), effects: [press] };
      }
      // The electronic wooden fish: each press pats Kiana's head, for merit.
      if (state.screen === "muyu") {
        return { state, effects: [press, { type: "pat" }] };
      }
      // In the Chat Room the centre button opens the Online list, and on
      // Your Name it saves the name, which the screen answers with
      // `saveName`.
      if (state.screen === "chat") {
        const next = go(state, "online", 1);
        return { ...next, effects: [{ type: "cue", cue: "select" }] };
      }
      if (state.screen === "name") {
        return { state: countWheel(state, 0, 1), effects: [] };
      }
      if (state.screen !== "now") {
        return activate(
          state,
          state.screen,
          state.selected[state.screen],
          context,
        );
      }
      if (state.overlay === "scrub") {
        const cleared = clearScrub(state);
        return { ...cleared, effects: [press, ...cleared.effects] };
      }
      return {
        state: { ...show(state, "scrub"), scrubAt: null, seekPending: false },
        effects: [press],
      };
    }

    case "back": {
      const press: PodEffect = { type: "cue", cue: "press" };
      if (context.videoOpen) {
        return { state, effects: [press, { type: "video", on: false }] };
      }
      const parent = screens[state.screen].parent;
      if (!parent || context.videoCovers) return { state, effects: [press] };
      const next = go(state, parent, -1);
      return { ...next, effects: [press, ...next.effects] };
    }

    case "next":
    case "previous": {
      // A new song starts clean: no scrubber aiming at the old one's time.
      const cleared = {
        ...state,
        overlay: state.overlay === "scrub" ? null : state.overlay,
        scrubAt: null,
        seekPending: false,
      };
      return {
        state: cleared,
        effects: [
          {
            type: "cue",
            cue: action.type === "next" ? "songNext" : "songPrevious",
          },
          { type: action.type },
        ],
      };
    }

    case "playPause":
      return {
        state,
        effects: [{ type: "cue", cue: "press" }, { type: "toggle" }],
      };

    case "toggleVideo":
      // The cover on Now Playing opens the video; it closes the same way,
      // or with Menu.
      return {
        state,
        effects: [
          { type: "cue", cue: "select" },
          { type: "video", on: !context.videoOpen },
        ],
      };

    case "holdStart": {
      if (action.zone === "menu") {
        // Holding Menu turns the backlight off, or back on.
        return {
          state,
          effects: [{ type: "cue", cue: "press" }, { type: "backlight" }],
        };
      }
      if (action.zone === "play") {
        // Holding play puts it to sleep: paused, the screen dark.
        const cleared = clearScrub(state);
        return {
          state: { ...cleared.state, asleep: true },
          effects: [
            ...cleared.effects,
            { type: "cue", cue: "switchOff" },
            { type: "pause" },
          ],
        };
      }
      // Holding ⏮ or ⏭ rewinds or fast-forwards through the song.
      if (context.duration <= 0) return unchanged;
      return {
        state: {
          ...show(state, "scrub"),
          seeking: action.zone === "next" ? 1 : -1,
          seekTicks: 0,
          touching: true,
          scrubAt: state.scrubAt ?? context.current,
          seekPending: false,
        },
        effects: [{ type: "cue", cue: "press" }],
      };
    }

    case "seekTick": {
      if (state.seeking === 0 || context.duration <= 0) return unchanged;
      const scrubAt = clamp(
        (state.scrubAt ?? context.current) +
          state.seeking * seekStep(state.seekTicks),
        0,
        context.duration - 1,
      );
      return {
        state: { ...state, scrubAt, seekTicks: state.seekTicks + 1 },
        effects: [],
      };
    }

    case "holdEnd": {
      if (state.seeking === 0 || state.scrubAt === null) return unchanged;
      // Letting go of ⏮ or ⏭ lands the song where the seek got to.
      return {
        state: {
          ...show(state, "scrub"),
          seeking: 0,
          seekTicks: 0,
          touching: false,
        },
        effects: [{ type: "seek", seconds: state.scrubAt }],
      };
    }

    case "pick": {
      // A tap on a side cover brings it to the middle; anything else opens.
      if (
        action.screen === "covers" &&
        action.index !== state.selected.covers
      ) {
        return {
          state: choose(state, "covers", action.index),
          effects: tick(context),
        };
      }
      return activate(state, action.screen, action.index, context);
    }

    case "hover":
      if (
        state.held ||
        state.asleep ||
        state.selected[action.screen] === action.index
      ) {
        return unchanged;
      }
      return { state: choose(state, action.screen, action.index), effects: [] };

    case "scrubTo": {
      if (context.duration <= 0) return unchanged;
      const scrubAt = clamp(action.fraction, 0, 1) * (context.duration - 1);
      return {
        state: {
          ...show(state, "scrub"),
          scrubAt,
          seekPending: false,
          touching: !action.done,
        },
        effects: action.done ? [{ type: "seek", seconds: scrubAt }] : [],
      };
    }

    case "volumeTo": {
      const volume = Math.round(clamp(action.fraction, 0, 1) * 100);
      return {
        state: { ...show(state, "volume"), touching: !action.done },
        effects: volume === context.volume ? [] : [{ type: "volume", volume }],
      };
    }

    case "say":
      return {
        state,
        effects: [
          { type: "cue", cue: "select" },
          { type: "say", text: action.text },
        ],
      };

    case "saveName": {
      if (state.screen !== "name") return unchanged;
      const next = go(state, "online", -1);
      return {
        ...next,
        effects: [
          { type: "cue", cue: "select" },
          { type: "rename", name: action.name },
        ],
      };
    }

    case "toggleHold":
      return {
        state: { ...state, held: !state.held, lockShown: false },
        effects: [{ type: "cue", cue: state.held ? "switchOff" : "switchOn" }],
      };

    case "trackChanged": {
      const cleared = {
        ...state,
        selected: {
          ...state.selected,
          covers: action.index,
          songs: action.index,
        },
        overlay: state.overlay === "scrub" ? null : state.overlay,
        scrubAt: null,
        seekPending: false,
        seeking: 0 as const,
        touching: false,
      };
      return { state: cleared, effects: [] };
    }

    case "overlayExpired":
      if (action.stamp !== state.overlayStamp || state.touching) {
        return unchanged;
      }
      return clearScrub(state);

    case "commitSeek":
      if (!state.seekPending || state.scrubAt === null) return unchanged;
      return {
        state: { ...state, seekPending: false },
        effects: [{ type: "seek", seconds: state.scrubAt }],
      };

    case "lockExpired":
      if (action.stamp !== state.lockStamp) return unchanged;
      return { state: { ...state, lockShown: false }, effects: [] };
  }
}
