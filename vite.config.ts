import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // Permitir tráfico local (Ollama, bridges de imagen/TTS/STT) y HMR/WebSocket
  "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
  "block-all-mixed-content",
].join("; ");

const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy": contentSecurityPolicy,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), microphone=(), geolocation=()",
  "X-XSS-Protection": "1; mode=block",
  "X-Permitted-Cross-Domain-Policies": "none",
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 4173,
    host: "localhost",
    headers: securityHeaders,
    strictPort: false,
    middlewareMode: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
    // Optimize chunk sizes and splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libraries in separate chunk
          vendor: ["react", "react-dom"],
          // Third-party utilities
          utils: ["lucide-react"],
        },
      },
    },
    // Reduce chunk size threshold for better code splitting
    chunkSizeWarningLimit: 500,
  },
  preview: {
    headers: securityHeaders,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    globals: true,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react"],
  },
});
