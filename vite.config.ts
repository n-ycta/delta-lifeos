import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  optimizeDeps: {entries: ["index.html"]},
  build: { target: "es2022" },
  server: { fs: { allow: [".."] } },
});
