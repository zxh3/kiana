import { cx } from "../../../lib/class-names";
import { cue } from "../../../lib/sounds";
import { focusRing } from "../control-button";
import { PocketPlayerIcon } from "../icons";
import type { Music, MusicStatus } from "./use-music";

const statusLabels: Record<MusicStatus, string> = {
  idle: "Music",
  loading: "Loading",
  playing: "Playing",
  paused: "Paused",
  blocked: "Tap the video",
  error: "Unavailable",
};
/**
 * The top-bar switch: starts the music, which brings out the pocket player,
 * then pauses and resumes it. Its icon is the player, with the music's bars
 * on its screen.
 */
export function MusicButton({ music }: { music: Music }) {
  const playing = music.status === "playing";
  const label =
    music.status === "idle"
      ? `Play background music: ${music.track.title}`
      : playing
        ? `Pause ${music.track.title}`
        : `Play ${music.track.title}`;

  return (
    <button
      aria-label={label}
      aria-pressed={music.status === "idle" ? undefined : playing}
      className={cx(
        "glass flex h-10 cursor-pointer items-center gap-2 rounded-full px-3 transition-[color,background-color] duration-200 hover:bg-night/70 hover:text-paper sm:pr-4 sm:pl-3.5",
        playing ? "text-paper" : "text-paper/85",
        focusRing,
      )}
      onClick={() => {
        cue("press");
        music.toggle();
      }}
      onFocus={music.preload}
      onPointerEnter={music.preload}
      title={label}
      type="button"
    >
      <PocketPlayerIcon
        bars={music.status !== "idle"}
        playing={playing}
        size={20}
      />
      <span className="label max-sm:sr-only">{statusLabels[music.status]}</span>
    </button>
  );
}
