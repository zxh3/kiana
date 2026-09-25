import { useVirtualizer } from "@tanstack/react-virtual";
import { motion } from "motion/react";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import { fades, springs } from "../../lib/motion";
import { cue } from "../../lib/sounds";
import type { AccountStatus } from "./account";
import { ControlButton, focusRing } from "./control-button";
import { SignInButton } from "./favorite-button";
import { CloseIcon, HeartIcon, LiveIcon, PlayIcon } from "./icons";
import {
  buildRows,
  centeredOffset,
  groupByMonth,
  type LibraryFilter,
  type LibraryRow,
  libraryFilterLabels,
  libraryFilters,
  libraryIndexes,
  type MonthGroup,
  rowContaining,
  yearAnchors,
} from "./library-layout";
import { formatMediaDuration, formatMonthName, formatPhotoDate } from "./model";

const TILE_GAP = 3;
const MAX_CONTENT_WIDTH = 1680;
const numberFormatter = new Intl.NumberFormat("en-US");

const filterNouns: Record<LibraryFilter, [string, string]> = {
  all: ["moment", "moments"],
  photo: ["photo", "photos"],
  live_photo: ["Live Photo", "Live Photos"],
  video: ["video", "videos"],
  favorites: ["favorite", "favorites"],
};

function describeCount(filter: LibraryFilter, count: number) {
  const [one, many] = filterNouns[filter];
  return `${numberFormatter.format(count)} ${count === 1 ? one : many}`;
}

function kindLabel(asset: GalleryAsset) {
  if (asset.type === "live_photo") return "Live Photo";
  if (asset.type === "video") return "Video";
  return "Photo";
}

function rowHeightFor(row: LibraryRow, compact: boolean, tileSize: number) {
  if (row.kind === "intro") return compact ? 200 : 300;
  if (row.kind === "empty") return 220;
  if (row.kind === "month") return compact ? 76 : 108;
  return tileSize + TILE_GAP;
}

const LibraryTile = memo(function LibraryTile({
  asset,
  current,
  favorite,
  index,
  onOpen,
}: {
  asset: GalleryAsset;
  current: boolean;
  favorite: boolean;
  index: number;
  onOpen: (index: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const date = formatPhotoDate(asset.date);

  return (
    <button
      aria-current={current || undefined}
      aria-label={[
        kindLabel(asset),
        date,
        favorite && "favorite",
        current && "now playing",
      ]
        .filter(Boolean)
        .join(", ")}
      className={cx(
        "group relative block aspect-square cursor-pointer overflow-hidden bg-paper/[.045] outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-paper",
        current &&
          "z-10 animate-now-playing ring-[3px] ring-paper ring-offset-[3px] ring-offset-night motion-reduce:animate-none",
      )}
      onClick={() => onOpen(index)}
      type="button"
    >
      <img
        alt=""
        className={cx(
          "size-full object-cover transition-[opacity,scale] duration-700 ease-soft group-hover:scale-[1.04] motion-reduce:transition-none",
          loaded ? "opacity-100" : "opacity-0",
        )}
        decoding="async"
        draggable={false}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        ref={(element) => {
          if (element?.complete && element.naturalWidth > 0) setLoaded(true);
        }}
        src={asset.small}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.5),transparent_45%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      {date && !current ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-2.5 font-serif text-[14px] text-paper italic opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:hidden"
        >
          {date}
        </span>
      ) : null}
      {asset.type === "live_photo" ? (
        <LiveIcon
          className="absolute top-2 left-2 text-paper/90 drop-shadow-[0_1px_3px_rgba(0,0,0,.6)]"
          size={16}
        />
      ) : null}
      {asset.type === "video" && asset.video ? (
        <span className="absolute top-2 right-2 text-[10px] tabular-nums text-paper drop-shadow-[0_1px_3px_rgba(0,0,0,.7)]">
          {formatMediaDuration(asset.video.durationMs)}
        </span>
      ) : null}
      {favorite ? (
        <HeartIcon
          className="absolute right-2 bottom-2 text-rose drop-shadow-[0_1px_3px_rgba(0,0,0,.6)]"
          filled
          size={15}
        />
      ) : null}
      {current ? (
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-paper py-1.5 pr-2.5 pl-2 text-[9px] leading-none tracking-[.16em] text-ink uppercase shadow-[0_2px_12px_rgba(0,0,0,.4)] max-sm:pr-2"
        >
          <PlayIcon size={9} />
          <span className="max-sm:hidden">Now playing</span>
        </span>
      ) : null}
    </button>
  );
});

function MonthHeader({
  compact,
  group,
  onPlay,
}: {
  compact: boolean;
  group: MonthGroup;
  onPlay: (monthKey: string) => void;
}) {
  const title = group.month ? formatMonthName(group.month) : "Undated";
  return (
    <div className="flex h-full items-end justify-between gap-4 pb-4">
      <h3 className="flex items-baseline gap-3">
        <span
          className={cx(
            "font-serif leading-none text-paper",
            compact ? "text-[28px]" : "text-[38px]",
          )}
        >
          {title}
        </span>
        {group.year ? (
          <span className="label text-paper/42">{group.year}</span>
        ) : null}
      </h3>
      <div className="flex items-center gap-3 pb-0.5">
        <span className="text-[10px] tabular-nums text-paper/38">
          {numberFormatter.format(group.items.length)}
        </span>
        {group.month ? (
          <button
            className={cx(
              "label flex cursor-pointer items-center gap-1.5 rounded-full border border-paper/14 px-3 py-2 text-paper/75 transition-colors duration-200 hover:border-paper hover:bg-paper hover:text-ink",
              focusRing,
            )}
            onClick={() => onPlay(group.key)}
            title={`Play ${title} ${group.year}`}
            type="button"
          >
            <PlayIcon size={11} />
            Play
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Library({
  assets,
  chronological,
  account,
  currentIndex,
  favorites,
  onClose,
  onOpenAsset,
  onPlayMonth,
  onSignIn,
}: {
  /** A guest's Favorites asks them to sign in. */
  account: AccountStatus;
  assets: ReadonlyArray<GalleryAsset>;
  chronological: ReadonlyArray<number>;
  currentIndex: number;
  favorites: ReadonlySet<string>;
  onClose: () => void;
  onOpenAsset: (index: number) => void;
  onPlayMonth: (monthKey: string) => void;
  onSignIn: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width } = size;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // A non-modal layer rather than a modal dialog: the gallery makes the
  // slideshow inert while it is open, and the music player (whose YouTube
  // frame must never be covered) can stay on top of it. Focus returns to
  // whatever opened the library when it goes away.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (dialog && !dialog.open) dialog.show();
    // Start in the grid so arrow and Page keys scroll straight away.
    scrollRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () =>
      setSize((current) =>
        current.width === element.clientWidth &&
        current.height === element.clientHeight
          ? current
          : { width: element.clientWidth, height: element.clientHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const compact = width < 640;
  const sidePadding = compact ? 12 : 40;
  const railSpace = compact ? 48 : 88;
  const contentWidth = Math.max(
    0,
    Math.min(width, MAX_CONTENT_WIDTH) - sidePadding - railSpace,
  );
  const targetTile = compact ? 112 : 172;
  const columns = Math.max(
    3,
    Math.round((contentWidth + TILE_GAP) / (targetTile + TILE_GAP)),
  );
  const tileSize = (contentWidth - TILE_GAP * (columns - 1)) / columns;

  const counts = useMemo(() => {
    const result: Record<LibraryFilter, number> = {
      all: assets.length,
      photo: 0,
      live_photo: 0,
      video: 0,
      favorites: 0,
    };
    for (const asset of assets) {
      result[asset.type] += 1;
      if (favorites.has(asset.id)) result.favorites += 1;
    }
    return result;
  }, [assets, favorites]);

  const filteredFavorites = filter === "favorites" ? favorites : undefined;
  const indexes = useMemo(
    () =>
      libraryIndexes(
        assets,
        chronological,
        filter,
        filteredFavorites ?? new Set(),
      ),
    [assets, chronological, filter, filteredFavorites],
  );
  const groups = useMemo(
    () => groupByMonth(assets, indexes),
    [assets, indexes],
  );
  const rows = useMemo(() => buildRows(groups, columns), [groups, columns]);
  const anchors = useMemo(() => yearAnchors(rows), [rows]);
  const span = useMemo(() => {
    const years = groups.flatMap((group) => (group.year ? [group.year] : []));
    return years.length
      ? { from: Math.min(...years), to: Math.max(...years) }
      : null;
  }, [groups]);

  const heights = useMemo(
    () => rows.map((row) => rowHeightFor(row, compact, tileSize)),
    [rows, compact, tileSize],
  );

  // Open centred on the photo that was playing. The offset is worked out
  // from the known row heights before the first paint, so the grid starts
  // there instead of rendering the first months and then jumping.
  const openingOffset = useRef<number | null>(null);
  if (openingOffset.current === null && width > 0) {
    const row = rowContaining(rows, currentIndex);
    openingOffset.current =
      row > 0 ? centeredOffset(heights, row, size.height) : 0;
  }

  const virtualizer = useVirtualizer({
    count: rows.length,
    enabled: width > 0,
    estimateSize: (index) => heights[index],
    getItemKey: (index) => rows[index].key,
    getScrollElement: () => scrollRef.current,
    initialOffset: () => openingOffset.current ?? 0,
    initialRect: size,
    overscan: 5,
  });

  // Row heights are computed, not measured, so re-measure when they change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the heights change
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, heights]);

  const openedAtCurrent = useRef(false);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (openedAtCurrent.current || !element || width === 0) return;
    openedAtCurrent.current = true;
    element.scrollTop = openingOffset.current ?? 0;
  }, [width]);

  const pickFilter = (next: LibraryFilter) => {
    cue("select");
    setFilter(next);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const items = virtualizer.getVirtualItems();
  const offset = virtualizer.scrollOffset ?? 0;
  const topItem = items.find((item) => item.end > offset + 24);
  const topRow = topItem ? rows[topItem.index] : undefined;
  const topGroup =
    topRow && (topRow.kind === "month" || topRow.kind === "tiles")
      ? topRow.group
      : undefined;
  const activeYear = topGroup?.year ?? anchors[0]?.year;

  return (
    <motion.dialog
      animate={{ opacity: 1, y: 0, transition: springs.glide }}
      aria-label="Library"
      aria-modal="true"
      className="fixed inset-0 z-40 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-night p-0 text-paper outline-none"
      exit={{ opacity: 0, y: 14, transition: { ...fades.out, duration: 0.22 } }}
      initial={{ opacity: 0, y: 18 }}
      ref={dialogRef}
    >
      <div className="flex h-full flex-col">
        <header className="z-10 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-b border-paper/8 bg-night/85 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 backdrop-blur-xl sm:flex-nowrap sm:px-8 sm:py-3.5">
          <div className="flex min-w-0 flex-1 items-baseline gap-3 sm:flex-none">
            <span className="font-serif text-[28px] leading-none italic">
              Kiana
            </span>
            <span className="label text-paper/40">Library</span>
            {topGroup?.month ? (
              <span className="label hidden text-paper/70 lg:inline">
                <span className="mr-3 text-paper/20">/</span>
                {formatMonthName(topGroup.month)} {topGroup.year}
              </span>
            ) : null}
          </div>

          <fieldset className="order-last -mx-4 flex w-[calc(100%+32px)] min-w-0 gap-1 overflow-x-auto px-4 scrollbar-none sm:order-none sm:mx-auto sm:w-auto sm:rounded-full sm:bg-paper/6 sm:p-1">
            <legend className="sr-only">Show</legend>
            {libraryFilters.map((option) => (
              <button
                aria-pressed={option === filter}
                className={cx(
                  "relative isolate flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-[11px] tracking-[.06em] transition-colors duration-150 max-sm:bg-paper/6",
                  option === filter
                    ? "text-ink"
                    : "text-paper/65 hover:text-paper",
                  focusRing,
                  "focus-visible:ring-offset-0",
                )}
                key={option}
                onClick={() => pickFilter(option)}
                type="button"
              >
                {/* The selection slides between filters rather than jumping. */}
                {option === filter ? (
                  <motion.span
                    className="absolute inset-0 -z-10 rounded-full bg-paper"
                    layoutId="library-filter"
                    transition={springs.snappy}
                  />
                ) : null}
                {option === "favorites" ? (
                  <HeartIcon filled={option === filter} size={13} />
                ) : null}
                {libraryFilterLabels[option]}
                <span
                  className={cx(
                    "tabular-nums",
                    option === filter ? "text-ink/50" : "text-paper/35",
                  )}
                >
                  {numberFormatter.format(counts[option])}
                </span>
              </button>
            ))}
          </fieldset>

          <ControlButton
            className="-mr-2 sm:mr-0"
            label="Back to the slideshow"
            onClick={onClose}
            shortcut="Escape"
          >
            <CloseIcon />
          </ControlButton>
        </header>

        <div className="relative min-h-0 flex-1">
          <section
            aria-label="Photos by month"
            className="h-full overflow-y-auto overscroll-contain outline-none [scrollbar-color:rgb(246_240_230/.18)_transparent] [scrollbar-width:thin]"
            ref={scrollRef}
            tabIndex={-1}
          >
            <div
              className="relative mx-auto w-full"
              style={{
                height: virtualizer.getTotalSize(),
                maxWidth: MAX_CONTENT_WIDTH,
              }}
            >
              {items.map((item) => {
                const row = rows[item.index];
                return (
                  <div
                    className="absolute top-0 left-0 w-full"
                    key={item.key}
                    style={{
                      height: item.size,
                      paddingLeft: sidePadding,
                      paddingRight: railSpace,
                      transform: `translateY(${item.start}px)`,
                      // Let the playing tile's highlight spill over its
                      // neighbouring rows instead of sliding under them.
                      zIndex:
                        row.kind === "tiles" && row.items.includes(currentIndex)
                          ? 1
                          : undefined,
                    }}
                  >
                    {row.kind === "intro" ? (
                      <div className="flex h-full flex-col justify-end pb-6">
                        <p
                          className="font-serif text-[clamp(40px,6.4vw,84px)] leading-[1.05] tracking-[.02em] text-paper/92"
                          lang="zh-Hans"
                        >
                          当时只道是寻常
                        </p>
                        <p className="label mt-5 text-paper/45">
                          {describeCount(filter, indexes.length)}
                          {span
                            ? `  ·  ${span.from === span.to ? span.from : `${span.from} – ${span.to}`}`
                            : ""}
                        </p>
                      </div>
                    ) : row.kind === "empty" ? (
                      <div className="flex h-full flex-col items-start justify-center gap-3 border-t border-paper/8">
                        <HeartIcon className="text-rose" size={22} />
                        {account === "member" ? (
                          <>
                            <p className="font-serif text-[26px] leading-tight italic">
                              Nothing saved yet.
                            </p>
                            <p className="max-w-sm text-[12px] leading-relaxed text-paper/50">
                              Tap the heart on a photo in the slideshow and it
                              will wait for you here, on every device.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-serif text-[26px] leading-tight italic">
                              Sign in to keep favorites.
                            </p>
                            <p className="max-w-sm text-[12px] leading-relaxed text-paper/50">
                              Favorites are kept in your Google account, so they
                              wait for you here on every device.
                            </p>
                            <SignInButton
                              account={account}
                              className="mt-1 w-auto"
                              onSignIn={onSignIn}
                            />
                          </>
                        )}
                      </div>
                    ) : row.kind === "month" ? (
                      <MonthHeader
                        compact={compact}
                        group={row.group}
                        onPlay={onPlayMonth}
                      />
                    ) : (
                      <div
                        className="grid"
                        style={{
                          gap: TILE_GAP,
                          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                        }}
                      >
                        {row.items.map((index) => (
                          <LibraryTile
                            asset={assets[index]}
                            current={index === currentIndex}
                            favorite={favorites.has(assets[index].id)}
                            index={index}
                            key={assets[index].id}
                            onOpen={onOpenAsset}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {anchors.length > 1 ? (
            <nav
              aria-label="Jump to a year"
              className="absolute top-1/2 right-1 z-10 flex -translate-y-1/2 flex-col items-end gap-0.5 sm:right-5"
            >
              {anchors.map(({ year, row }) => (
                <button
                  aria-current={year === activeYear ? "true" : undefined}
                  className={cx(
                    "relative isolate cursor-pointer rounded-full px-2 py-1.5 text-[10px] tabular-nums tracking-[.08em] transition-colors duration-200 sm:px-2.5",
                    year === activeYear
                      ? "text-ink"
                      : "text-paper/40 hover:text-paper",
                    focusRing,
                    "focus-visible:ring-offset-0",
                  )}
                  key={year}
                  onClick={() => {
                    cue("select");
                    virtualizer.scrollToIndex(row, { align: "start" });
                  }}
                  title={`Jump to ${year}`}
                  type="button"
                >
                  {/* The current year's marker glides along as you scroll. */}
                  {year === activeYear ? (
                    <motion.span
                      className="absolute inset-0 -z-10 rounded-full bg-paper"
                      layoutId="library-year"
                      transition={springs.gentle}
                    />
                  ) : null}
                  {compact ? `’${String(year).slice(2)}` : year}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </motion.dialog>
  );
}
