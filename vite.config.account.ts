import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import {
  createDevelopmentCsp,
  createProductionCsp,
} from "./vite.config";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), display-capture=(), geolocation=(), payment=(), usb=()",
};

function cspPlugin(content: string): Plugin {
  return {
    name: "picom-account-content-security-policy",
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

/** Emit index.account.html as dist/account/index.html for SPA hosting. */
function renameAccountIndexPlugin(): Plugin {
  return {
    name: "picom-rename-account-index",
    enforce: "post",
    generateBundle(_options, bundle) {
      const entry = bundle["index.account.html"];
      if (entry && entry.type === "asset") {
        entry.fileName = "index.html";
      }
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.url ?? "/";
        const pathOnly = raw.split("?")[0] ?? "/";
        const isAsset =
          pathOnly.startsWith("/@")
          || pathOnly.startsWith("/src/")
          || pathOnly.startsWith("/node_modules/")
          || pathOnly.startsWith("/assets/")
          || pathOnly.startsWith("/icons/")
          || pathOnly.includes(".")
          || pathOnly === "/index.account.html";
        if (!isAsset) {
          req.url = `/index.account.html${raw.includes("?") ? `?${raw.split("?")[1]}` : ""}`;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.url ?? "/";
        const pathOnly = raw.split("?")[0] ?? "/";
        const isAsset = pathOnly.includes(".") || pathOnly.startsWith("/assets/");
        if (!isAsset) {
          req.url = `/${raw.includes("?") ? `index.html?${raw.split("?")[1]}` : "index.html"}`;
        }
        next();
      });
    },
  };
}

/**
 * Account Center Vite config (account.picom.gg).
 * Desktop uses vite.config.ts; web uses vite.config.web.ts.
 */
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const csp = command === "serve" ? createDevelopmentCsp(env) : createProductionCsp(env);

  return {
    base: "/",
    root: process.cwd(),
    publicDir: "public",
    plugins: [cspPlugin(csp), react(), renameAccountIndexPlugin()],
    build: {
      outDir: "dist/account",
      emptyOutDir: true,
      manifest: true,
      cssCodeSplit: true,
      target: "chrome120",
      rollupOptions: {
        input: {
          main: resolve(process.cwd(), "index.account.html"),
        },
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5175,
      strictPort: true,
      headers: SECURITY_HEADERS,
    },
    preview: {
      host: "127.0.0.1",
      port: 4175,
      headers: SECURITY_HEADERS,
    },
  };
});
