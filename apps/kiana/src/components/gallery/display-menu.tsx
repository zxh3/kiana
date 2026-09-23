import { motion } from "motion/react";
import type { ReactNode } from "react";

import { cx } from "../../lib/class-names";
import { springs } from "../../lib/motion";
import { ControlButton, focusRing } from "./control-button";
import { KeyboardIcon, SlidersIcon } from "./icons";
import {
  type Duration,
  durations,
  type Frame,
  formatDurationLabel,
  frameLabels,
  frames,
  type Order,
  orderLabels,
  orders,
} from "./model";
import { Popover } from "./popover";

/** A tiny drawing of each frame so the choice is visual, not just a word. */
function FramePreview({ frame }: { frame: Frame }) {
  const photo =
    "bg-[linear-gradient(135deg,#8d7a68_0%,#c9b49c_45%,#5d5147_100%)]";
  if (frame === "fill") {
    return <span className={cx("absolute inset-0", photo)} />;
  }
  if (frame === "backdrop") {
    return (
      <span className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#3b322b,#6b5b4d)]">
        <span
          className={cx(
            "h-[62%] w-[40%] shadow-[0_6px_10px_-4px_rgba(0,0,0,.8)]",
            photo,
          )}
        />
      </span>
    );
  }
  return (
    <span className="absolute inset-0 grid place-items-center bg-mat">
      <span className="grid h-[70%] w-[48%] place-items-center bg-paper shadow-[0_3px_8px_-3px_rgba(23,18,15,.5)]">
        <span className={cx("h-[76%] w-[74%]", photo)} />
      </span>
    </span>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <fieldset className="min-w-0 px-2 pt-3 pb-2">
      <legend className="label float-left mb-2.5 w-full px-1 text-paper/40">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Segmented<T extends string | number>({
  id,
  onPick,
  options,
  render,
  value,
}: {
  /** Names the sliding highlight, unique per control. */
  id: string;
  onPick: (value: T) => void;
  options: ReadonlyArray<T>;
  render: (value: T) => string;
  value: T;
}) {
  return (
    <div className="clear-both flex gap-1 rounded-full bg-paper/6 p-1">
      {options.map((option) => (
        <button
          aria-pressed={option === value}
          className={cx(
            "relative isolate flex-1 cursor-pointer rounded-full px-2 py-2 text-[11px] tracking-[.06em] transition-colors duration-150",
            option === value ? "text-ink" : "text-paper/65 hover:text-paper",
            focusRing,
            "focus-visible:ring-offset-0",
          )}
          key={option}
          onClick={() => onPick(option)}
          type="button"
        >
          {option === value ? (
            <motion.span
              className="absolute inset-0 -z-10 rounded-full bg-paper"
              layoutId={id}
              transition={springs.snappy}
            />
          ) : null}
          {render(option)}
        </button>
      ))}
    </div>
  );
}

function Switch({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      className={cx(
        "flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-paper/6",
        focusRing,
        "focus-visible:ring-offset-0",
      )}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className="flex-1">
        <span className="block text-[12px] text-paper/90">{label}</span>
        <span className="mt-1 block text-[10px] leading-snug text-paper/45">
          {description}
        </span>
      </span>
      <span
        className={cx(
          "relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-paper" : "bg-paper/18",
        )}
      >
        <span
          className={cx(
            "absolute top-[3px] left-[3px] size-4 rounded-full shadow-sm transition-[translate,background-color] duration-200 ease-soft",
            checked ? "translate-x-4 bg-ink" : "bg-paper",
          )}
        />
      </span>
    </button>
  );
}

export function DisplayMenu({
  duration,
  frame,
  keepAwake,
  uiSounds,
  onDurationChange,
  onFrameChange,
  onKeepAwakeChange,
  onUiSoundsChange,
  onOpenChange,
  onOpenHelp,
  onOrderChange,
  open,
  order,
}: {
  duration: Duration;
  frame: Frame;
  keepAwake: boolean | null;
  /** Null where the browser cannot play generated sound. */
  uiSounds: boolean | null;
  onDurationChange: (duration: Duration) => void;
  onFrameChange: (frame: Frame) => void;
  onKeepAwakeChange: (keepAwake: boolean) => void;
  onUiSoundsChange: (uiSounds: boolean) => void;
  onOpenChange: (open: boolean) => void;
  onOpenHelp: () => void;
  onOrderChange: (order: Order) => void;
  open: boolean;
  order: Order;
}) {
  return (
    <Popover
      className="w-[min(320px,calc(100vw-24px))]"
      kind="dialog"
      label="Slideshow settings"
      onOpenChange={onOpenChange}
      open={open}
      placement="top-end"
      trigger={(props) => (
        <ControlButton
          {...props}
          className={open ? "bg-paper/12 text-paper" : undefined}
          label="Slideshow settings"
        >
          <SlidersIcon />
        </ControlButton>
      )}
    >
      <Section title="Frame">
        <div className="clear-both grid grid-cols-3 gap-2">
          {frames.map((option, index) => (
            <button
              aria-pressed={option === frame}
              aria-keyshortcuts={String(index + 1)}
              className={cx(
                "group cursor-pointer rounded-[14px] p-1.5 text-center transition-colors duration-150",
                option === frame ? "bg-paper/12" : "hover:bg-paper/6",
                focusRing,
                "focus-visible:ring-offset-0",
              )}
              key={option}
              onClick={() => onFrameChange(option)}
              title={`${frameLabels[option]} (${index + 1})`}
              type="button"
            >
              <span className="relative block">
                <span className="relative block aspect-[3/2] overflow-hidden rounded-[9px] ring-1 ring-paper/10 transition-shadow group-hover:ring-paper/25">
                  <FramePreview frame={option} />
                </span>
                {/* The chosen frame's outline moves between the previews. */}
                {option === frame ? (
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-[9px] ring-[1.5px] ring-paper/85"
                    layoutId="settings-frame"
                    transition={springs.snappy}
                  />
                ) : null}
              </span>
              <span
                className={cx(
                  "mt-2 block text-[10px] tracking-[.12em] uppercase",
                  option === frame ? "text-paper" : "text-paper/55",
                )}
              >
                {frameLabels[option]}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Each photo stays">
        <Segmented
          id="settings-duration"
          onPick={onDurationChange}
          options={durations}
          render={formatDurationLabel}
          value={duration}
        />
      </Section>

      <Section title="Order">
        <Segmented
          id="settings-order"
          onPick={onOrderChange}
          options={orders}
          render={(value) => orderLabels[value]}
          value={order}
        />
      </Section>

      {uiSounds !== null ? (
        <div className="px-1">
          <Switch
            checked={uiSounds}
            description="Soft clicks and chimes when you use the controls."
            label="Interface sounds"
            onChange={onUiSoundsChange}
          />
        </div>
      ) : null}
      {keepAwake !== null ? (
        <div className="px-1 pb-1">
          <Switch
            checked={keepAwake}
            description="Stops the display from sleeping while photos play."
            label="Keep screen awake"
            onChange={onKeepAwakeChange}
          />
        </div>
      ) : null}

      <div className="mt-1 border-t border-paper/8 px-1 pt-1">
        <button
          className={cx(
            "flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2 py-2.5 text-left text-paper/75 transition-colors hover:bg-paper/8 hover:text-paper",
            focusRing,
            "focus-visible:ring-offset-0",
          )}
          onClick={() => {
            onOpenChange(false);
            onOpenHelp();
          }}
          type="button"
        >
          <KeyboardIcon className="text-paper/55" size={18} />
          <span className="flex-1 text-[12px]">Keyboard shortcuts</span>
          <kbd className="text-[10px] text-paper/40">?</kbd>
        </button>
      </div>
    </Popover>
  );
}
