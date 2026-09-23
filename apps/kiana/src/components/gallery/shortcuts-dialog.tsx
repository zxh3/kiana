import { useEffect, useRef } from "react";

import { ControlButton } from "./control-button";
import { CloseIcon } from "./icons";
import { shortcutList } from "./use-gallery-shortcuts";

export function ShortcutsDialog({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a click on the backdrop closes it; <dialog> already closes on Escape.
    <dialog
      aria-labelledby="shortcuts-title"
      className="glass m-auto w-[min(420px,calc(100vw-32px))] rounded-[28px] bg-night/88 p-0 text-paper outline-none transition-[opacity,scale] duration-300 ease-soft shadow-[0_40px_120px_-20px_rgba(0,0,0,.85)] backdrop:bg-transparent starting:scale-96 starting:opacity-0"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
      ref={ref}
    >
      <div className="p-6 pt-5">
        <div className="flex items-center justify-between">
          <h2
            className="font-serif text-[32px] leading-none italic"
            id="shortcuts-title"
          >
            Shortcuts
          </h2>
          <ControlButton className="-mr-2" label="Close" onClick={onClose}>
            <CloseIcon />
          </ControlButton>
        </div>
        <dl className="mt-5 divide-y divide-paper/8">
          {shortcutList.map(({ keys, label }) => (
            <div
              className="flex items-center justify-between gap-4 py-2.5"
              key={label}
            >
              <dt className="text-[12px] text-paper/72">{label}</dt>
              <dd className="flex gap-1">
                {keys.map((key) => (
                  <kbd
                    className="min-w-7 rounded-[7px] border border-paper/14 bg-paper/6 px-1.5 py-1 text-center text-[11px] leading-none text-paper/90 shadow-[inset_0_-1px_0_rgba(246,240,230,.08)]"
                    key={key}
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-[11px] leading-relaxed text-paper/45">
          On a touch screen, swipe to move between photos and tap to show the
          controls.
        </p>
      </div>
    </dialog>
  );
}
