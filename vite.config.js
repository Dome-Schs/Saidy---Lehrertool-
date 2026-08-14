import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script",
      strategies: "generateSW",
      workbox: {
        globPatterns: ["**/*.{html,js,css,png,json}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin,
            handler: "NetworkFirst",
            options: {
              cacheName: "saidy-runtime",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      manifest: {
        name: "Saidy – Lehrertool",
        short_name: "Saidy",
        description: "Digitales Lehrertool für Grundschullehrkräfte",
        start_url: ".",
        display: "standalone",
        background_color: "#F4F1E8",
        theme_color: "#4F5844",
        lang: "de",
        orientation: "portrait-primary",
        icons: [
          { src: "icon-180.png", sizes: "180x180", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});
