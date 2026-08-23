import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "node:path";
import {
  createDevelopmentCsp,
  createProductionCsp,
} from "./vite.config";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()",
};

function cspPlugin(content: string): Plugin {
  return {
    name: "picom-web-content-security-policy",
    transformIndexHtml: {
      order: "pre",
      handler: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content },
          injectTo: "head-prepend",
        },
      ],
    },
  };
}

/** Emit index.web.html as dist/web/index.html for SPA hosting. */
function renameWebIndexPlugin(): Plugin {
  return {
    name: "picom-rename-web-index",
    enforce: "post",
    generateBundle(_options, bundle) {
      const entry = bundle["index.web.html"];
      if (entry && entry.type === "asset") {
        entry.fileName = "index.html";
      }
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/" || req.url?.startsWith("/?")) {
          req.url = "/index.web.html";
        }
        next();
      });
    },
  };
}

/**
 * Production web Vite config. Desktop continues to use vite.config.ts (base "./").
 * Do not point Electron at this config.
 */
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const csp = command === "serve" ? createDevelopmentCsp(env) : createProductionCsp(env);

  return {
    base: "/",
    root: process.cwd(),
    publicDir: "public",
    plugins: [
      cspPlugin(csp),
      react(),
      renameWebIndexPlugin(),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "favicon.ico",
          "assets/brand/icons/32x32.png",
          "assets/brand/icons/256x256.png",
          "assets/brand/icons/512x512.png",
        ],
        manifest: {
          name: "Picom",
          short_name: "Picom",
          description: "Picom community chat on the web.",
          theme_color: "#C71225",
          background_color: "#151917",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/assets/brand/icons/256x256.png",
              sizes: "256x256",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/assets/brand/icons/512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
        workbox: {
          // The authenticated desktop/web shell is intentionally code-split but its
          // main entry currently exceeds Workbox's 2 MiB default. Keep the complete
          // signed-out/auth shell available offline instead of failing the release build.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [
            /^\/api/,
            /\/auth\/v1\//,
            /\/rest\/v1\//,
            /\/functions\/v1\//,
            /\/storage\/v1\//,
            /supabase/i,
          ],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith("/api")
                || url.hostname.includes("supabase")
                || url.pathname.includes("/auth/v1/")
                || url.pathname.includes("/rest/v1/")
                || url.pathname.includes("/functions/v1/"),
              handler: "NetworkOnly",
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      outDir: "dist/web",
      emptyOutDir: true,
      manifest: true,
      cssCodeSplit: true,
      target: "chrome120",
      rollupOptions: {
        input: {
          main: resolve(process.cwd(), "index.web.html"),
        },
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      headers: SECURITY_HEADERS,
    },
    preview: {
      host: "127.0.0.1",
      port: 4174,
      headers: SECURITY_HEADERS,
    },
  };
});
