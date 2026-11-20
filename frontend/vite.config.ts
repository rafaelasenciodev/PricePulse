import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Where the API is reached by the development server. The backend is started with `WEB_ORIGIN=http://localhost:5173`,
// because the browser sees the origin of this server and the cookie of the Session is set for it.
const apiUrl = process.env["API_URL"] ?? "http://127.0.0.1:3000";

// The paths of the API that the interface uses (design of feature 09, section 5). Nothing under /app/ is forwarded.
const apiPaths = ["/accounts", "/sessions", "/listings", "/price-alerts", "/notifications", "/demo"];

// The interface is served under /app/ (design of feature 09, section 4).
export default defineConfig({
  base: "/app/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(apiPaths.map((path) => [path, { target: apiUrl }])),
  },
});
