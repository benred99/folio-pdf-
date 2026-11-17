import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    environment: "node",
    // The first test in a file that loads the real PDF engine can take several seconds on a slow CI machine.
    testTimeout: 20_000,
  },
});
