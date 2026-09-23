import { cx } from "../../lib/class-names";
import { focusRing } from "./control-button";

/** The switch's track and knob, for a control that owns its own label. */
export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative block h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200",
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
  );
}

/** A labelled on/off row, the whole row pressable. */
export function Switch({
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
      <SwitchTrack checked={checked} />
    </button>
  );
}
