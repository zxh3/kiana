import { useEffect, useRef } from "react";

import { NAME_MAX } from "../../../../../lib/chat";
import { PodField } from "../../screen/pod-field";

/**
 * Your Name, opened from the viewer's own row in the Online list: a field
 * with the name in it. Enter or the centre button saves it, and Menu leaves
 * it as it was. Everyone in the room sees the new name at once.
 */
export function ChatName({
  name,
  onSave,
  saves,
}: {
  name: string;
  onSave: (name: string) => void;
  /** Presses of the centre button so far, counted up by the player. */
  saves: number;
}) {
  const field = useRef<HTMLInputElement>(null);
  const seenSaves = useRef(saves);

  // With a mouse or trackpad, the field is ready to type into. A phone's
  // keyboard waits for a tap on it rather than covering the player.
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    field.current?.focus({ preventScroll: true });
    field.current?.select();
  }, []);

  const save = useRef(onSave);
  save.current = onSave;
  useEffect(() => {
    if (saves === seenSaves.current) return;
    seenSaves.current = saves;
    save.current(field.current?.value ?? "");
  }, [saves]);

  return (
    <div className="flex h-full flex-col justify-center gap-1.5 px-3">
      <p className="text-[11px] font-semibold text-[#3d3d3d]">
        Your name in the Chat Room
      </p>
      <div className="rounded-[3px] border border-[#a5a5a5] bg-white shadow-[inset_0_1px_2px_rgb(0_0_0/.12)]">
        <PodField
          aria-label="Your name"
          defaultValue={name}
          enterKeyHint="done"
          height={20}
          maxLength={NAME_MAX}
          onEnter={onSave}
          ref={field}
        />
      </div>
      <p className="text-[10px] leading-[12px] text-[#8a8a8a]">
        Enter or the centre button saves it. Menu leaves it as it was.
      </p>
    </div>
  );
}
