import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on port 8000; the proxy keeps the browser on one origin and lets the event streams through.
// The host is pinned to IPv4: on this machine the IPv6 loopback ("localhost" resolves to ::1) accepts connections but never answers.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
});
