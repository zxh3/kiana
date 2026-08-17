import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { Gallery } from "../components/gallery";
import { loadGalleryAssets } from "../data/photos";

export const Route = createFileRoute("/")({
  loader: loadGalleryAssets,
  component: Home,
});

function Home() {
  const photos = Route.useLoaderData();

  return (
    <ClientOnly
      fallback={
        <main
          aria-label="Kiana photo gallery"
          className="h-dvh w-screen overflow-hidden bg-[#17120f]"
        />
      }
    >
      <Gallery photos={photos} />
    </ClientOnly>
  );
}
