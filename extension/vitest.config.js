import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {

    environment: "jsdom",
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["content/**/*.js", "background/**/*.js", "sidepanel/**/*.js"],
      reporter: ["text", "html"],
    },
  },
});