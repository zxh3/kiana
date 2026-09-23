import type { ReactNode } from "react";

import { cx } from "../../lib/class-names";
import { ControlButton, focusRing } from "./control-button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CollapseIcon,
  ExpandIcon,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  ShareIcon,
  SoundOffIcon,
  SoundOnIcon,
} from "./icons";
import { Swap } from "./swap";
import type { ChromeHoldProps } from "./use-chrome-hold";

function Divider() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 h-5 w-px bg-paper/12 max-sm:mx-0.5"
    />
  );
}

export function Dock({
  canGoBack,
  favorite,
  fullscreen,
  holdProps,
  muted,
  onNext,
  onPrevious,
  onShare,
  onToggleFavorite,
  onToggleFullscreen,
  onToggleMute,
  onTogglePause,
  paused,
  settings,
  visible,
}: {
  canGoBack: boolean;
  favorite: boolean;
  fullscreen: { active: boolean; supported: boolean };
  holdProps: ChromeHoldProps;
  muted: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
  onToggleFullscreen: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  paused: boolean;
  settings: ReactNode;
  visible: boolean;
}) {
  return (
    <div
      className={cx(
        "pointer-events-none absolute inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-20 flex justify-center px-2 transition-[opacity,translate] duration-500 ease-soft sm:bottom-6",
        visible ? "opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      {/* The frosted layer is a sibling so menus inside keep their own blur. */}
      <div
        aria-label="Slideshow controls"
        className={cx(
          "relative isolate flex items-center gap-0.5 rounded-full p-1.5 sm:gap-1",
          visible && "pointer-events-auto",
        )}
        role="toolbar"
        {...holdProps}
      >
        <span
          aria-hidden="true"
          className="glass absolute inset-0 -z-10 rounded-full"
        />

        <ControlButton
          aria-pressed={favorite}
          className={favorite ? "text-rose hover:text-rose" : undefined}
          label={favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={onToggleFavorite}
          shortcut="L"
        >
          <span
            className={cx("grid", favorite && "animate-heart-pop")}
            key={favorite ? "on" : "off"}
          >
            <HeartIcon filled={favorite} />
          </span>
        </ControlButton>
        <ControlButton
          label="Share a link to this photo"
          onClick={onShare}
          shortcut="S"
        >
          <ShareIcon />
        </ControlButton>

        <Divider />

        <ControlButton
          disabled={!canGoBack}
          label="Previous"
          onClick={onPrevious}
          shortcut="ArrowLeft"
        >
          <ChevronLeftIcon />
        </ControlButton>
        <button
          aria-keyshortcuts="Space"
          aria-label={paused ? "Play" : "Pause"}
          className={cx(
            "mx-0.5 grid size-11 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-full bg-paper text-ink shadow-[0_6px_20px_-8px_rgba(0,0,0,.6)] transition-[background-color,scale] duration-200 ease-soft hover:bg-white active:scale-92",
            focusRing,
          )}
          onClick={onTogglePause}
          title={`${paused ? "Play" : "Pause"} (Space)`}
          type="button"
        >
          <Swap id={paused ? "play" : "pause"}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </Swap>
        </button>
        <ControlButton label="Next" onClick={onNext} shortcut="ArrowRight">
          <ChevronRightIcon />
        </ControlButton>

        <Divider />

        <ControlButton
          aria-pressed={!muted}
          label={muted ? "Turn sound on" : "Turn sound off"}
          onClick={onToggleMute}
          shortcut="M"
        >
          <Swap id={muted ? "muted" : "sound"}>
            {muted ? <SoundOffIcon /> : <SoundOnIcon />}
          </Swap>
        </ControlButton>
        {fullscreen.supported ? (
          <ControlButton
            aria-pressed={fullscreen.active}
            label={fullscreen.active ? "Exit full screen" : "Full screen"}
            onClick={onToggleFullscreen}
            shortcut="F"
          >
            <Swap id={fullscreen.active ? "collapse" : "expand"}>
              {fullscreen.active ? <CollapseIcon /> : <ExpandIcon />}
            </Swap>
          </ControlButton>
        ) : null}
        {settings}
      </div>
    </div>
  );
}
