import type { CSSProperties, ReactNode } from "react";

import { cx } from "../../../lib/class-names";
import { cue } from "../../../lib/sounds";
import { ControlButton, focusRing } from "../control-button";
import {
  ClickIcon,
  MusicNoteIcon,
  SoundOffIcon,
  SoundOnIcon,
  VideoIcon,
} from "../icons";
import type { Music } from "../music";
import { Popover } from "../popover";
import { Swap } from "../swap";
import { SwitchTrack } from "../switch";
import type { SoundMix } from "./use-sound-mix";

/**
 * One sound channel: an icon, its name and what it covers, a switch for
 * whether it is heard, and a slider for how loud. Moving the slider of a
 * channel that is off turns it on, as turning a volume knob would.
 */
function Channel({
  detail,
  detailLang,
  icon,
  label,
  on,
  onToggle,
  onVolume,
  onVolumeSettled,
  shortcut,
  volume,
}: {
  detail: string;
  detailLang?: string;
  icon: ReactNode;
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  onVolume: (volume: number) => void;
  /** Runs when a drag or key press on the slider ends. */
  onVolumeSettled?: () => void;
  shortcut?: string;
  volume: number;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-200",
            on ? "bg-paper/12 text-paper" : "bg-paper/5 text-paper/40",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-paper/90">{label}</span>
          <span
            className="mt-0.5 block truncate text-[10px] text-paper/45"
            lang={detailLang}
          >
            {detail}
          </span>
        </span>
        <button
          aria-checked={on}
          aria-keyshortcuts={shortcut}
          aria-label={`${label} sound`}
          className={cx("cursor-pointer rounded-full", focusRing)}
          onClick={() => onToggle(!on)}
          role="switch"
          title={shortcut ? `${label} sound (${shortcut})` : `${label} sound`}
          type="button"
        >
          <SwitchTrack checked={on} />
        </button>
      </div>
      <input
        aria-label={`${label} volume`}
        className={cx(
          "range mt-2 w-[calc(100%-44px)] translate-x-11 transition-opacity duration-200",
          !on && "opacity-40",
        )}
        max={100}
        min={0}
        onChange={(event) => onVolume(Number(event.target.value))}
        onKeyUp={onVolumeSettled}
        onPointerUp={onVolumeSettled}
        step={1}
        style={{ "--value": `${volume}%` } as CSSProperties}
        type="range"
        value={volume}
      />
    </div>
  );
}

/**
 * The dock's sound button and its mixer: videos, music, and interface
 * sounds, each with its own switch and level, independent of the others.
 * The button shows a muted speaker only when nothing can be heard.
 */
export function SoundMenu({
  mix,
  music,
  onOpenChange,
  open,
}: {
  mix: SoundMix;
  music: Music;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const musicHeard =
    music.status === "playing" && !music.muted && music.volume > 0;
  const interfaceHeard =
    mix.interface.supported && mix.interface.on && mix.interface.volume > 0;
  const videosHeard = mix.videos.on && mix.videos.volume > 0;
  const silent = !videosHeard && !musicHeard && !interfaceHeard;

  const toggle = (on: boolean, apply: (on: boolean) => void) => {
    cue(on ? "switchOn" : "switchOff");
    apply(on);
  };

  return (
    <Popover
      className="w-[min(300px,calc(100vw-24px))]"
      kind="dialog"
      label="Sound"
      onOpenChange={onOpenChange}
      open={open}
      placement="top-end"
      trigger={(props) => (
        <ControlButton
          {...props}
          className={open ? "bg-paper/12 text-paper" : undefined}
          label="Sound"
        >
          <Swap id={silent ? "silent" : "sound"}>
            {silent ? <SoundOffIcon /> : <SoundOnIcon />}
          </Swap>
        </ControlButton>
      )}
    >
      <p className="label px-3 pt-3 pb-1 text-paper/40">Sound</p>
      <Channel
        detail="Live Photos and videos"
        icon={<VideoIcon size={16} />}
        label="Videos"
        on={mix.videos.on}
        onToggle={(on) => toggle(on, mix.videos.setOn)}
        onVolume={(volume) => {
          mix.videos.setVolume(volume);
          if (!mix.videos.on) mix.videos.setOn(true);
        }}
        shortcut="M"
        volume={mix.videos.volume}
      />
      <div aria-hidden="true" className="mx-3 h-px bg-paper/8" />
      <Channel
        detail={
          music.status === "idle"
            ? "Not playing"
            : `${music.track.title} · ${music.track.artist}`
        }
        detailLang="zh"
        icon={<MusicNoteIcon size={16} />}
        label="Music"
        on={!music.muted}
        onToggle={(on) => toggle(on, (heard) => music.setMuted(!heard))}
        onVolume={music.setVolume}
        volume={music.volume}
      />
      {mix.interface.supported ? (
        <>
          <div aria-hidden="true" className="mx-3 h-px bg-paper/8" />
          <Channel
            detail="Clicks and chimes"
            icon={<ClickIcon size={16} />}
            label="Interface"
            on={mix.interface.on}
            onToggle={mix.interface.setOn}
            onVolume={(volume) => {
              mix.interface.setVolume(volume);
              if (!mix.interface.on) mix.interface.setOn(true);
            }}
            // A click at the new level, so it can be judged by ear.
            onVolumeSettled={() => cue("press")}
            volume={mix.interface.volume}
          />
        </>
      ) : null}
    </Popover>
  );
}
