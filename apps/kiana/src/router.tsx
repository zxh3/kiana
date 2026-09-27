import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    // The library opens on the photo that is playing, so the router must not
    // put back where its grid was scrolled the last time it was open.
    scrollRestoration: ({ location }) => {
      const search: { view?: string } = location.search;
      return search.view !== "library";
    },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
