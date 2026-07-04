import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const preferredPort = Number.parseInt(process.env.PICOM_DEV_PORT ?? "5173", 10);
const maxPortAttempts = 20;

let viteProcess;
let electronProcess;
let shuttingDown = false;

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findAvailablePort(startPort) {
  for (let offset = 0; offset < maxPortAttempts; offset += 1) {
    const port = startPort + offset;

    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available dev server port found from ${startPort} to ${startPort + maxPortAttempts - 1}.`);
}

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryRequest = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for Vite dev server at ${url}.`));
          return;
        }

        setTimeout(tryRequest, 250);
      });

      request.setTimeout(1000, () => {
        request.destroy();
      });
    };

    tryRequest();
  });
}

function killProcess(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill();
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  killProcess(electronProcess);
  killProcess(viteProcess);
  process.exitCode = exitCode;
}

async function main() {
  const port = await findAvailablePort(preferredPort);
  const devServerUrl = `http://${host}:${port}`;

  console.log(`[picom:electron-dev] Starting renderer at ${devServerUrl}`);

  viteProcess = spawn(
    commandName("npm"),
    ["run", "renderer:dev", "--", "--port", String(port), "--strictPort"],
    {
      cwd: projectRoot,
      env: { ...process.env },
      shell: process.platform === "win32",
      stdio: "inherit",
    },
  );

  viteProcess.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[picom:electron-dev] Renderer dev server exited with code ${code ?? "unknown"}.`);
      shutdown(code ?? 1);
    }
  });

  await waitForServer(devServerUrl);

  console.log("[picom:electron-dev] Starting Electron desktop shell");

  const electronBin = path.join(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron.cmd" : "electron",
  );

  electronProcess = spawn(electronBin, ["."], {
    cwd: projectRoot,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devServerUrl,
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  electronProcess.on("exit", (code) => {
    if (!shuttingDown) {
      console.log(`[picom:electron-dev] Electron exited with code ${code ?? 0}.`);
      shutdown(code ?? 0);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(`[picom:electron-dev] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});
