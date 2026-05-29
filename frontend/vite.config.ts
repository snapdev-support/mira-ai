import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon.svg", "pwa-maskable.svg"],
      manifest: {
        name: "Mira Verify",
        short_name: "Mira Verify",
        start_url: "/app/verify",
        display: "standalone",
        icons: [
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
          {
            src: "/pwa-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      // Allows navigation fallback for SPA routes when offline.
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackAllowlist: [/^(?!\/__).*/],
      },
      // Lets you test service worker behavior during `pnpm dev`.
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});