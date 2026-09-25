import {
  ClientOnly,
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { AdminPage } from "../components/admin/admin-page";
import { loadAdminPhotos } from "../data/gallery";

export const Route = createFileRoute("/admin")({
  // Null for anyone but an admin, who is asked to sign in instead.
  loader: () => loadAdminPhotos(),
  // What is hidden changes as admins work, so it is always asked afresh.
  staleTime: 0,
  headers: () => ({ "Cache-Control": "private, no-store" }),
  head: () => ({
    meta: [
      { title: "Admin · Kiana" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRoute,
  errorComponent: AdminError,
});

function AdminRoute() {
  const data = Route.useLoaderData();
  return (
    <ClientOnly fallback={<main className="h-dvh bg-night" />}>
      <AdminPage data={data} />
    </ClientOnly>
  );
}

function AdminError({ error }: ErrorComponentProps) {
  return (
    <main className="grid h-dvh place-items-center bg-night px-6 text-paper">
      <div className="w-full max-w-[340px]">
        <p className="font-serif text-[30px] leading-tight italic">
          The admin page didn’t load.
        </p>
        <p className="mt-3 text-[11px] text-paper/40">{error.message}</p>
        <button
          className="label mt-7 cursor-pointer rounded-full bg-paper px-5 py-3 text-ink transition-colors hover:bg-white"
          onClick={() => window.location.reload()}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
