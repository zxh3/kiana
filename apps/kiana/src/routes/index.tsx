import {
  ClientOnly,
  createFileRoute,
  type ErrorComponentProps,
  useRouter,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Gallery } from "../components/gallery";
import { loadGalleryAssets } from "../data/photos";

type GallerySearch = {
  /** A shared photo to open first. */
  photo?: string;
  view?: "library";
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): GallerySearch => ({
    photo:
      typeof search.photo === "string" && search.photo
        ? search.photo
        : undefined,
    view: search.view === "library" ? "library" : undefined,
  }),
  loader: loadGalleryAssets,
  // The manifest is large and changes only with a new release, so opening
  // the library or a shared link must not fetch it again.
  shouldReload: false,
  staleTime: Number.POSITIVE_INFINITY,
  head: ({ loaderData, match }) => {
    const shared = match.search.photo
      ? loaderData?.find(({ id }) => id === match.search.photo)
      : undefined;
    const description = loaderData
      ? `${loaderData.length.toLocaleString("en-US")} photos and videos of Kiana.`
      : "Photos and videos of Kiana.";
    return {
      meta: [
        { name: "description", content: description },
        { property: "og:title", content: "Kiana" },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        ...(shared
          ? [
              { property: "og:image", content: shared.small },
              { name: "twitter:card", content: "summary_large_image" },
            ]
          : []),
      ],
    };
  },
  component: Home,
  errorComponent: GalleryError,
});

function Splash() {
  return (
    <main
      aria-label="Kiana photo gallery"
      className="grid h-dvh w-screen place-items-center overflow-hidden bg-ink"
    >
      <span className="animate-breathe font-serif text-[40px] text-paper italic motion-reduce:animate-none">
        Kiana
      </span>
    </main>
  );
}

function Home() {
  const photos = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  // Read the shared photo once, then drop it so later reloads start fresh.
  const [initialPhotoId] = useState(search.photo);
  const pushedLibrary = useRef(false);

  useEffect(() => {
    if (search.photo) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, photo: undefined }),
      });
    }
  }, [navigate, search.photo]);

  useEffect(() => {
    if (search.view !== "library") pushedLibrary.current = false;
  }, [search.view]);

  const openLibrary = useCallback(() => {
    pushedLibrary.current = true;
    void navigate({
      search: (previous) => ({ ...previous, view: "library" }),
    });
  }, [navigate]);

  // Closing steps back when the library was opened here, so the browser's
  // back button and the close button agree.
  const closeLibrary = useCallback(() => {
    if (pushedLibrary.current) {
      pushedLibrary.current = false;
      router.history.back();
      return;
    }
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, view: undefined }),
    });
  }, [navigate, router]);

  return (
    <ClientOnly fallback={<Splash />}>
      <Gallery
        assets={photos}
        initialPhotoId={initialPhotoId}
        libraryOpen={search.view === "library"}
        onCloseLibrary={closeLibrary}
        onOpenLibrary={openLibrary}
      />
    </ClientOnly>
  );
}

function GalleryError({ error }: ErrorComponentProps) {
  return (
    <main className="grid h-dvh w-screen place-items-center bg-ink px-6 text-center text-paper">
      <div className="max-w-md">
        <p className="font-serif text-[44px] leading-none italic">Kiana</p>
        <p className="mt-6 text-[13px] leading-relaxed text-paper/70">
          The photos could not be loaded just now.
        </p>
        <p className="mt-2 text-[11px] text-paper/35">{error.message}</p>
        <button
          className="label mt-8 cursor-pointer rounded-full bg-paper px-5 py-3 text-ink transition-colors hover:bg-white"
          onClick={() => window.location.reload()}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
