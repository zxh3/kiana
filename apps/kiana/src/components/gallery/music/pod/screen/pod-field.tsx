import type { ComponentProps, KeyboardEvent } from "react";

/**
 * Safari on iPhones zooms the page into any text field set smaller than
 * 16px, so the field is drawn at 16px and scaled down to the screen's size.
 */
const FONT_SIZE = 16;
const SHOWN_SIZE = 11;
const SCALE = SHOWN_SIZE / FONT_SIZE;

/**
 * A one-line text field for the display, answering Enter. Enter that
 * finishes a word in an input method (such as for Chinese) is left alone,
 * so it never sends half a word.
 */
export function PodField({
  height,
  onEnter,
  ...props
}: Omit<ComponentProps<"input">, "onKeyDown" | "style"> & {
  height: number;
  onEnter: (value: string) => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    // Safari ends the composition before the Enter that ended it, which it
    // marks with key code 229.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    onEnter(event.currentTarget.value);
  };
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ height }}>
      <input
        autoComplete="off"
        className="absolute top-0 left-0 origin-top-left bg-transparent text-[#141414] outline-none placeholder:text-[#9a9a9a]"
        onKeyDown={handleKeyDown}
        spellCheck={false}
        style={{
          fontSize: FONT_SIZE,
          width: `${100 / SCALE}%`,
          height: height / SCALE,
          padding: `0 ${8 / SCALE}px`,
          transform: `scale(${SCALE})`,
        }}
        type="text"
        {...props}
      />
    </div>
  );
}
