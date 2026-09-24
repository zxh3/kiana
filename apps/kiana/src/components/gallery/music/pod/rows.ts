import type { ChatMessage, Person } from "../../../../lib/chat";
import type { Repeat } from "../music-queue";
import type { Track } from "../music-track";
import type { ChatStatus } from "./chat";
import { type Finish, finishLabels } from "./finishes";
import { formatPodTime } from "./format";
import type { PodState } from "./machine";
import {
  appItems,
  appLabels,
  appLangs,
  type ListScreen,
  menuItems,
  menuLabels,
  menuOpens,
  screenTitles,
  settingsItems,
  settingsLabels,
} from "./menu";
import { type Backlight, backlightLabels } from "./settings";
import {
  type KianaFace,
  kianaFaceLabels,
  type SpinnerStyle,
  spinnerStyleLabels,
} from "./spinner";

export type PodRow = {
  key: string;
  label: string;
  /** A setting's current value, written on the right. */
  detail?: string;
  /** Opens another screen. */
  opens?: boolean;
  /** The song that is playing. */
  current?: boolean;
  lang?: string;
};

/** Everything the rows and the spoken description are drawn from. */
export type PodView = {
  playlist: ReadonlyArray<Track>;
  index: number;
  shuffle: boolean;
  repeat: Repeat;
  backlight: Backlight;
  clicker: boolean;
  finish: Finish;
  spinner: SpinnerStyle;
  face: KianaFace;
  /** The Chat Room: the viewer's name, and everyone else who is here. */
  chat: {
    name: string;
    status: ChatStatus;
    others: ReadonlyArray<Person>;
    last: ChatMessage | undefined;
  };
  videoOpen: boolean;
  volume: number;
  current: number;
  duration: number;
};

/** The rows of each list screen. */
export function podRows(view: PodView): Record<ListScreen, PodRow[]> {
  const details: Record<(typeof settingsItems)[number], string> = {
    shuffle: view.shuffle ? "On" : "Off",
    repeat: view.repeat === "one" ? "One" : "All",
    backlight: backlightLabels[view.backlight],
    clicker: view.clicker ? "On" : "Off",
    finish: finishLabels[view.finish],
    spinner: spinnerStyleLabels[view.spinner],
    face: kianaFaceLabels[view.face],
  };
  return {
    menu: menuItems.map((item) => ({
      key: item,
      label: menuLabels[item],
      opens: menuOpens[item],
    })),
    songs: view.playlist.map((song, position) => ({
      key: song.videoId,
      label: song.title,
      current: position === view.index,
      lang: "zh",
    })),
    apps: appItems.map((item) => ({
      key: item,
      label: appLabels[item],
      lang: appLangs[item],
      opens: true,
    })),
    // The viewer first, whose row opens Your Name, then everyone else.
    online: [
      { key: "you", label: view.chat.name, detail: "You", opens: true },
      ...view.chat.others.map((person) => ({
        key: person.id,
        label: person.name,
      })),
    ],
    settings: settingsItems.map((item) => ({
      key: item,
      label: settingsLabels[item],
      detail: details[item],
    })),
  };
}

/**
 * What the screen shows, in words, for a screen reader: the highlighted
 * row or cover, or the song, the volume, or the scrubber's position.
 */
export function describePod(
  state: PodState,
  rows: Record<ListScreen, PodRow[]>,
  view: PodView,
) {
  if (state.asleep) return "Asleep";
  if (state.screen === "now") {
    if (view.videoOpen) {
      const track = view.playlist[view.index];
      return `Showing the video: ${track.title}`;
    }
    if (state.overlay === "volume") return `Volume ${view.volume}%`;
    if (state.overlay === "scrub") {
      return `Position ${formatPodTime(state.scrubAt ?? view.current)} of ${formatPodTime(view.duration)}`;
    }
    const track = view.playlist[view.index];
    return `${screenTitles.now}: ${track.title}, ${track.artist}`;
  }
  if (state.screen === "muyu") {
    return `${screenTitles.muyu}: press the centre button to pat Kiana's head`;
  }
  if (state.screen === "spinner") {
    return `${screenTitles.spinner}: turn the wheel to spin it, or press the centre button to flick it`;
  }
  if (state.screen === "chat") {
    const { status, others, last } = view.chat;
    if (status !== "open") return `${screenTitles.chat}: connecting`;
    const here = `${screenTitles.chat}, ${others.length + 1} online`;
    return last ? `${here}. ${last.name}: ${last.text}` : here;
  }
  if (state.screen === "name") {
    return `${screenTitles.name}: type a name, then press Enter to save it`;
  }
  if (state.screen === "covers") {
    const track = view.playlist[state.selected.covers];
    return `${track.title}, ${track.artist}`;
  }
  const row = rows[state.screen][state.selected[state.screen]];
  return row.detail ? `${row.label}, ${row.detail}` : row.label;
}
