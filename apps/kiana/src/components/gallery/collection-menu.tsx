import type { ReactNode } from "react";

import { cx } from "../../lib/class-names";
import type { Collection, CollectionId } from "./collections";
import { focusRing } from "./control-button";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  GridIcon,
  HeartIcon,
  StackIcon,
} from "./icons";
import { Popover } from "./popover";

const numberFormatter = new Intl.NumberFormat("en-US");

export type CollectionCounts = {
  all: number;
  favorites: number;
  onThisDay: { count: number; detail?: string };
  years: ReadonlyArray<{ year: number; count: number }>;
};

function MenuItem({
  checked,
  count,
  detail,
  disabled,
  icon,
  label,
  onSelect,
}: {
  checked: boolean;
  count: number;
  detail?: string;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      className={cx(
        "group flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-paper/8 focus-visible:bg-paper/10 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent",
        focusRing,
        "focus-visible:ring-offset-0",
      )}
      disabled={disabled}
      onClick={onSelect}
      role="menuitemradio"
      type="button"
    >
      {icon ? (
        <span className="grid size-5 place-items-center text-paper/55">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[19px] leading-tight text-paper">
          {label}
        </span>
        {detail ? (
          <span className="mt-1 block truncate text-[10px] tracking-[.08em] text-paper/45">
            {detail}
          </span>
        ) : null}
      </span>
      <span className="text-[10px] tabular-nums tracking-[.08em] text-paper/40">
        {numberFormatter.format(count)}
      </span>
      <span className="grid w-4 place-items-center text-paper">
        {checked ? <CheckIcon size={16} /> : null}
      </span>
    </button>
  );
}

export function CollectionMenu({
  collection,
  counts,
  onOpenChange,
  onOpenLibrary,
  onSelect,
  open,
}: {
  collection: Collection;
  counts: CollectionCounts;
  onOpenChange: (open: boolean) => void;
  onOpenLibrary: () => void;
  onSelect: (id: CollectionId) => void;
  open: boolean;
}) {
  const choose = (id: CollectionId) => {
    onSelect(id);
    onOpenChange(false);
  };
  const monthActive = collection.id.startsWith("month-");

  return (
    <Popover
      className="w-[min(300px,calc(100vw-32px))]"
      kind="menu"
      label="Choose what to play"
      onOpenChange={onOpenChange}
      open={open}
      placement="bottom-start"
      trigger={(props) => (
        <button
          {...props}
          className={cx(
            "glass flex h-10 cursor-pointer items-center gap-2.5 rounded-full pr-3 pl-4 text-paper transition-[background-color] duration-200 hover:bg-night/70",
            focusRing,
          )}
          title="Choose what to play"
          type="button"
        >
          <span className="label max-w-[40vw] truncate text-paper/90">
            {collection.label}
          </span>
          <span className="text-[10px] tabular-nums text-paper/45">
            {numberFormatter.format(collection.members.length)}
          </span>
          <ChevronDownIcon
            className={cx(
              "text-paper/60 transition-transform duration-200",
              open && "rotate-180",
            )}
            size={14}
          />
        </button>
      )}
    >
      <div className="max-h-[min(560px,calc(100dvh-120px))] overflow-y-auto overscroll-contain scrollbar-none">
        {monthActive ? (
          <MenuItem
            checked
            count={collection.members.length}
            detail="From the library"
            icon={<CalendarIcon size={18} />}
            label={collection.label}
            onSelect={() => onOpenChange(false)}
          />
        ) : null}
        <MenuItem
          checked={collection.id === "all"}
          count={counts.all}
          icon={<StackIcon size={18} />}
          label="Everything"
          onSelect={() => choose("all")}
        />
        <MenuItem
          checked={collection.id === "on-this-day"}
          count={counts.onThisDay.count}
          detail={counts.onThisDay.detail}
          disabled={counts.onThisDay.count === 0}
          icon={<CalendarIcon size={18} />}
          label="On this day"
          onSelect={() => choose("on-this-day")}
        />
        <MenuItem
          checked={collection.id === "favorites"}
          count={counts.favorites}
          detail={
            counts.favorites === 0 ? "Tap the heart to save one" : undefined
          }
          disabled={counts.favorites === 0}
          icon={<HeartIcon size={18} />}
          label="Favorites"
          onSelect={() => choose("favorites")}
        />

        <p className="label px-3 pt-4 pb-2 text-paper/38">By year</p>
        <div className="grid grid-cols-2 gap-1 px-1 pb-1">
          {counts.years.map(({ year, count }) => {
            const id = `year-${year}` as CollectionId;
            const checked = collection.id === id;
            return (
              <button
                aria-checked={checked}
                className={cx(
                  "flex cursor-pointer items-baseline justify-between rounded-[12px] px-3 py-2 text-left transition-colors duration-150",
                  checked
                    ? "bg-paper text-ink"
                    : "text-paper hover:bg-paper/8 focus-visible:bg-paper/10",
                  focusRing,
                  "focus-visible:ring-offset-0",
                )}
                key={year}
                onClick={() => choose(id)}
                role="menuitemradio"
                type="button"
              >
                <span className="font-serif text-[19px] leading-none">
                  {year}
                </span>
                <span
                  className={cx(
                    "text-[10px] tabular-nums",
                    checked ? "text-ink/55" : "text-paper/38",
                  )}
                >
                  {numberFormatter.format(count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-1 border-t border-paper/8 pt-1">
        <button
          className={cx(
            "flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-paper/80 transition-colors hover:bg-paper/8 hover:text-paper focus-visible:bg-paper/10",
            focusRing,
            "focus-visible:ring-offset-0",
          )}
          onClick={() => {
            onOpenChange(false);
            onOpenLibrary();
          }}
          role="menuitem"
          type="button"
        >
          <GridIcon className="text-paper/55" size={18} />
          <span className="flex-1 text-[12px]">Browse the library</span>
          <kbd className="text-[10px] text-paper/40">G</kbd>
        </button>
      </div>
    </Popover>
  );
}
