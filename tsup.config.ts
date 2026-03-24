import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      types: "src/types/index.ts",
      hooks: "src/hooks/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["react"],
    splitting: true,
    treeshake: true,
  },
]);
