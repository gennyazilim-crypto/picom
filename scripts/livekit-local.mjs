import { createHash, randomBytes } from "node:crypto";
import { createSocket } from "node:dgram";
import { chmod, mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const command = process.argv[2] ?? "health";
const isLan = process.argv.includes("--lan");
const runtimeDir = resolve(".tmp/picom-livekit-local");
const cacheDir = resolve(".tmp/picom-livekit-cache/1.13.1");
const credentialsPath = resolve(runtimeDir, "credentials.json");
const configPath = resolve(runtimeDir, "livekit.yaml");
const statePath = resolve(runtimeDir, "state.json");
const logPath = resolve(runtimeDir, "livekit.log");
const templatePath = resolve("infra/livekit/local/livekit.template.yaml");
const containerName = "picom-livekit-local";
const dockerImage = "livekit/livekit-server@sha256:2c6869d2d5ff6c9c0166f47be1c92dad6928bfecfa5e4060a6ece48db8accfa3";
const version = "1.13.1";
const signalPort = readPort("PICOM_LIVEKIT_LOCAL_SIGNAL_PORT", 17880);
const rtcTcpPort = readPort("PICOM_LIVEKIT_LOCAL_RTC_TCP_PORT", 17881);
const rtcUdpPort = readPort("PICOM_LIVEKIT_LOCAL_RTC_UDP_PORT", 17882);
const releaseBase = "https://github.com/livekit/livekit/releases/download/v1.13.1";
const releaseAssets = Object.freeze({
  "win32-x64": { name: "livekit_1.13.1_windows_amd64.zip", sha256: "57afee4cdb044e5fda04c2cc00ca30f4c783bea1f1ea2f483321ce4b9cff4acf" },
  "win32-arm64": { name: "livekit_1.13.1_windows_arm64.zip", sha256: "cd590e6edf240e36f7af0dddc941bfc0a63840ae6ad39570face7500a720a0ca" },
  "linux-x64": { name: "livekit_1.13.1_linux_amd64.tar.gz", sha256: "e9f70e2e44f8fbe1c5ad109087d44964d2afebfccfe0e8282a92215cf332e028" },
  "linux-arm64": { name: "livekit_1.13.1_linux_arm64.tar.gz", sha256: "59245ecffe27d82435d9389e51e9c54e978254eb2290c53d46a81543754d6c59" },
});

function readPort(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error(`${name} must be an unprivileged TCP/UDP port.`);
  return value;
}

function run(executable, args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error && !allowFailure) throw new Error(`${basename(executable)} is unavailable.`);
  if (!allowFailure && result.status !== 0) throw new Error(`${basename(executable)} command failed (${args[0] ?? "run"}).`);
  return result;
}

function docker(args, options) {
  return run("docker", args, options);
}

function containerExists() {
  return docker(["container", "inspect", containerName], { capture: true, allowFailure: true }).status === 0;
}

async function canBindTcp(port) {
  return await new Promise((resolveResult) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolveResult(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(() => resolveResult(true)));
  });
}

async function canBindUdp(port) {
  return await new Promise((resolveResult) => {
    const socket = createSocket("udp4");
    socket.unref();
    socket.once("error", () => resolveResult(false));
    socket.bind(port, "127.0.0.1", () => socket.close(() => resolveResult(true)));
  });
}

async function targetPortsAvailable() {
  return await canBindTcp(signalPort) && await canBindTcp(rtcTcpPort) && await canBindUdp(rtcUdpPort);
}

function privateIpv4(value) {
  const parts = String(value).split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}

function resolveLanAddress() {
  const explicit = process.argv.find((value) => value.startsWith("--lan-address="))?.split("=")[1]
    ?? process.env.PICOM_LIVEKIT_LAN_ADDRESS;
  if (explicit) {
    if (!privateIpv4(explicit)) throw new Error("LAN mode requires an explicit private IPv4 address.");
    return explicit;
  }
  const candidates = Object.values(networkInterfaces()).flat().filter((entry) => entry && entry.family === "IPv4" && !entry.internal && privateIpv4(entry.address));
  if (candidates.length !== 1) throw new Error("LAN address is ambiguous. Use --lan-address=192.168.x.x or PICOM_LIVEKIT_LAN_ADDRESS.");
  return candidates[0].address;
}

async function writePrivateJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600).catch(() => undefined);
}

async function findBinary(directory) {
  const entries = await readdir(directory, { recursive: true });
  const expected = process.platform === "win32" ? "livekit-server.exe" : "livekit-server";
  const relative = entries.find((entry) => basename(String(entry)).toLowerCase() === expected);
  if (!relative) throw new Error("Verified LiveKit archive did not contain the expected server binary.");
  return resolve(directory, String(relative));
}

async function verifyPinnedBinary(binaryPath) {
  const result = run(binaryPath, ["--version"], { capture: true, allowFailure: true });
  const output = `${result.stdout ?? ""} ${result.stderr ?? ""}`;
  if (result.status !== 0 || !output.includes(version)) throw new Error(`Local LiveKit binary is not approved version ${version}.`);
  return binaryPath;
}

async function provisionNativeBinary() {
  if (process.platform === "darwin") {
    const result = run("livekit-server", ["--version"], { capture: true, allowFailure: true });
    if (result.status !== 0 || !`${result.stdout ?? ""} ${result.stderr ?? ""}`.includes(version)) {
      throw new Error(`macOS native mode requires Homebrew livekit-server ${version}; install/pin it or use --provider=docker.`);
    }
    return "livekit-server";
  }
  const asset = releaseAssets[`${process.platform}-${process.arch}`];
  if (!asset) throw new Error(`No approved native LiveKit ${version} asset for ${process.platform}/${process.arch}; use --provider=docker.`);
  const manifestPath = resolve(cacheDir, "verified.json");
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.version === version && manifest.asset === asset.name && manifest.sha256 === asset.sha256) return await verifyPinnedBinary(manifest.binaryPath);
  } catch {
    // Missing or stale cache is reprovisioned from the pinned official release.
  }

  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true, mode: 0o700 });
  const archivePath = resolve(cacheDir, asset.name);
  const response = await fetch(`${releaseBase}/${asset.name}`, { redirect: "follow", signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Official LiveKit ${version} archive download failed (${response.status}).`);
  const archive = Buffer.from(await response.arrayBuffer());
  const actualHash = createHash("sha256").update(archive).digest("hex");
  if (actualHash !== asset.sha256) throw new Error("Official LiveKit archive SHA-256 verification failed.");
  await writeFile(archivePath, archive, { mode: 0o600 });
  const extractedDir = resolve(cacheDir, "extracted");
  await mkdir(extractedDir, { recursive: true, mode: 0o700 });
  run("tar", ["-xf", archivePath, "-C", extractedDir]);
  await rm(archivePath, { force: true });
  const binaryPath = await findBinary(extractedDir);
  await chmod(binaryPath, 0o755).catch(() => undefined);
  await verifyPinnedBinary(binaryPath);
  await writePrivateJson(manifestPath, { version, asset: asset.name, sha256: asset.sha256, binaryPath, source: "official-livekit-github-release" });
  return binaryPath;
}

function selectedProvider() {
  const explicit = process.argv.find((value) => value.startsWith("--provider="))?.split("=")[1]
    ?? process.env.PICOM_LIVEKIT_LOCAL_PROVIDER;
  if (explicit && !["native", "docker"].includes(explicit)) throw new Error("Local provider must be native or docker.");
  if (explicit) return explicit;
  return process.platform === "darwin" ? "native" : "native";
}

async function nativeProcessMatches(state) {
  if (!Number.isInteger(state.pid) || state.pid <= 0 || typeof state.binaryPath !== "string") return false;
  try { process.kill(state.pid, 0); } catch { return false; }
  if (process.platform === "win32") {
    const script = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${state.pid}'; if($p){$p.ExecutablePath+'|'+$p.CommandLine}`;
    const result = run("powershell.exe", ["-NoProfile", "-Command", script], { capture: true, allowFailure: true });
    const output = String(result.stdout ?? "").toLowerCase();
    return result.status === 0 && output.includes(basename(state.binaryPath).toLowerCase()) && output.includes("livekit.yaml");
  }
  if (process.platform === "linux") {
    try {
      const commandLine = (await readFile(`/proc/${state.pid}/cmdline`, "utf8")).replaceAll("\0", " ");
      return commandLine.includes(basename(state.binaryPath)) && commandLine.includes("livekit.yaml");
    } catch { return false; }
  }
  const result = run("ps", ["-p", String(state.pid), "-o", "command="], { capture: true, allowFailure: true });
  return result.status === 0 && String(result.stdout ?? "").includes("livekit-server") && String(result.stdout ?? "").includes("livekit.yaml");
}

async function health({ quiet = false } = {}) {
  let state;
  try { state = JSON.parse(await readFile(statePath, "utf8")); }
  catch { throw new Error("Picom local LiveKit is not initialized. Run npm run livekit:local:start."); }
  if (state.environment !== "development" || state.version !== version || !["native", "docker"].includes(state.provider)) throw new Error("Local LiveKit runtime state is not trusted.");
  if (state.provider === "native") {
    if (!(await nativeProcessMatches(state))) throw new Error("Picom local native LiveKit process is not running or no longer matches its trusted command.");
  } else {
    if (state.containerName !== containerName || state.image !== dockerImage) throw new Error("Local Docker runtime state is not trusted.");
    const inspect = docker(["container", "inspect", "--format", "{{.State.Running}}", containerName], { capture: true, allowFailure: true });
    if (inspect.status !== 0 || inspect.stdout.trim() !== "true") throw new Error("Picom local LiveKit container is not running.");
  }
  const response = await fetch(state.healthUrl, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!response || !response.ok) throw new Error("Picom local LiveKit HTTP health endpoint is unavailable.");
  if (!quiet) console.log(`Picom local LiveKit ${version} is healthy (${state.provider}/${state.mode}, ${state.publicUrl}).`);
  return state;
}

async function stopNative(state) {
  if (!(await nativeProcessMatches(state))) {
    try { process.kill(state.pid, 0); } catch { return; }
    throw new Error("Refusing to stop an unverified process that reused the recorded LiveKit PID.");
  }
  process.kill(state.pid, "SIGTERM");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    try { process.kill(state.pid, 0); } catch { return; }
  }
  if (process.platform === "win32") run("taskkill.exe", ["/PID", String(state.pid), "/T", "/F"], { capture: true });
  else process.kill(state.pid, "SIGKILL");
}

async function stop({ cleanup = false } = {}) {
  let state = null;
  try { state = JSON.parse(await readFile(statePath, "utf8")); } catch { /* no trusted runtime state */ }
  if (state?.provider === "native") await stopNative(state);
  if (state?.provider === "docker" || containerExists()) {
    if (containerExists()) docker(["rm", "--force", containerName]);
  }
  await rm(runtimeDir, { recursive: true, force: true });
  if (cleanup) await rm(resolve(".tmp/livekit-local-e2e"), { recursive: true, force: true });
  let released = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await targetPortsAvailable()) { released = true; break; }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  if (!released) throw new Error("Picom local LiveKit cleanup found a target port still in use. The unrelated process was not modified.");
  console.log(`Picom local LiveKit ${cleanup ? "cleanup" : "stop"} completed; target ports are released.`);
}

async function startNative(baseState, binaryPath, hostBind, nodeIp) {
  const logHandle = await open(logPath, "a", 0o600);
  const child = spawn(binaryPath, ["--config", configPath, "--bind", hostBind, "--node-ip", nodeIp], {
    cwd: process.cwd(),
    detached: true,
    windowsHide: true,
    stdio: ["ignore", logHandle.fd, logHandle.fd],
  });
  await new Promise((resolveSpawn, reject) => {
    child.once("spawn", resolveSpawn);
    child.once("error", reject);
  });
  child.unref();
  await logHandle.close();
  await writePrivateJson(statePath, { ...baseState, provider: "native", pid: child.pid, binaryPath });
}

async function startDocker(baseState, hostBind, nodeIp) {
  docker(["version"], { capture: true });
  const imageInspect = docker(["image", "inspect", dockerImage], { capture: true, allowFailure: true });
  if (imageInspect.status !== 0) docker(["pull", dockerImage]);
  const mountSource = configPath.replaceAll("\\", "/");
  const result = docker([
    "run", "--detach", "--name", containerName, "--restart", "no",
    "--label", "com.picom.environment=local-development", "--label", "com.picom.owner=picom-livekit-local",
    "--publish", `${hostBind}:${signalPort}:${signalPort}/tcp`,
    "--publish", `${hostBind}:${rtcTcpPort}:${rtcTcpPort}/tcp`,
    "--publish", `${hostBind}:${rtcUdpPort}:${rtcUdpPort}/udp`,
    "--mount", `type=bind,source=${mountSource},target=/etc/picom/livekit.yaml,readonly`,
    dockerImage, "--config", "/etc/picom/livekit.yaml", "--bind", "0.0.0.0", "--node-ip", nodeIp,
  ], { capture: true, allowFailure: true });
  if (result.status !== 0) throw new Error("Picom local LiveKit container failed to start. Secret-bearing logs were not printed.");
  await writePrivateJson(statePath, { ...baseState, provider: "docker", containerName, image: dockerImage });
}

async function start() {
  try { await health(); return; } catch { /* start or repair the isolated runtime */ }
  let staleState = false;
  try { await stat(statePath); staleState = true; } catch { /* absent */ }
  if (staleState || containerExists()) await stop().catch((error) => { throw error; });
  if (!(await targetPortsAvailable())) throw new Error("A Picom local LiveKit target port is already in use. No process was stopped.");

  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  await chmod(runtimeDir, 0o700).catch(() => undefined);
  const apiKey = `picomdev_${randomBytes(8).toString("hex")}`;
  const apiSecret = randomBytes(32).toString("base64url");
  const mode = isLan ? "lan" : "loopback";
  const nodeIp = isLan ? resolveLanAddress() : "127.0.0.1";
  const hostBind = isLan ? "0.0.0.0" : "127.0.0.1";
  const publicHost = isLan ? nodeIp : "127.0.0.1";
  const template = await readFile(templatePath, "utf8");
  const config = template
    .replaceAll("__PICOM_SIGNAL_PORT__", String(signalPort))
    .replaceAll("__PICOM_RTC_TCP_PORT__", String(rtcTcpPort))
    .replaceAll("__PICOM_RTC_UDP_PORT__", String(rtcUdpPort))
    .replaceAll("__PICOM_LOCAL_API_KEY__", apiKey)
    .replaceAll("__PICOM_LOCAL_API_SECRET__", apiSecret);
  await writeFile(configPath, config, { encoding: "utf8", mode: 0o600 });
  await chmod(configPath, 0o600).catch(() => undefined);
  await writePrivateJson(credentialsPath, { environment: "development", scope: "PICOM_LOCAL_DEVELOPMENT_ONLY", doNotPromote: true, apiKey, apiSecret });
  const publicUrl = `ws://${publicHost}:${signalPort}`;
  const baseState = {
    environment: "development", mode, version, publicUrl, healthUrl: `http://${publicHost}:${signalPort}`,
    ports: { signal: signalPort, rtcTcp: rtcTcpPort, rtcUdp: rtcUdpPort }, createdAt: new Date().toISOString(),
  };

  const provider = selectedProvider();
  try {
    if (provider === "native") await startNative(baseState, await provisionNativeBinary(), hostBind, nodeIp);
    else await startDocker(baseState, hostBind, nodeIp);
  } catch (error) {
    await stop().catch(() => undefined);
    throw error;
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    try {
      const state = await health({ quiet: true });
      console.log(`Picom local LiveKit ${version} started in ${state.provider}/${mode} mode at ${state.publicUrl}.`);
      console.log("Renderer development values: VITE_LIVEKIT_ENABLED=true and VITE_LIVEKIT_URL set to the URL above.");
      return;
    } catch { /* bounded startup */ }
  }
  await stop().catch(() => undefined);
  throw new Error("Picom local LiveKit did not become healthy within 20 seconds. Runtime logs remain local and uncommitted.");
}

if (command === "start") await start();
else if (command === "health") await health();
else if (command === "stop") await stop();
else if (command === "cleanup") await stop({ cleanup: true });
else throw new Error("Usage: node scripts/livekit-local.mjs <start|health|stop|cleanup> [--provider=native|docker] [--lan] [--lan-address=PRIVATE_IPV4]");
