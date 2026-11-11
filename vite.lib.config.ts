import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds only the embeddable renderer. React and Zod are peer dependencies,
// so the host app's copies are used.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-lib",
    emptyOutDir: true,
    copyPublicDir: false,
    lib: {
      entry: "src/renderer/index.ts",
      formats: ["es"],
      fileName: "renderer",
      cssFileName: "renderer",
    },
    rolldownOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "zod"],
    },
  },
});
