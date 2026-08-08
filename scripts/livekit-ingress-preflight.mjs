#!/usr/bin/env node
/**
 * Preflight for Picom LiveKit Ingress (TASK27).
 * Checks VPS docker presence for picom-livekit, redis, ingress, and port 1935.
 * Does not print secrets.
 *
 * Env:
 *   PICOM_LIVEKIT_SSH_HOST (default: picom-update-server)
 *   PICOM_LIVEKIT_SSH_USER (optional; host alias usually embeds user)
 *   PICOM_LIVEKIT_CONFIG_DIR (default: /home/picom/.config/picom/livekit)
 *   PICOM_INGEST_HOST (default: 23.254.166.240)
 *   SKIP_SSH=1 to only run local/network checks against LIVEKIT_URL
 */
import { spawnSync } from "node:child_process";
import { connect as connectTcp } from "node:net";

const timeoutMs = 5_000;
const sshHost = (process.env.PICOM_LIVEKIT_SSH_HOST || "picom-update-server").trim();
// Host alias picom-update-server already encodes user; leave empty unless overridden.
const sshUser = (process.env.PICOM_LIVEKIT_SSH_USER || "").trim();
const skipSsh = process.env.SKIP_SSH === "1";
// ingest.picom.gg DNS is not published yet; default to the production VPS public IP.
const ingestHost = (process.env.PICOM_INGEST_HOST || "23.254.166.240").trim();
const livekitConfigDir = (
  process.env.PICOM_LIVEKIT_CONFIG_DIR || "/home/picom/.config/picom/livekit"
).replace(/\/$/, "");
const report = {
  status: "blocked",
  deployment: "self_hosted_ingress",
  checks: [],
  manualChecks: [
    "CreateIngress via livekit-ingress edge returns url+streamKey once",
    "OBS publish to RTMP URL with revealed stream key",
    "ingress_started webhook transitions publisher stream to PUBLISHING/GOOD",
    "ingress_ended webhook transitions to DISCONNECTED",
  ],
};

function check(name, ok, detail) {
  report.checks.push({ name, ok, detail });
  if (!ok) process.exitCode = 1;
}

function tcpCheck(hostname, port) {
  return new Promise((resolve, reject) => {
    const socket = connectTcp({ host: hostname, port });
    const finish = (error) => {
      socket.destroy();
      error ? reject(error) : resolve();
    };
    socket.setTimeout(timeoutMs, () => finish(new Error("connection timed out")));
    socket.once("connect", () => finish());
    socket.once("error", finish);
  });
}

function ssh(remoteCommand) {
  const target = sshUser ? `${sshUser}@${sshHost}` : sshHost;
  const result = spawnSync(
    "ssh",
    ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", target, remoteCommand],
    { encoding: "utf8", timeout: 20_000 },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim() || `ssh exit ${result.status}`;
    throw new Error(err.slice(0, 240));
  }
  return (result.stdout || "").trim();
}

if (!skipSsh) {
  try {
    const dockerPs = ssh(
      "docker ps --format '{{.Names}}\\t{{.Status}}' | grep -E 'picom-livekit|picom-livekit-redis|picom-livekit-ingress' || true",
    );
    const names = new Set(
      dockerPs
        .split("\n")
        .map((line) => line.split("\t")[0]?.trim())
        .filter(Boolean),
    );
    check("picom-livekit container", names.has("picom-livekit"), names.has("picom-livekit") ? "running" : "missing");
    check(
      "picom-livekit-redis container",
      names.has("picom-livekit-redis"),
      names.has("picom-livekit-redis") ? "running" : "missing",
    );
    const ingressPresent = names.has("picom-livekit-ingress");
    check(
      "picom-livekit-ingress container",
      ingressPresent,
      ingressPresent ? "present" : "absent",
    );

    const listen1935 = ssh(
      "ss -lnt | awk '{print $4}' | grep -Eq '(:|\\.)1935$' && echo yes || echo no",
    );
    check(
      "TCP 1935 listening",
      ingressPresent ? listen1935 === "yes" : listen1935 === "no" || listen1935 === "yes",
      ingressPresent
        ? listen1935 === "yes"
          ? "RTMP port open"
          : "ingress present but 1935 not listening"
        : listen1935 === "yes"
          ? "1935 open without named ingress container"
          : "1935 closed (ingress not deployed yet)",
    );

    const composeHasIngress = ssh(
      `test -f ${livekitConfigDir}/docker-compose.yaml && grep -Eq 'ingress:|picom-livekit-ingress' ${livekitConfigDir}/docker-compose.yaml && echo yes || echo no`,
    );
    check(
      "compose ingress service",
      !ingressPresent || composeHasIngress === "yes",
      composeHasIngress === "yes" ? "defined" : "not yet in compose",
    );

    const livekitYamlHasIngress = ssh(
      `test -f ${livekitConfigDir}/livekit.yaml && grep -q 'rtmp_base_url' ${livekitConfigDir}/livekit.yaml && echo yes || echo no`,
    );
    check(
      "livekit.yaml ingress URLs",
      !ingressPresent || livekitYamlHasIngress === "yes",
      livekitYamlHasIngress === "yes" ? "rtmp_base_url present" : "rtmp_base_url not configured yet",
    );

    // Confirm ingress.yaml exists and is mode 600/400 without reading secret values.
    const ingressCfg = ssh(
      `if [ -f ${livekitConfigDir}/ingress.yaml ]; then stat -c '%a' ${livekitConfigDir}/ingress.yaml; else echo missing; fi`,
    );
    check(
      "ingress.yaml permissions",
      ingressCfg === "missing" || ingressCfg === "600" || ingressCfg === "400",
      ingressCfg === "missing" ? "not created yet" : `mode ${ingressCfg}`,
    );

    const ufw1935 = ssh("sudo ufw status | grep -E '1935/tcp' | head -1 || true");
    check(
      "UFW allows 1935/tcp",
      !ingressPresent || /ALLOW/i.test(ufw1935),
      ufw1935 || "no ufw rule",
    );
  } catch (error) {
    check("ssh preflight", false, error instanceof Error ? error.message : "ssh failed");
  }
} else {
  check("ssh preflight", true, "skipped via SKIP_SSH=1");
}

try {
  await tcpCheck(ingestHost, 1935);
  check(`public RTMP ${ingestHost}:1935`, true, "TCP connect ok");
} catch {
  const ingressCheckSoft = report.checks.find((item) => item.name === "picom-livekit-ingress container");
  const ingressPresentSoft = Boolean(ingressCheckSoft && String(ingressCheckSoft.detail).includes("present"));
  // Before ingress is deployed, public :1935 is expected to fail — report but do not block.
  check(
    `public RTMP ${ingestHost}:1935`,
    !ingressPresentSoft,
    ingressPresentSoft
      ? "TCP connect failed while ingress container is present"
      : "TCP connect failed (expected until ingress is deployed / DNS points at VPS)",
  );
}

const liveKitUrl = (process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || "wss://voice.picom.gg").trim();
try {
  const url = new URL(liveKitUrl);
  check("LIVEKIT_URL protocol", url.protocol === "wss:" || url.protocol === "https:", url.protocol);
  check("LIVEKIT_URL host", Boolean(url.hostname), url.hostname || "missing");
} catch {
  check("LIVEKIT_URL", false, "invalid URL");
}

const ingressCheck = report.checks.find((item) => item.name === "picom-livekit-ingress container");
const ingressPresent = Boolean(ingressCheck?.ok && String(ingressCheck.detail).includes("present"));
report.status = report.checks.every((item) => item.ok)
  ? ingressPresent
    ? "ingress_preflight_passed"
    : "baseline_ready_ingress_absent"
  : "blocked";

console.log(JSON.stringify(report, null, 2));
if (report.status === "blocked") process.exitCode = 1;
