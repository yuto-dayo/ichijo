/// <reference lib="webworker" />
/* eslint-disable no-underscore-dangle */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const appShellHandler = createHandlerBoundToURL("/index.html");
const navigationRoute = new NavigationRoute(appShellHandler, {
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

registerRoute(
  ({ request }) => ["script", "style", "worker"].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: "static-assets",
  })
);

registerRoute(
  ({ request }) => ["image", "font"].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: "media-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
        purgeOnQuotaError: true,
      }),
    ],
  })
);
