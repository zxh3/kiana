import { cx } from "../../../lib/class-names";
import { focusRing } from "../control-button";
import { ExternalIcon } from "../icons";
import { trackUrl } from "./music-track";
import type { Music } from "./use-music";

/** What to do when YouTube needs a tap, or will not play here at all. */
export function MusicNotice({ music, width }: { music: Music; width: number }) {
  if (music.status === "blocked") {
    return (
      <p
        className="glass mt-2 rounded-[16px] px-3.5 py-2.5 text-[11px] leading-snug text-paper/75"
        style={{ width }}
      >
        Your browser needs a tap on the video to start the sound.
      </p>
    );
  }
  if (music.status !== "error") return null;
  return (
    <div
      className="glass mt-2 rounded-[18px] p-3.5 text-paper"
      style={{ width }}
    >
      <p className="text-[11px] leading-snug text-paper/70">
        YouTube wouldn’t play the playlist here. If it asks you to sign in, sign
        in on youtube.com in this browser, then try again.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className={cx(
            "label cursor-pointer rounded-full bg-paper px-3.5 py-2.5 text-ink transition-colors hover:bg-white",
            focusRing,
          )}
          onClick={music.start}
          type="button"
        >
          Try again
        </button>
        <a
          className={cx(
            "label flex items-center gap-1.5 rounded-full border border-paper/15 px-3.5 py-2.5 text-paper/75 transition-colors hover:border-paper/40 hover:text-paper",
            focusRing,
          )}
          href={trackUrl(music.track)}
          rel="noreferrer"
          target="_blank"
        >
          Open on YouTube
          <ExternalIcon size={12} />
        </a>
      </div>
    </div>
  );
}
