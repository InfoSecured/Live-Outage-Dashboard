import { defineConfig, loadEnv } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import { exec } from "node:child_process";
import pino from "pino";

const logger = pino();

const stripAnsi = (str: string) =>
  str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );

const LOG_MESSAGE_BOUNDARY = /\n(?=\[[A-Z][^\]]*\])/g;

const emitLog = (level: "info" | "warn" | "error", rawMessage: string) => {
  const cleaned = stripAnsi(rawMessage).replace(/\r\n/g, "\n");
  const parts = cleaned
    .split(LOG_MESSAGE_BOUNDARY)
    .map((part) => part.trimEnd())
    .filter((part) => part.trim().length > 0);

  if (parts.length === 0) {
    logger[level](cleaned.trimEnd());
    return;
  }

  for (const part of parts) logger[level](part);
};

const customLogger = {
  warnOnce: (msg: string) => emitLog("warn", msg),
  info: (msg: string) => emitLog("info", msg),
  warn: (msg: string) => emitLog("warn", msg),
  error: (msg: string) => emitLog("error", msg),
  hasErrorLogged: () => false,
  clearScreen: () => {},
  hasWarned: false,
};

function watchDependenciesPlugin() {
  return {
    name: "watch-dependencies",
    configureServer(server: any) {
      const filesToWatch = [path.resolve("package.json"), path.resolve("bun.lock")];
      server.watcher.add(filesToWatch);
      server.watcher.on("change", (filePath: string) => {
        if (filesToWatch.includes(filePath)) {
          console.log(`\n📦 Dependency file changed: ${path.basename(filePath)}. Clearing caches...`);
          exec("rm -f .eslintcache tsconfig.tsbuildinfo", (err, _stdout, stderr) => {
            if (err) {
              console.error("Failed to clear caches:", stderr);
              return;
            }
            console.log("✅ Caches cleared successfully.\n");
          });
        }
      });
    },
  };
}

/**
 * Export an async config so we can conditionally import the Cloudflare plugin.
 * This prevents @cloudflare/vite-plugin from being evaluated (and importing miniflare)
 * in environments where it's not installed (e.g., Netlify).
 */
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  // Detect when to enable the Cloudflare plugin.
  // Toggle with any of these:
  //  - CF_PAGES (Cloudflare Pages build env)
  //  - CF_WORKERS (custom flag)
  //  - VITE_USE_CF_PLUGIN=true (local override)
  const useCloudflare =
    !!process.env.CF_PAGES ||
    !!process.env.CF_WORKERS ||
    String(env.VITE_USE_CF_PLUGIN).toLowerCase() === "true";

  const plugins: any[] = [react(), watchDependenciesPlugin()];

  if (useCloudflare) {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(cloudflare());
  }

  return {
    plugins,
    build: {
      minify: true,
      sourcemap: "inline",
      rollupOptions: {
        output: {
          sourcemapExcludeSources: false,
        },
      },
    },
    customLogger: env.VITE_LOGGER_TYPE === "json" ? (customLogger as any) : undefined,
    css: { devSourcemap: true },
    server: { allowedHosts: true },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
      exclude: ["agents"],
      force: true,
    },
    define: {
      global: "globalThis",
    },
    cacheDir: "node_modules/.vite",
  };
});
