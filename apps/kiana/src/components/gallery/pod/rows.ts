import type { ChatMessage, Person } from "../../../lib/chat";
import type { AccountStatus, PodAccount } from "../account";
import type { Repeat } from "../music/music-queue";
import type { Track } from "../music/music-track";
import type { ChatStatus } from "./apps/chat/chat";
import {
  type KianaFace,
  kianaFaceLabels,
  type SpinnerStyle,
  spinnerStyleLabels,
} from "./apps/spinner/spinner";
import { type Finish, finishLabels } from "./device/finishes";
import { formatPodTime } from "./format";
import type { PodState } from "./machine";
import {
  accountItems,
  accountLabels,
  appItems,
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

export type PodRow = {
  key: string;
  label: string;
  /** A setting's current value, written on the right. */
  detail?: string;
  /** Opens another screen. */
  opens?: boolean;
  /** The song that is playing. */
  current?: boolean;
  /** Someone signed in with Google, marked beside their name. */
  verified?: boolean;
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
  account: PodAccount;
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

/** How Settings sums up the account: who is signed in, if anyone. */
const accountDetails: Record<Exclude<AccountStatus, "member">, string> = {
  checking: "…",
  unavailable: "Off",
  guest: "Guest",
};

/** The rows of each list screen. */
export function podRows(view: PodView): Record<ListScreen, PodRow[]> {
  const { member, status } = view.account;
  const details: Record<(typeof settingsItems)[number], string> = {
    shuffle: view.shuffle ? "On" : "Off",
    repeat: view.repeat === "one" ? "One" : "All",
    backlight: backlightLabels[view.backlight],
    clicker: view.clicker ? "On" : "Off",
    finish: finishLabels[view.finish],
    spinner: spinnerStyleLabels[view.spinner],
    face: kianaFaceLabels[view.face],
    account:
      status === "member"
        ? member?.name || "Signed In"
        : accountDetails[status],
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
      label: screenTitles[item],
      lang: appLangs[item],
      opens: true,
    })),
    // The viewer first, whose row opens Your Name unless they go by their
    // Google account's, then everyone else.
    online: [
      {
        key: "you",
        label: view.chat.name,
        detail: "You",
        opens: status !== "member",
        verified: status === "member",
      },
      ...view.chat.others.map((person) => ({
        key: person.id,
        label: person.name,
        verified: person.verified,
      })),
    ],
    settings: settingsItems.map((item) => ({
      key: item,
      label: settingsLabels[item],
      detail: details[item],
      opens: item === "account",
    })),
    account: accountItems(status).map((item) =>
      item === "member"
        ? {
            key: item,
            label: member?.name || "Signed In",
            detail: "Google",
            verified: true,
          }
        : { key: item, label: accountLabels[item] },
    ),
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
  if (!row) return screenTitles[state.screen];
  return [row.label, row.verified && "verified", row.detail]
    .filter(Boolean)
    .join(", ");
}
