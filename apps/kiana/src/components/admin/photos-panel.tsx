import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "motion/react";
import {
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import {
  HIDDEN_CHANGE_MAX,
  type HiddenChange,
  type HiddenPhoto,
} from "../../lib/hidden-photos";
import { fades, springs } from "../../lib/motion";
import { cue } from "../../lib/sounds";
import { chronologicalIndexes } from "../gallery/collections";
import { focusRing } from "../gallery/control-button";
import { CheckIcon, EyeIcon, EyeOffIcon, LiveIcon } from "../gallery/icons";
import {
  buildRows,
  gridGeometry,
  groupByMonth,
  type LibraryRow,
  MAX_CONTENT_WIDTH,
  type MonthGroup,
  rowHeightFor,
  TILE_GAP,
  yearAnchors,
} from "../gallery/library-layout";
import {
  formatMediaDuration,
  formatMonthName,
  formatPhotoDate,
} from "../gallery/model";
import type { ToastMessage } from "../gallery/toast";
import { YearRail } from "../gallery/year-rail";
import type { AdminPhotos } from "./admin-page";
import {
  adminIndexes,
  changeFor,
  describeHidden,
  type PhotoFilter,
  photoCounts,
  photoFilterLabels,
  photoFilters,
  selectRange,
  toggleSelection,
} from "./admin-photos";
import { PhotoPreview } from "./photo-preview";
import { useHiddenPhotos } from "./use-hidden-photos";

const numberFormatter = new Intl.NumberFormat("en-US");

const plural = (count: number, one: string, many = `${one}s`) =>
  `${numberFormatter.format(count)} ${count === 1 ? one : many}`;

/** How tall each row is: the grid's own, with a shorter heading. */
function rowHeight(row: LibraryRow, compact: boolean, tileSize: number) {
  if (row.kind === "intro") return compact ? 116 : 148;
  if (row.kind === "month") return compact ? 64 : 88;
  return rowHeightFor(row, compact, tileSize);
}

/**
 * Every photo in the release, newest first by month, to hide from the
 * gallery or show again. A photo opens large to look at before deciding;
 * Select picks several (shift-click for a run, or a whole month) for one
 * change. Hidden photos stay in the grid, dimmed, so nothing is lost.
 */
export function PhotosPanel({
  data,
  onToast,
  toast,
}: {
  data: AdminPhotos;
  onToast: (text: string) => void;
  /** The page's toast, for the preview to show above the page. */
  toast: ToastMessage | null;
}) {
  const { assets } = data;
  const { change, hidden } = useHiddenPhotos(data.hidden, data.admin.name);
  const chronological = useMemo(() => chronologicalIndexes(assets), [assets]);
  const [filter, setFilter] = useState<PhotoFilter>("all");
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const lastPicked = useRef<number | null>(null);
  // The preview steps through the grid as it was when it opened, so a
  // photo hidden under the Shown filter does not pull the next one away.
  const [preview, setPreview] = useState<{
    index: number;
    order: number[];
  } | null>(null);

  const scrollRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
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

  const { compact, sidePadding, railSpace, columns, tileSize } = gridGeometry(
    size.width,
  );
  const counts = useMemo(() => photoCounts(assets, hidden), [assets, hidden]);
  // Only the filtered views depend on what is hidden.
  const hiddenKey = filter === "all" ? null : hidden;
  const indexes = useMemo(
    () => adminIndexes(assets, chronological, filter, hiddenKey ?? new Map()),
    [assets, chronological, filter, hiddenKey],
  );
  const groups = useMemo(
    () => groupByMonth(assets, indexes),
    [assets, indexes],
  );
  const rows = useMemo(() => buildRows(groups, columns), [groups, columns]);
  const anchors = useMemo(() => yearAnchors(rows), [rows]);
  const heights = useMemo(
    () => rows.map((row) => rowHeight(row, compact, tileSize)),
    [rows, compact, tileSize],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    enabled: size.width > 0,
    estimateSize: (index) => heights[index],
    getItemKey: (index) => rows[index].key,
    getScrollElement: () => scrollRef.current,
    initialRect: size,
    overscan: 4,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the heights change
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, heights]);

  const items = virtualizer.getVirtualItems();
  const offset = virtualizer.scrollOffset ?? 0;
  const topItem = items.find((item) => item.end > offset + 24);
  const topRow = topItem ? rows[topItem.index] : undefined;
  const activeYear =
    (topRow && (topRow.kind === "month" || topRow.kind === "tiles")
      ? topRow.group.year
      : undefined) ?? anchors[0]?.year;

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelection(new Set());
    lastPicked.current = null;
  }, []);

  const pickFilter = (next: PhotoFilter) => {
    cue("select");
    setFilter(next);
    setSelection(new Set());
    lastPicked.current = null;
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const press = useCallback(
    (index: number, event: MouseEvent) => {
      if (!selecting) {
        cue("pickPhoto");
        setPreview({ index, order: indexes });
        return;
      }
      cue("select");
      const from = lastPicked.current;
      const run =
        event.shiftKey && from !== null
          ? selectRange(indexes, from, index)
          : [index];
      setSelection((current) =>
        event.shiftKey && from !== null
          ? new Set([...current, ...run])
          : toggleSelection(current, run),
      );
      lastPicked.current = index;
    },
    [indexes, selecting],
  );

  const toggleMonth = useCallback((group: MonthGroup) => {
    cue("select");
    setSelection((current) => toggleSelection(current, group.items));
  }, []);

  /** Saves a change, and says how it went. */
  const save = useCallback(
    async (wanted: HiddenChange) => {
      const hiding = wanted.hide.length > 0;
      const count = hiding ? wanted.hide.length : wanted.show.length;
      cue(hiding ? "switchOff" : "switchOn");
      const saved = await change(wanted);
      if (saved) {
        onToast(
          `${plural(count, "photo")} ${hiding ? "hidden" : "shown again"}`,
        );
      } else {
        cue("error");
        onToast("Couldn’t save the change");
      }
    },
    [change, onToast],
  );

  const act = (action: "hide" | "show") => {
    const wanted = changeFor(assets, selection, hidden, action);
    if (!wanted) return;
    if (wanted.hide.length + wanted.show.length > HIDDEN_CHANGE_MAX) {
      cue("error");
      onToast(
        `Pick up to ${numberFormatter.format(HIDDEN_CHANGE_MAX)} photos at a time`,
      );
      return;
    }
    stopSelecting();
    void save(wanted);
  };

  // Escape leaves Select, unless the preview is what it closes.
  useEffect(() => {
    if (!selecting || preview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      stopSelecting();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [preview, selecting, stopSelecting]);

  const toHide = changeFor(assets, selection, hidden, "hide")?.hide.length ?? 0;
  const toShow = changeFor(assets, selection, hidden, "show")?.show.length ?? 0;
  const previewAsset = preview ? assets[preview.index] : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="z-10 flex shrink-0 items-center gap-3 border-b border-paper/8 px-4 py-2.5 sm:px-8">
        <fieldset className="-ml-1 flex min-w-0 gap-1 overflow-x-auto rounded-full bg-paper/6 p-1 scrollbar-none">
          <legend className="sr-only">Show</legend>
          {photoFilters.map((option) => (
            <button
              aria-pressed={option === filter}
              className={cx(
                "relative isolate flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-[11px] tracking-[.06em] transition-colors duration-150 sm:px-3.5",
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
              {option === filter ? (
                <motion.span
                  className="absolute inset-0 -z-10 rounded-full bg-paper"
                  layoutId="admin-filter"
                  transition={springs.snappy}
                />
              ) : null}
              {option === "hidden" ? <EyeOffIcon size={13} /> : null}
              {photoFilterLabels[option]}
              {/* Phones have room for the count that matters. */}
              <span
                className={cx(
                  "tabular-nums",
                  option === filter ? "text-ink/50" : "text-paper/35",
                  option !== "hidden" && "max-sm:hidden",
                )}
              >
                {numberFormatter.format(counts[option])}
              </span>
            </button>
          ))}
        </fieldset>
        <button
          aria-pressed={selecting}
          className={cx(
            "ml-auto shrink-0 cursor-pointer rounded-full border px-4 py-2 text-[11px] tracking-[.06em] transition-colors duration-150",
            selecting
              ? "border-paper bg-paper text-ink"
              : "border-paper/16 text-paper/75 hover:border-paper/40 hover:text-paper",
            focusRing,
          )}
          onClick={() => {
            cue("select");
            if (selecting) stopSelecting();
            else setSelecting(true);
          }}
          type="button"
        >
          {selecting ? "Done" : "Select"}
        </button>
      </div>

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
                  }}
                >
                  {row.kind === "intro" ? (
                    <PhotosIntro
                      filter={filter}
                      hidden={counts.hidden}
                      total={counts.all}
                    />
                  ) : row.kind === "empty" ? (
                    <NothingHidden />
                  ) : row.kind === "month" ? (
                    <MonthHeader
                      compact={compact}
                      group={row.group}
                      onToggle={selecting ? toggleMonth : undefined}
                      selected={
                        selecting &&
                        row.group.items.every((index) => selection.has(index))
                      }
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
                        <AdminTile
                          asset={assets[index]}
                          hidden={hidden.get(assets[index].id)}
                          index={index}
                          key={assets[index].id}
                          onPress={press}
                          selected={selection.has(index)}
                          selecting={selecting}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <YearRail
          activeYear={activeYear}
          anchors={anchors}
          compact={compact}
          layoutId="admin-year"
          onJump={(row) => {
            cue("select");
            virtualizer.scrollToIndex(row, { align: "start" });
          }}
        />

        <AnimatePresence>
          {selecting ? (
            <motion.div
              animate={{ opacity: 1, y: 0, transition: springs.gentle }}
              className="glass absolute bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 pl-5 text-[12px] whitespace-nowrap"
              exit={{ opacity: 0, y: 12, transition: fades.out }}
              initial={{ opacity: 0, y: 12 }}
              role="toolbar"
              aria-label="Selected photos"
            >
              <span
                className="mr-3 tabular-nums text-paper/70"
                aria-live="polite"
              >
                {selection.size === 0
                  ? "Select photos"
                  : `${numberFormatter.format(selection.size)} selected`}
              </span>
              <BarButton
                disabled={toHide === 0}
                icon={<EyeOffIcon size={15} />}
                label={
                  toHide > 0 ? `Hide ${numberFormatter.format(toHide)}` : "Hide"
                }
                onClick={() => act("hide")}
              />
              <BarButton
                disabled={toShow === 0}
                icon={<EyeIcon size={15} />}
                label={
                  toShow > 0 ? `Show ${numberFormatter.format(toShow)}` : "Show"
                }
                onClick={() => act("show")}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <PhotoPreview
        asset={previewAsset}
        hidden={previewAsset ? hidden.get(previewAsset.id) : undefined}
        onClose={() => setPreview(null)}
        onStep={(step) =>
          setPreview((current) => {
            if (!current) return current;
            const at = current.order.indexOf(current.index) + step;
            const index = current.order[at];
            if (index === undefined) return current;
            cue(step > 0 ? "next" : "previous");
            return { ...current, index };
          })
        }
        onToggle={(asset, isHidden) =>
          void save(
            isHidden
              ? { hide: [], show: [asset.id] }
              : { hide: [asset.id], show: [] },
          )
        }
        position={
          preview
            ? {
                at: preview.order.indexOf(preview.index),
                of: preview.order.length,
              }
            : undefined
        }
        toast={toast}
      />
    </div>
  );
}

function BarButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cx(
        "flex cursor-pointer items-center gap-2 rounded-full bg-paper/10 px-4 py-2.5 text-paper transition-[background-color,opacity] hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-30",
        focusRing,
        "focus-visible:ring-offset-0",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

/** The top of the grid: what it holds, and what the gallery leaves out. */
function PhotosIntro({
  filter,
  hidden,
  total,
}: {
  filter: PhotoFilter;
  hidden: number;
  total: number;
}) {
  const summary =
    filter === "hidden"
      ? hidden > 0
        ? "Left out of the gallery. Open one to show it again."
        : "Photos left out of the gallery show here."
      : `${plural(total, "photo")} in the release · ${numberFormatter.format(hidden)} hidden from the gallery`;
  return (
    <div className="flex h-full flex-col justify-end pb-6">
      <h1 className="font-serif text-[clamp(34px,4.6vw,56px)] leading-none">
        {filter === "hidden" ? "Hidden photos" : "Photos"}
      </h1>
      <p className="label mt-4 leading-relaxed text-paper/45">{summary}</p>
    </div>
  );
}

function NothingHidden() {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-3 border-t border-paper/8">
      <EyeIcon className="text-paper/50" size={22} />
      <p className="font-serif text-[26px] leading-tight italic">
        Nothing is hidden.
      </p>
      <p className="max-w-sm text-[12px] leading-relaxed text-paper/50">
        Every photo in the release is in the gallery.
      </p>
    </div>
  );
}

function MonthHeader({
  compact,
  group,
  onToggle,
  selected,
}: {
  compact: boolean;
  group: MonthGroup;
  /** Selects the whole month, while selecting. */
  onToggle?: (group: MonthGroup) => void;
  selected: boolean;
}) {
  const title = group.month ? formatMonthName(group.month) : "Undated";
  return (
    <div className="flex h-full items-end justify-between gap-4 pb-3.5">
      <h2 className="flex items-baseline gap-3">
        <span
          className={cx(
            "font-serif leading-none text-paper",
            compact ? "text-[24px]" : "text-[32px]",
          )}
        >
          {title}
        </span>
        {group.year ? (
          <span className="label text-paper/42">{group.year}</span>
        ) : null}
      </h2>
      <div className="flex items-center gap-3 pb-0.5">
        <span className="text-[10px] tabular-nums text-paper/38">
          {numberFormatter.format(group.items.length)}
        </span>
        {onToggle ? (
          <button
            aria-pressed={selected}
            className={cx(
              "label cursor-pointer rounded-full border px-3 py-2 transition-colors duration-200",
              selected
                ? "border-paper bg-paper text-ink"
                : "border-paper/14 text-paper/75 hover:border-paper hover:text-paper",
              focusRing,
            )}
            onClick={() => onToggle(group)}
            title={`Select every photo from ${title} ${group.year ?? ""}`.trim()}
            type="button"
          >
            {selected ? "Deselect" : "Select all"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const AdminTile = memo(function AdminTile({
  asset,
  hidden,
  index,
  onPress,
  selected,
  selecting,
}: {
  asset: GalleryAsset;
  hidden: HiddenPhoto | undefined;
  index: number;
  onPress: (index: number, event: MouseEvent) => void;
  selected: boolean;
  selecting: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const date = formatPhotoDate(asset.date);
  const label = [
    asset.type === "video"
      ? "Video"
      : asset.type === "live_photo"
        ? "Live Photo"
        : "Photo",
    date,
    hidden && describeHidden(hidden),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      aria-label={label}
      aria-pressed={selecting ? selected : undefined}
      className={cx(
        "group relative block aspect-square cursor-pointer overflow-hidden bg-paper/[.045] outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-paper",
      )}
      onClick={(event) => onPress(index, event)}
      title={hidden ? describeHidden(hidden) : undefined}
      type="button"
    >
      <img
        alt=""
        className={cx(
          "size-full object-cover transition-[opacity,scale,filter] duration-500 ease-soft motion-reduce:transition-none",
          !loaded && "opacity-0",
          loaded && hidden && "opacity-35 grayscale",
          selected && "scale-[.88]",
          !selected && "group-hover:scale-[1.04]",
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
      {hidden ? (
        <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-night/80 py-1 pr-2 pl-1.5 text-[9px] leading-none tracking-[.14em] text-paper/85 uppercase">
          <EyeOffIcon size={12} />
          <span className="max-sm:hidden">Hidden</span>
        </span>
      ) : null}
      {asset.type === "live_photo" ? (
        <LiveIcon
          className="absolute top-2 right-2 text-paper/90 drop-shadow-[0_1px_3px_rgba(0,0,0,.6)]"
          size={16}
        />
      ) : null}
      {asset.type === "video" && asset.video ? (
        <span className="absolute top-2 right-2 text-[10px] tabular-nums text-paper drop-shadow-[0_1px_3px_rgba(0,0,0,.7)]">
          {formatMediaDuration(asset.video.durationMs)}
        </span>
      ) : null}
      {selecting ? (
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-2 left-2 grid size-5 place-items-center rounded-full border transition-colors duration-150",
            selected
              ? "border-paper bg-paper text-ink"
              : "border-paper/70 bg-night/30 text-transparent",
          )}
        >
          <CheckIcon size={14} />
        </span>
      ) : null}
    </button>
  );
});
