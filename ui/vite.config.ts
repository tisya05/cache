import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { viteCommonjs } from "@originjs/vite-plugin-commonjs";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    // vite-plugin-top-level-await removed: its production-build codegen
    // (`generateBundle`) crashes against the installed @swc/core version
    // ("missing field `type`", an internal AST-shape mismatch, not
    // something this project's code triggers). Our build target is
    // already "esnext" -- top-level await is valid syntax there and every
    // target browser (including iOS Safari, what actually matters for
    // this PWA) supports it natively, so the transform this plugin exists
    // to provide isn't needed here.
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
  // `vite preview` (serving the production build) reads this section, NOT
  // `server` above -- duplicated rather than shared because Vite doesn't
  // merge the two. Needed so filming can happen off the production build
  // (no HMR websocket in the mix) while still going through the tunnel.
  preview: {
    allowedHosts: true,
    proxy: {
      "/proof-server": {
        target: "http://localhost:6300",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proof-server/, ""),
      },
    },
  },
});
