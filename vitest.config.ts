import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // File test integrasi berbagi satu database & memakai TRUNCATE di beforeEach.
    // Jalankan file test secara berurutan agar tidak saling menghapus data.
    fileParallelism: false,
  },
});
