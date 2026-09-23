import { type KeyboardEvent, useEffect, useRef } from "react";

import type { Music } from "../use-music";
import { ClickWheel } from "./click-wheel";
import { DragHandle } from "./drag-handle";
import { FaceButtons } from "./face-buttons";
import { HoldSwitch } from "./hold-switch";
import { menuItems, screenTitles } from "./menu";
import { CoverFlow } from "./screen/cover-flow";
import { MenuPreview } from "./screen/menu-preview";
import { NowPlaying } from "./screen/now-playing";
import { PodList } from "./screen/pod-list";
import { PodScreen } from "./screen/pod-screen";
import { useBattery } from "./use-battery";
import type { Pod } from "./use-pod";
import { useScrollSteps } from "./use-scroll-steps";

/**
 * The full music player, after the classic pocket players: a colour touch
 * screen with menus, a click wheel that drives them too, a hold switch and
 * the widget's minimize and close in the top margin, and a grip at the
 * bottom for moving it. It only draws; what every
 * control does lives in `usePod`, which the widget owns.
 *
 * Keyboard: the wheel's buttons are ordinary buttons (Enter on the centre
 * chooses, on Menu goes back). With focus anywhere in the player, ↑ and ↓
 * turn the wheel (← and → too in Cover Flow, whose covers run sideways),
 * and Escape goes back.
 */
export function PocketPlayer({
  canMinimize,
  chromeVisible,
  covered,
  movable,
  music,
  onClose,
  onMinimize,
  pod,
  progress,
}: {
  canMinimize: boolean;
  /** Whether the gallery's controls are showing; the face buttons follow. */
  chromeVisible: boolean;
  /** The video lies over the display. */
  covered: boolean;
  /** Whether it can be dragged around the page, by its handle. */
  movable: boolean;
  music: Music;
  onClose: () => void;
  onMinimize: () => void;
  pod: Pod;
  progress: { current: number; duration: number };
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const battery = useBattery();
  const { controls, state } = pod;
  const { screen } = state;
  useScrollSteps(rootRef, controls.step);

  // Opening the player lights its screen.
  const { wake } = pod;
  useEffect(() => wake(), [wake]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      controls.back();
      return;
    }
    const sideways = screen === "covers";
    const steps: Record<string, number | undefined> = {
      ArrowDown: 1,
      ArrowUp: -1,
      ArrowRight: sideways ? 1 : undefined,
      ArrowLeft: sideways ? -1 : undefined,
    };
    const step = steps[event.key];
    if (step === undefined) return;
    // Handled here, so the gallery's own arrow keys leave it alone.
    event.preventDefault();
    controls.step(step);
  };

  const renderScreen = () => {
    if (screen === "now") {
      return (
        <NowPlaying
          count={music.playlist.length}
          current={state.scrubAt ?? progress.current}
          duration={progress.duration}
          index={music.index}
          loading={music.status === "loading"}
          mode={music.mode}
          onSeek={controls.scrubTo}
          onVolume={controls.volumeTo}
          overlay={state.overlay}
          track={music.track}
          volume={music.volume}
        />
      );
    }
    if (screen === "covers") {
      return (
        <CoverFlow
          current={music.index}
          onPick={(index) => controls.pick("covers", index)}
          onStep={controls.step}
          selected={state.selected.covers}
          tracks={music.playlist}
        />
      );
    }
    const list = (
      <PodList
        label={screenTitles[screen]}
        onHover={(index) => controls.hover(screen, index)}
        onPick={(index) => controls.pick(screen, index)}
        rows={pod.rows[screen]}
        selected={state.selected[screen]}
      />
    );
    if (screen !== "menu") return list;
    return (
      <div className="flex h-full">
        <div className="w-[56%]">{list}</div>
        <div className="flex-1">
          <MenuPreview
            index={music.index}
            item={menuItems[state.selected.menu]}
            playlist={music.playlist}
          />
        </div>
      </div>
    );
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: arrow keys turn the wheel for whichever part of the player has focus
    <div
      className="relative flex flex-col items-center"
      onKeyDown={handleKeyDown}
      onPointerDownCapture={pod.wake}
      ref={rootRef}
    >
      <HoldSwitch held={state.held} onToggle={controls.toggleHold} />
      <FaceButtons
        canMinimize={canMinimize}
        onClose={onClose}
        onMinimize={onMinimize}
        visible={chromeVisible}
      />
      <PodScreen
        battery={battery}
        covered={covered}
        description={pod.description}
        direction={state.direction}
        held={state.held}
        lit={pod.lit}
        lockShown={state.lockShown}
        onBack={pod.canGoBack ? controls.back : undefined}
        onWake={pod.wake}
        screen={screen}
        state={
          music.status === "playing"
            ? "playing"
            : music.status === "paused"
              ? "paused"
              : "none"
        }
      >
        {renderScreen()}
      </PodScreen>
      <div className="mt-[22px]">
        <ClickWheel
          onMenu={controls.back}
          onNext={controls.next}
          onPlayPause={controls.playPause}
          onPrevious={controls.previous}
          onSelect={controls.select}
          onStep={controls.step}
          playing={music.status === "playing"}
        />
      </div>
      {movable ? <DragHandle /> : null}
    </div>
  );
}
