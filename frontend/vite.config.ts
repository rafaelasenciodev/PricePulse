import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The interface is served under /app/ (design of feature 09, section 4). The development server and its proxy to the API come with the stop that serves the interface.
export default defineConfig({
  base: "/app/",
  plugins: [react()],
});
