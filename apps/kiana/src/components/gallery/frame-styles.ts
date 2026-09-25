/**
 * The frames' looks, shared by photos and videos so both sit in the same
 * place and size: filling the screen, floating over a blurred backdrop,
 * or matted on a paper card against the wall.
 */
export const frameStyles = {
  /** The wall behind a matted photo or video. */
  wall: "bg-mat",
  /** The paper card it sits on, with its margin. */
  card: "flex max-h-[78dvh] max-w-[84vw] bg-paper p-[clamp(12px,1.8vw,26px)] shadow-[0_1px_2px_rgba(23,18,15,.18),0_26px_60px_-26px_rgba(23,18,15,.5)] max-sm:max-h-[72dvh] max-sm:max-w-[90vw] max-sm:p-3",
  /** The largest the photo or video may be in each frame. */
  media: {
    fill: "max-h-[100dvh] max-w-[100vw]",
    backdrop:
      "max-h-[76dvh] max-w-[min(82vw,1060px)] shadow-[0_46px_100px_-40px_rgba(0,0,0,.95)] max-sm:max-h-[70dvh] max-sm:max-w-[90vw]",
    mat: "max-h-[calc(78dvh-clamp(24px,3.6vw,52px))] max-w-[calc(84vw-clamp(24px,3.6vw,52px))] max-sm:max-h-[calc(72dvh-24px)] max-sm:max-w-[calc(90vw-24px)]",
  },
} as const;
