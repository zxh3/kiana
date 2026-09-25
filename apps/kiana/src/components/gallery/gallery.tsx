import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, MotionConfig } from "motion/react";
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { changeHiddenPhotos } from "../../data/gallery";
import type { GalleryAsset } from "../../data/photos";
import { cx } from "../../lib/class-names";
import { cue } from "../../lib/sounds";
import { Caption } from "./caption";
import { CollectionMenu } from "./collection-menu";
import { monthCollectionId } from "./collections";
import { DisplayMenu } from "./display-menu";
import { Dock } from "./dock";
import { FavoriteButton } from "./favorite-button";
import { classifyTouch, type TouchPoint } from "./gesture";
import { Library } from "./library";
import { frameLabels } from "./model";
import { MusicButton, MusicPlayer, useMusic } from "./music";
import { useGalleryPreferences } from "./preferences";
import { ProgressBar } from "./progress-bar";
import { createProgressChannel } from "./progress-channel";
import { parseResume, type ResumePositions, resumeKey } from "./resume";
import { photoLink, shareLink } from "./share";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { SoundMenu } from "./sound/sound-menu";
import { useSoundMix } from "./sound/use-sound-mix";
import { Stage } from "./stage";
import { Toast, useToast } from "./toast";
import { TopBar } from "./top-bar";
import { useAccount } from "./use-account";
import { useChromeHold } from "./use-chrome-hold";
import { useChromeVisibility } from "./use-chrome-visibility";
import { useCollection } from "./use-collection";
import { useFavorites } from "./use-favorites";
import { useFullscreen } from "./use-fullscreen";
import { useGalleryShortcuts } from "./use-gallery-shortcuts";
import { useSlideshow } from "./use-slideshow";
import { useStoredState } from "./use-stored-state";
import { useToday } from "./use-today";
import { useWakeLock, wakeLockSupported } from "./use-wake-lock";

type Menu = "collection" | "display" | "sound" | "favorite" | null;

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
  // Favorites are kept by the account the viewer signed in with.
  const account = useAccount();
  const signedIn = account.status === "member";
  const {
    favorites,
    favoriteAfterSignIn,
    failures: favoriteFailures,
    settled: favoritesSettled,
    toggle: toggleFavoriteId,
  } = useFavorites(account);
  const today = useToday();
  const fullscreen = useFullscreen();
  const [pausedByUser, setPausedByUser] = useState(false);
  const [videoProgress] = useState(createProgressChannel);
  const [menu, setMenu] = useState<Menu>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const { toast, showToast } = useToast();

  const {
    chronological,
    collection,
    favoriteCount,
    linkedIndex,
    onThisDay,
    setCollectionId,
    years,
  } = useCollection({
    assets,
    favorites,
    favoritesSettled,
    initialPhotoId,
    savedId: preferences.collectionId,
    saveId: preferences.setCollectionId,
    today,
  });

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

  // Photos an admin hides here leave the slideshow and the library at
  // once; for everyone else, and on the next visit, the Worker leaves
  // them out.
  const [hiddenHere, setHiddenHere] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const shows = useCallback(
    (index: number) => !hiddenHere.has(assets[index].id),
    [assets, hiddenHere],
  );
  const libraryOrder = useMemo(
    () => (hiddenHere.size === 0 ? chronological : chronological.filter(shows)),
    [chronological, hiddenHere.size, shows],
  );
  // A collection left with nothing shown plays everything that is.
  const members = useMemo(() => {
    if (hiddenHere.size === 0) return collection.members;
    const shown = collection.members.filter(shows);
    return shown.length > 0 ? shown : libraryOrder;
  }, [collection.members, hiddenHere.size, libraryOrder, shows]);

  const paused = pausedByUser || libraryOpen;
  const slideshow = useSlideshow({
    assets,
    duration: preferences.duration,
    initialIndex: linkedIndex >= 0 ? linkedIndex : undefined,
    members,
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

  // The heart already went back; this says why.
  useEffect(() => {
    if (favoriteFailures > 0) showToast("Couldn’t save favorite");
  }, [favoriteFailures, showToast]);

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
  // Three independent sound channels: videos and interface sounds here,
  // music in useMusic. The dock's Sound menu mixes them.
  const music = useMusic();
  const sound = useSoundMix();
  const { on: videosOn, setOn: setVideosOn } = sound.videos;
  const toggleVideoSound = useCallback(
    () => setVideosOn(!videosOn),
    [setVideosOn, videosOn],
  );
  /** A menu's open state, and its switch, which sounds as it opens. */
  const menuProps = (name: NonNullable<Menu>) => ({
    open: menu === name,
    onOpenChange: (open: boolean) => {
      if (open) cue("open");
      setMenu(open ? name : null);
    },
  });

  // A guest's heart asks them to sign in instead.
  const toggleFavorite = useCallback(() => {
    if (!signedIn) {
      cue("open");
      setMenu("favorite");
      return;
    }
    cue(favorite ? "unfavorite" : "favorite");
    toggleFavoriteId(asset.id);
  }, [asset.id, favorite, signedIn, toggleFavoriteId]);
  // Signing in to favorite a photo comes back to it, and favorites it.
  const { signIn } = account;
  const signInToFavorite = useCallback(
    (id: string) => {
      cue("select");
      favoriteAfterSignIn(id);
      void signIn(photoLink(id));
    },
    [favoriteAfterSignIn, signIn],
  );

  // An admin hides the photo on screen, and the slideshow moves on from
  // it, unless it already has while the Worker was asked.
  const hidePhotos = useServerFn(changeHiddenPhotos);
  const shownId = useRef(asset.id);
  shownId.current = asset.id;
  const hidePhoto = useCallback(async () => {
    const { id } = asset;
    try {
      await hidePhotos({ data: { hide: [id], show: [] } });
    } catch {
      cue("error");
      showToast("Couldn’t hide the photo");
      return;
    }
    cue("switchOff");
    if (shownId.current === id) slideshow.next();
    setHiddenHere((current) => new Set(current).add(id));
    showToast("Hidden from the gallery");
  }, [asset, hidePhotos, showToast, slideshow.next]);

  // The share sheet speaks for itself; a copy is confirmed.
  const share = useCallback(async () => {
    const shared = await shareLink(photoLink(asset.id));
    if (shared === "shared" || shared === "cancelled") return;
    const copied = shared === "copied";
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
    onToggleMute: toggleVideoSound,
    onTogglePause: togglePause,
  });

  // Touch: swipe sideways to move through photos, tap to show the controls.
  const gesture = useRef<(TouchPoint & { id: number }) | null>(null);
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
    const touch = classifyTouch(start, {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    });
    if (touch === "next") goNext();
    if (touch === "previous") goPrevious();
    if (touch !== "tap") return;
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
          muted={!sound.videos.on}
          onVideoEnded={slideshow.next}
          onVideoProgress={videoProgress.set}
          paused={paused}
          previousIndex={slideshow.previousIndex}
          volume={sound.videos.volume / 100}
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
              {...menuProps("collection")}
              favoritesLocked={!signedIn}
              onOpenLibrary={openLibrary}
              onSelect={(id) => {
                cue("select");
                setCollectionId(id);
                setPausedByUser(false);
              }}
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
          favoriteButton={
            <FavoriteButton
              account={account.status}
              favorite={favorite}
              {...menuProps("favorite")}
              onSignIn={() => signInToFavorite(asset.id)}
              onToggle={toggleFavorite}
            />
          }
          fullscreen={fullscreen}
          holdProps={holdProps}
          onNext={goNext}
          onPrevious={goPrevious}
          onShare={() => void share()}
          onToggleFullscreen={toggleFullscreen}
          onTogglePause={togglePause}
          paused={pausedByUser}
          sound={
            <SoundMenu mix={sound} music={music} {...menuProps("sound")} />
          }
          settings={
            <DisplayMenu
              admin={
                account.member?.admin
                  ? {
                      onHidePhoto: () => void hidePhoto(),
                      onOpenAdmin: () => window.location.assign("/admin"),
                    }
                  : undefined
              }
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
              {...menuProps("display")}
              onOpenHelp={openHelp}
              onOrderChange={(order) => {
                cue("select");
                preferences.setOrder(order);
              }}
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

      <AnimatePresence>
        {libraryOpen ? (
          <Library
            key="library"
            assets={assets}
            chronological={libraryOrder}
            currentIndex={slideshow.index}
            account={account.status}
            favorites={favorites}
            onClose={closeLibrary}
            onSignIn={() => {
              cue("select");
              void signIn(photoLink(asset.id));
            }}
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
