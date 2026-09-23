import { AnimatePresence, MotionConfig } from "motion/react";
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import { cue, setSoundsEnabled, soundsSupported } from "../../lib/sounds";
import { Caption } from "./caption";
import { CollectionMenu } from "./collection-menu";
import {
  type CollectionId,
  chronologicalIndexes,
  monthCollectionId,
  resolveCollection,
  yearCounts,
} from "./collections";
import { copyText } from "./copy-text";
import { DisplayMenu } from "./display-menu";
import { Dock } from "./dock";
import { Library } from "./library";
import { frameLabels } from "./model";
import { MusicButton, MusicPlayer, useMusic } from "./music";
import { useGalleryPreferences } from "./preferences";
import { ProgressBar } from "./progress-bar";
import { createProgressChannel } from "./progress-channel";
import { parseResume, type ResumePositions, resumeKey } from "./resume";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { Stage } from "./stage";
import { Toast, type ToastMessage } from "./toast";
import { TopBar } from "./top-bar";
import { useChromeHold } from "./use-chrome-hold";
import { useChromeVisibility } from "./use-chrome-visibility";
import { useFavorites } from "./use-favorites";
import { useFullscreen } from "./use-fullscreen";
import { useGalleryShortcuts } from "./use-gallery-shortcuts";
import { useSlideshow } from "./use-slideshow";
import { useStoredState } from "./use-stored-state";
import { useToday } from "./use-today";
import { useWakeLock, wakeLockSupported } from "./use-wake-lock";

const NO_FAVORITES: ReadonlySet<string> = new Set();
const SWIPE_DISTANCE = 48;
const TAP_SLOP = 10;

type Menu = "collection" | "display" | null;

export function Gallery({
  assets,
  initialPhotoId,
  libraryOpen,
  onCloseLibrary,
  onOpenLibrary,
}: {
  assets: ReadonlyArray<GalleryAsset>;
  initialPhotoId?: string;
  libraryOpen: boolean;
  onCloseLibrary: () => void;
  onOpenLibrary: () => void;
}) {
  const preferences = useGalleryPreferences();
  const { favorites, toggle: toggleFavoriteId } = useFavorites();
  const today = useToday();
  const fullscreen = useFullscreen();
  // Clips start muted so browser autoplay stays reliable. Interface sounds
  // play from the start and fall silent only once the viewer turns sound off.
  const [muted, setMuted] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const [videoProgress] = useState(createProgressChannel);
  const [menu, setMenu] = useState<Menu>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);

  const chronological = useMemo(() => chronologicalIndexes(assets), [assets]);
  const years = useMemo(() => yearCounts(assets), [assets]);
  const [linkedIndex] = useState(() =>
    initialPhotoId ? assets.findIndex(({ id }) => id === initialPhotoId) : -1,
  );

  // A shared link plays within Everything for this visit when the saved
  // collection does not contain it, without overwriting the saved choice.
  const [linkOverride, setLinkOverride] = useState<CollectionId | null>(() => {
    if (linkedIndex < 0) return null;
    const saved = resolveCollection(preferences.collectionId, {
      assets,
      chronological,
      favorites,
      today,
    });
    return saved.members.includes(linkedIndex) ? null : "all";
  });
  const collectionId = linkOverride ?? preferences.collectionId;
  const { setCollectionId: saveCollectionId } = preferences;
  const setCollectionId = useCallback(
    (id: CollectionId) => {
      setLinkOverride(null);
      saveCollectionId(id);
    },
    [saveCollectionId],
  );

  // Only the collections that depend on favorites or today recompute.
  const favoritesKey = collectionId === "favorites" ? favorites : NO_FAVORITES;
  const todayKey = collectionId === "on-this-day" ? today : "";
  const chosen = useMemo(
    () =>
      resolveCollection(collectionId, {
        assets,
        chronological,
        favorites: favoritesKey,
        today: todayKey,
      }),
    [assets, chronological, collectionId, favoritesKey, todayKey],
  );
  const everything = useMemo(
    () =>
      resolveCollection("all", {
        assets,
        chronological,
        favorites: NO_FAVORITES,
        today: "",
      }),
    [assets, chronological],
  );
  const collection = chosen.members.length > 0 ? chosen : everything;
  useEffect(() => {
    if (chosen.members.length === 0 && collectionId !== "all") {
      setCollectionId("all");
    }
  }, [chosen.members.length, collectionId, setCollectionId]);

  const onThisDay = useMemo(
    () =>
      resolveCollection("on-this-day", {
        assets,
        chronological,
        favorites: NO_FAVORITES,
        today,
      }),
    [assets, chronological, today],
  );
  const favoriteCount = useMemo(
    () =>
      assets.reduce((count, { id }) => count + Number(favorites.has(id)), 0),
    [assets, favorites],
  );

  // Date order remembers where it left each collection; shuffle always
  // starts a fresh shuffle.
  const [resume, saveResume] = useStoredState<ResumePositions>(
    resumeKey,
    parseResume,
    JSON.stringify,
  );
  const indexById = useMemo(
    () => new Map(assets.map(({ id }, index) => [id, index])),
    [assets],
  );
  const resumeId =
    preferences.order === "chronological" ? resume[collection.id] : undefined;
  const resumeIndex =
    resumeId === undefined ? undefined : indexById.get(resumeId);

  const paused = pausedByUser || libraryOpen;
  const slideshow = useSlideshow({
    assets,
    duration: preferences.duration,
    initialIndex: linkedIndex >= 0 ? linkedIndex : undefined,
    members: collection.members,
    order: preferences.order,
    paused,
    resumeIndex,
  });
  const asset = assets[slideshow.index];
  useEffect(() => {
    if (preferences.order !== "chronological") return;
    if (resume[collection.id] === asset.id) return;
    saveResume({ ...resume, [collection.id]: asset.id });
  }, [asset.id, collection.id, preferences.order, resume, saveResume]);
  const favorite = favorites.has(asset.id);
  const mat = preferences.frame === "mat";
  useWakeLock(preferences.keepAwake && !paused);

  const { held, holdProps } = useChromeHold();
  const chrome = useChromeVisibility(held || menu !== null);

  const showToast = useCallback((text: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2_200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // After its first press, the sound button governs every sound the page
  // makes itself: clip audio and interface sounds alike.
  useEffect(() => {
    setSoundsEnabled(preferences.uiSounds && !quiet);
  }, [preferences.uiSounds, quiet]);

  // Actions the viewer takes make a sound; the timer and song ends do not.
  const togglePause = useCallback(() => {
    cue("press");
    setPausedByUser((value) => !value);
  }, []);
  const goNext = useCallback(() => {
    cue("next");
    slideshow.next();
  }, [slideshow.next]);
  const goPrevious = useCallback(() => {
    cue("previous");
    slideshow.previous();
  }, [slideshow.previous]);
  const toggleFullscreen = useCallback(() => {
    cue("press");
    fullscreen.toggle();
  }, [fullscreen.toggle]);
  const openHelp = useCallback(() => {
    cue("open");
    setHelpOpen(true);
  }, []);
  // Background music and clip sound take turns: clips stay quiet while the
  // music plays, and turning sound on pauses the music. The viewer's own
  // mute choice is kept, so interface sounds still play under the music.
  const music = useMusic();
  const clipsMuted = muted || music.status === "playing";
  const toggleMute = useCallback(() => {
    if (muted) {
      // Unmute first so the switch can be heard; mute after it plays.
      setSoundsEnabled(preferences.uiSounds);
      cue("switchOn");
      if (music.status === "playing") music.pause();
    } else {
      cue("switchOff");
      setSoundsEnabled(false);
    }
    setMuted(!muted);
    setQuiet(!muted);
  }, [music.pause, music.status, muted, preferences.uiSounds]);
  const toggleFavorite = useCallback(() => {
    cue(favorite ? "unfavorite" : "favorite");
    toggleFavoriteId(asset.id);
  }, [asset.id, favorite, toggleFavoriteId]);

  const share = useCallback(async () => {
    const url = new URL("/", window.location.origin);
    url.searchParams.set("photo", asset.id);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse && navigator.share) {
      try {
        await navigator.share({ title: "Kiana", url: url.href });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    const copied = await copyText(url.href);
    cue(copied ? "copied" : "error");
    showToast(copied ? "Link copied" : "Couldn’t copy the link");
  }, [asset.id, showToast]);

  const openLibrary = useCallback(() => {
    cue("libraryOpen");
    setMenu(null);
    onOpenLibrary();
  }, [onOpenLibrary]);
  const closeLibrary = useCallback(() => {
    cue("libraryClose");
    onCloseLibrary();
  }, [onCloseLibrary]);

  const openAsset = useCallback(
    (index: number) => {
      cue("pickPhoto");
      if (!collection.members.includes(index)) setCollectionId("all");
      slideshow.jumpTo(index);
      onCloseLibrary();
    },
    [collection.members, onCloseLibrary, setCollectionId, slideshow.jumpTo],
  );

  const playMonth = useCallback(
    (monthKey: string) => {
      cue("select");
      setCollectionId(monthCollectionId(monthKey));
      setPausedByUser(false);
      onCloseLibrary();
    },
    [onCloseLibrary, setCollectionId],
  );

  useGalleryShortcuts(!libraryOpen && !helpOpen && menu === null, {
    onNext: goNext,
    onOpenHelp: openHelp,
    onOpenLibrary: openLibrary,
    onPickFrame: (frame) => {
      cue("select");
      preferences.setFrame(frame);
      showToast(frameLabels[frame]);
    },
    onPrevious: goPrevious,
    onShare: () => void share(),
    onToggleFavorite: toggleFavorite,
    onToggleFullscreen: toggleFullscreen,
    onToggleMute: toggleMute,
    onTogglePause: togglePause,
  });

  // Touch: swipe sideways to move through photos, tap to show the controls.
  const gesture = useRef<{ id: number; time: number; x: number; y: number }>(
    null,
  );
  const ignoresGesture = (target: EventTarget) =>
    target instanceof Element &&
    target.closest("button, a, [role='menu'], [role='dialog']") !== null;

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" || ignoresGesture(event.target)) return;
    gesture.current = {
      id: event.pointerId,
      time: performance.now(),
      x: event.clientX,
      y: event.clientY,
    };
  };
  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) goNext();
      else goPrevious();
      return;
    }
    const tap =
      Math.abs(dx) < TAP_SLOP &&
      Math.abs(dy) < TAP_SLOP &&
      performance.now() - start.time < 400;
    if (!tap) return;
    if (chrome.visible) {
      setMenu(null);
      chrome.sleep();
    } else {
      chrome.wake(4_500);
    }
  };

  const preloads = slideshow.upcoming
    .map((index) => assets[index])
    .filter((upcoming) => upcoming.id !== asset.id);

  return (
    <MotionConfig reducedMotion="user">
      {preloads.map((upcoming) => (
        <link
          as="image"
          href={upcoming.large}
          imageSizes="100vw"
          imageSrcSet={`${upcoming.small} 1280w, ${upcoming.large} 2400w`}
          key={upcoming.id}
          rel="preload"
        />
      ))}
      <main
        aria-label="Kiana photo gallery"
        inert={libraryOpen}
        className={cx(
          "relative isolate h-dvh w-screen touch-pan-y overflow-hidden select-none transition-colors duration-500",
          mat ? "bg-mat" : "bg-ink",
          !chrome.visible && "cursor-none",
        )}
        onDoubleClick={(event) => {
          const mouse = window.matchMedia("(pointer: fine)").matches;
          if (mouse && !ignoresGesture(event.target)) toggleFullscreen();
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <Stage
          assets={assets}
          frame={preferences.frame}
          index={slideshow.index}
          muted={clipsMuted}
          onVideoEnded={slideshow.next}
          onVideoProgress={videoProgress.set}
          paused={paused}
          previousIndex={slideshow.previousIndex}
        />

        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-x-0 top-0 z-10 h-44 bg-[linear-gradient(to_bottom,rgba(10,7,5,.5),transparent)] transition-opacity duration-500",
            chrome.visible && !mat ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-64 bg-[linear-gradient(to_top,rgba(10,7,5,.62),transparent)] transition-opacity duration-500",
            chrome.visible && !mat ? "opacity-100" : "opacity-0",
          )}
        />

        <TopBar
          collectionMenu={
            <CollectionMenu
              collection={collection}
              counts={{
                all: assets.length,
                favorites: favoriteCount,
                onThisDay: {
                  count: onThisDay.members.length,
                  detail: onThisDay.detail,
                },
                years,
              }}
              onOpenChange={(open) => {
                if (open) cue("open");
                setMenu(open ? "collection" : null);
              }}
              onOpenLibrary={openLibrary}
              onSelect={(id) => {
                cue("select");
                setCollectionId(id);
                setPausedByUser(false);
              }}
              open={menu === "collection"}
            />
          }
          holdProps={holdProps}
          mat={mat}
          musicButton={<MusicButton music={music} />}
          onOpenLibrary={openLibrary}
          visible={chrome.visible}
        />

        <Caption
          asset={asset}
          expanded={chrome.visible}
          mat={mat}
          paused={pausedByUser}
          today={today}
        />

        <Dock
          canGoBack={slideshow.canGoBack}
          favorite={favorite}
          fullscreen={fullscreen}
          holdProps={holdProps}
          muted={muted}
          onNext={goNext}
          onPrevious={goPrevious}
          onShare={() => void share()}
          onToggleFavorite={toggleFavorite}
          onToggleFullscreen={toggleFullscreen}
          onToggleMute={toggleMute}
          onTogglePause={togglePause}
          paused={pausedByUser}
          settings={
            <DisplayMenu
              duration={preferences.duration}
              frame={preferences.frame}
              keepAwake={wakeLockSupported ? preferences.keepAwake : null}
              onDurationChange={(duration) => {
                cue("select");
                preferences.setDuration(duration);
              }}
              onFrameChange={(frame) => {
                cue("select");
                preferences.setFrame(frame);
              }}
              onKeepAwakeChange={(keepAwake) => {
                cue(keepAwake ? "switchOn" : "switchOff");
                preferences.setKeepAwake(keepAwake);
              }}
              onOpenChange={(open) => {
                if (open) cue("open");
                setMenu(open ? "display" : null);
              }}
              onOpenHelp={openHelp}
              onOrderChange={(order) => {
                cue("select");
                preferences.setOrder(order);
              }}
              onUiSoundsChange={(on) => {
                // Turning sounds on plays the first one; turning them off
                // plays the last.
                if (on) setSoundsEnabled(!quiet);
                cue(on ? "switchOn" : "switchOff");
                if (!on) setSoundsEnabled(false);
                preferences.setUiSounds(on);
                if (on && quiet) showToast("Turn sound on to hear them");
              }}
              uiSounds={soundsSupported() ? preferences.uiSounds : null}
              open={menu === "display"}
              order={preferences.order}
            />
          }
          visible={chrome.visible}
        />

        <ProgressBar
          duration={preferences.duration}
          mat={mat}
          paused={paused}
          slide={slideshow.slide}
          timed={asset.type !== "video"}
          video={videoProgress}
        />

        <Toast message={toast} />
      </main>

      {/* Kept outside <main>: the desktop wallpaper app stretches every image
          inside it to cover the screen. */}
      <AnimatePresence>
        {libraryOpen ? (
          <Library
            key="library"
            assets={assets}
            chronological={chronological}
            currentIndex={slideshow.index}
            favorites={favorites}
            onClose={closeLibrary}
            onOpenAsset={openAsset}
            onPlayMonth={playMonth}
          />
        ) : null}
      </AnimatePresence>
      <MusicPlayer
        chromeVisible={chrome.visible}
        music={music}
        raised={chrome.visible && !libraryOpen}
      />
      <ShortcutsDialog onClose={() => setHelpOpen(false)} open={helpOpen} />
    </MotionConfig>
  );
}
