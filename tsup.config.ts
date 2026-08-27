import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli/index.ts", "src/mcp/server.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  splitting: true,
  sourcemap: true,
  dts: true,
  external: ["bun:sqlite"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
