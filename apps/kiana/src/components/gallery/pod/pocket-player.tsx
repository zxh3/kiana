import { type KeyboardEvent, useEffect, useRef } from "react";

import type { Music } from "../music/use-music";
import { ChatName } from "./apps/chat/chat-name";
import { ChatRoom } from "./apps/chat/chat-room";
import { KianaMuyu } from "./apps/muyu/kiana-muyu";
import { FingerSpinner } from "./apps/spinner/finger-spinner";
import { ClickWheel } from "./device/click-wheel";
import { DragHandle } from "./device/drag-handle";
import { FaceButtons } from "./device/face-buttons";
import { HoldSwitch } from "./device/hold-switch";
import { menuItems, screens } from "./menu";
import { CoverFlow } from "./screen/cover-flow";
import { MenuPreview } from "./screen/menu-preview";
import { NowPlaying } from "./screen/now-playing";
import { PodList } from "./screen/pod-list";
import { PodScreen } from "./screen/pod-screen";
import { useBattery } from "./use-battery";
import type { Pod } from "./use-pod";
import { useScrollSteps } from "./use-scroll-steps";

/**
 * The full player, after the classic pocket players: a colour touch screen
 * with menus, the music, and little apps, a click wheel that drives them, a hold switch and
 * the widget's minimize and close in the top margin, and a grip at the
 * bottom for moving it. It only draws; what every
 * control does lives in `usePod`, which the widget owns.
 *
 * Keyboard: the wheel's buttons are ordinary buttons (Enter on the centre
 * chooses, on Menu goes back). With focus anywhere in the player, ↑ and ↓
 * turn the wheel (← and → too in Cover Flow, whose covers run sideways),
 * and Escape goes back. In Chat's text fields the keys type.
 */
export function PocketPlayer({
  active,
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
  /** The full player is the one showing; it stays mounted when minimized. */
  active: boolean;
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
  useEffect(() => {
    if (active) wake();
  }, [active, wake]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      controls.back();
      return;
    }
    // In Chat's text fields the keys type, and keep the screen lit.
    if (event.target instanceof HTMLInputElement) {
      wake();
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
          onSeek={controls.scrubTo}
          onShowVideo={controls.toggleVideo}
          onVolume={controls.volumeTo}
          overlay={state.overlay}
          repeat={music.repeat}
          shuffle={music.shuffle}
          track={music.track}
          volume={music.volume}
        />
      );
    }
    if (screen === "spinner") {
      return (
        <FingerSpinner
          flicks={state.wheel.presses}
          looks={pod.looks}
          onFlick={controls.select}
          onStep={controls.step}
          steps={state.wheel.steps}
        />
      );
    }
    if (screen === "muyu") {
      return <KianaMuyu muyu={pod.muyu} onPat={controls.select} />;
    }
    if (screen === "chat") {
      return (
        <ChatRoom
          chat={pod.chat}
          onSay={controls.say}
          onShowOnline={controls.select}
          steps={state.wheel.steps}
        />
      );
    }
    if (screen === "name") {
      return (
        <ChatName
          name={pod.chat.name}
          onSave={controls.saveName}
          saves={state.wheel.presses}
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
        label={screens[screen].title}
        onHover={(index) => controls.hover(screen, index)}
        onPick={(index) => controls.pick(screen, index)}
        onStep={controls.step}
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
            looks={pod.looks}
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
        asleep={state.asleep}
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
          onHoldEnd={controls.holdEnd}
          onHoldStart={controls.holdStart}
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
