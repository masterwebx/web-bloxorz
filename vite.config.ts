import { defineConfig } from "vite";

const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "web-bloxorz";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? `/${repo}/` : "/",
  server: {
    host: true,
    port: 4397,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4397,
    strictPort: true,
  },
});
