import type { ReactNode } from "react";

import { cx } from "../../lib/class-names";
import { focusRing } from "./control-button";
import { GridIcon } from "./icons";
import type { ChromeHoldProps } from "./use-chrome-hold";

export function TopBar({
  collectionMenu,
  holdProps,
  mat,
  musicButton,
  onOpenLibrary,
  visible,
}: {
  collectionMenu: ReactNode;
  holdProps: ChromeHoldProps;
  mat: boolean;
  musicButton: ReactNode;
  onOpenLibrary: () => void;
  visible: boolean;
}) {
  return (
    <header
      className={cx(
        "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 pt-[max(16px,env(safe-area-inset-top))] pr-[max(16px,env(safe-area-inset-right))] pl-[max(20px,env(safe-area-inset-left))] transition-[opacity,translate] duration-500 ease-soft sm:px-7 sm:pt-6",
        visible ? "opacity-100" : "-translate-y-1.5 opacity-0",
      )}
    >
      <div
        className={cx(
          "flex min-w-0 items-center gap-3 sm:gap-5",
          visible && "pointer-events-auto",
        )}
        {...holdProps}
      >
        <h1
          className={cx(
            "shrink-0 font-serif text-[30px] leading-none tracking-[-.01em] italic transition-colors duration-500 sm:text-[34px]",
            mat
              ? "text-ink"
              : "text-paper [text-shadow:0_1px_20px_rgba(0,0,0,.35)]",
          )}
        >
          Kiana
        </h1>
        {collectionMenu}
      </div>

      <div
        className={cx(
          "flex items-center gap-2",
          visible && "pointer-events-auto",
        )}
        {...holdProps}
      >
        {musicButton}
        <button
          aria-keyshortcuts="G"
          className={cx(
            "glass flex h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-paper/85 transition-[color,background-color] duration-200 hover:bg-night/70 hover:text-paper sm:pr-4 sm:pl-3.5",
            focusRing,
          )}
          onClick={onOpenLibrary}
          title="Library (G)"
          type="button"
        >
          <GridIcon size={17} />
          <span className="label max-sm:sr-only">Library</span>
        </button>
      </div>
    </header>
  );
}
