import { cx } from "../../../lib/class-names";
import { cue } from "../../../lib/sounds";
import { focusRing } from "../control-button";
import { PocketPlayerIcon } from "../icons";
import type { Music, MusicStatus } from "./use-music";

/** What the button says, besides the song, while the music cannot play. */
const troubles: Partial<Record<MusicStatus, string>> = {
  loading: "Loading",
  blocked: "Tap the video",
  error: "Unavailable",
};

/**
 * The top-bar switch: starts the music, which brings out the pocket player,
 * then pauses and resumes it. It is only an icon, the player with the
 * music's bars on its screen, since the player is more than music now; its
 * label and tooltip say what a press does.
 */
export function MusicButton({ music }: { music: Music }) {
  const playing = music.status === "playing";
  const { title } = music.track;
  const trouble = troubles[music.status];
  const label =
    music.status === "idle"
      ? `Play background music: ${title}`
      : trouble
        ? `${trouble}: ${title}`
        : playing
          ? `Pause ${title}`
          : `Play ${title}`;

  return (
    <button
      aria-label={label}
      aria-pressed={music.status === "idle" ? undefined : playing}
      className={cx(
        "glass flex h-10 cursor-pointer items-center rounded-full px-3 transition-[color,background-color] duration-200 hover:bg-night/70 hover:text-paper",
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
    </button>
  );
}
