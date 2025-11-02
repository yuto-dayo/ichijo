import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: "auto",
      registerType: "autoUpdate",
      workbox: {
        skipWaiting: false,
        clientsClaim: false,
      },
      devOptions: {
        enabled: false,
      },
      includeAssets: ["icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "きそきゅう ひょうそう てすと",
        short_name: "きそきゅう",
        description: "きそきゅう ひょうそう てすと を オフラインでも 学習できる PWA 版",
        lang: "ja-JP",
        theme_color: "#0f172a",
        background_color: "#020617",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
