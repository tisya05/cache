import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { viteCommonjs } from "@originjs/vite-plugin-commonjs";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    topLevelAwait(),
    viteCommonjs(),
    nodePolyfills({
      include: ["buffer", "process", "util", "crypto", "stream"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    minify: false,
  },
  server: {
    // cloudflared quick tunnels hand out a new random hostname every
    // restart (see BUILD-SPEC §3) -- allowlisting one specific hostname
    // here would break on the very next restart, so allow any host instead.
    // Fine for a local dev server behind a temporary tunnel; not something
    // to carry into a real deployment.
    allowedHosts: true,
    proxy: {
      // Lets a phone on a different network (behind the tunnel) reach the
      // proof server, which only listens on this machine's localhost:6300.
      // See ui/src/lib/cache-client.ts for the browser side of this.
      "/proof-server": {
        target: "http://localhost:6300",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proof-server/, ""),
      },
    },
  },
});
