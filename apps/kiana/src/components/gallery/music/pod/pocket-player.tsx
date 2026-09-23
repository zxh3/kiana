import { type KeyboardEvent, useRef } from "react";

import type { Music } from "../use-music";
import { ClickWheel } from "./click-wheel";
import { HoldSwitch } from "./hold-switch";
import { screenTitles } from "./menu";
import { CoverFlow } from "./screen/cover-flow";
import { MenuPreview } from "./screen/menu-preview";
import { NowPlaying } from "./screen/now-playing";
import { PodList } from "./screen/pod-list";
import { PodScreen } from "./screen/pod-screen";
import type { PodSettings } from "./settings";
import { useBattery } from "./use-battery";
import { usePod } from "./use-pod";
import { useScrollSteps } from "./use-scroll-steps";

/**
 * The full music player, after the classic pocket players: a colour screen
 * with menus, a click wheel to drive them, and a hold switch on top. It
 * fills the space the player's body gives it; the YouTube frame sits over
 * the display when the video is on.
 */
export function PocketPlayer({
  music,
  onVideoChange,
  progress,
  settings,
  videoOn,
}: {
  music: Music;
  onVideoChange: (on: boolean) => void;
  progress: { current: number; duration: number };
  settings: PodSettings;
  videoOn: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const battery = useBattery();
  const pod = usePod({ music, onVideoChange, progress, settings, videoOn });
  const { controls, screen } = pod;
  useScrollSteps(rootRef, controls.step);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    pod.wake();
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    controls.step(event.key === "ArrowDown" ? 1 : -1);
  };

  const renderScreen = () => {
    if (screen === "now") {
      return (
        <NowPlaying
          count={music.playlist.length}
          current={pod.scrubAt ?? progress.current}
          duration={progress.duration}
          index={music.index}
          loading={music.status === "loading"}
          mode={music.mode}
          overlay={pod.overlay}
          track={music.track}
          volume={music.volume}
        />
      );
    }
    if (screen === "covers") {
      return (
        <CoverFlow
          current={music.index}
          onPick={controls.pickCover}
          selected={pod.selected.covers}
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
        selected={pod.selected[screen]}
      />
    );
    if (screen !== "menu") return list;
    return (
      <div className="flex h-full">
        <div className="w-[56%]">{list}</div>
        <div className="flex-1">
          <MenuPreview track={music.track} />
        </div>
      </div>
    );
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: arrow keys turn the wheel for whichever control inside has focus
    <div
      className="relative flex flex-col items-center"
      onKeyDown={handleKeyDown}
      onPointerDownCapture={pod.wake}
      ref={rootRef}
    >
      <HoldSwitch held={pod.held} onToggle={pod.toggleHold} />
      <PodScreen
        battery={battery}
        direction={pod.direction}
        held={pod.held}
        lit={pod.lit}
        lockShown={pod.lockShown}
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
    </div>
  );
}
