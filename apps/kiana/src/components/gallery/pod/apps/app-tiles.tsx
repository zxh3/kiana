import type { ReactNode } from "react";

import { cx } from "../../../../lib/class-names";
import { type AppItem, appItems, screens } from "../menu";
import { muyuArt } from "./muyu/art";
import type { SpinnerLooks } from "./spinner/spinner";
import { SpinnerIcon } from "./spinner/spinner-art";

/** A speech bubble with three dots, for the Chat Room's tile. */
function ChatBubble() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 20 20" width="18">
      <path
        d="M10 3.2c-4.3 0-7.3 2.6-7.3 5.8 0 1.9 1 3.5 2.7 4.6l-.7 2.9 3.2-1.9c.7.2 1.4.2 2.1.2 4.3 0 7.3-2.6 7.3-5.8S14.3 3.2 10 3.2Z"
        fill="#ffffff"
      />
      {[6.6, 10, 13.4].map((cx) => (
        <circle cx={cx} cy="9" fill="#2d7ae3" key={cx} r="1.05" />
      ))}
    </svg>
  );
}

/**
 * Each app's tile: its background, a label short enough to sit under it,
 * and its icon. The finger spinner's icon wears the looks chosen in
 * Settings.
 */
const tiles: Record<
  AppItem,
  {
    background: string;
    label: string;
    icon: (looks: SpinnerLooks) => ReactNode;
  }
> = {
  spinner: {
    background: "bg-[linear-gradient(180deg,#ffffff_0%,#dfe4ea_100%)]",
    label: "Spinner",
    icon: (looks) => <SpinnerIcon looks={looks} size={27} />,
  },
  chat: {
    background: "bg-[linear-gradient(180deg,#7cc8ff_0%,#2d7ae3_100%)]",
    label: "Chat",
    icon: () => <ChatBubble />,
  },
  muyu: {
    background: "bg-[linear-gradient(180deg,#fff8ec_0%,#ecd8b8_100%)]",
    label: "木鱼",
    icon: () => (
      <img
        alt=""
        className="mt-1 w-[27px]"
        draggable={false}
        src={muyuArt.kiana}
      />
    ),
  },
};

/**
 * The apps, as tiles on a home screen, two to a row, for the top menu's
 * preview of Apps: the finger spinner (turning slowly), the Chat Room, and
 * the electronic wooden fish.
 */
export function AppTiles({ looks }: { looks: SpinnerLooks }) {
  return (
    <div className="absolute inset-0 flex flex-wrap content-center justify-center gap-x-2.5 gap-y-2 px-1 bg-[linear-gradient(160deg,#f4f7fb_0%,#c9d3df_100%)]">
      {appItems.map((app) => (
        <div className="flex flex-col items-center gap-[3px]" key={app}>
          <div
            className={cx(
              "grid size-[30px] place-items-center overflow-hidden rounded-[8px] shadow-[0_1px_2px_rgb(0_0_0/.3),inset_0_1px_0_rgb(255_255_255/.6)]",
              tiles[app].background,
            )}
          >
            {tiles[app].icon(looks)}
          </div>
          <span
            className="text-[8.5px] leading-none font-semibold text-[#3d4652]"
            lang={screens[app].lang}
          >
            {tiles[app].label}
          </span>
        </div>
      ))}
    </div>
  );
}
