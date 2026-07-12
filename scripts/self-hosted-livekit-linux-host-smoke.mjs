import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const prepare = read("infra/livekit/host/prepare-host.sh");
const prerequisites = read("infra/livekit/host/host-prerequisites.sh");
const rollback = read("infra/livekit/host/rollback-host.sh");
const versions = read("infra/livekit/host/versions.env.example");
const ssh = read("infra/livekit/host/99-picom-livekit-sshd.conf");
const docs = read("docs/self-hosted-livekit-linux-host-hardening.md");

const checks = [
  ["Ubuntu 24.04 x86_64 inventory", versions.includes("PICOM_TARGET_OS_VERSION=24.04") && versions.includes("PICOM_TARGET_ARCH=x86_64")],
  ["pinned Docker package inputs required", ["PICOM_DOCKER_CE_VERSION", "PICOM_DOCKER_CE_CLI_VERSION", "PICOM_CONTAINERD_VERSION", "PICOM_BUILDX_VERSION", "PICOM_COMPOSE_VERSION"].every((term) => prepare.includes(term))],
  ["official Docker apt repository", prepare.includes("https://download.docker.com/linux/ubuntu") && prepare.includes("Signed-By: /etc/apt/keyrings/docker.asc")],
  ["non-root identities without docker group", prepare.includes("useradd --system") && prepare.includes("picom-deploy") && prepare.includes("do not add picom-deploy to the root-equivalent docker group")],
  ["strict secret boundary", prepare.includes("/etc/picom-livekit/secrets") && prepare.includes("chmod 0640") && prepare.includes("-m 0750")],
  ["SSH fail-safe confirmation", prepare.includes("I_HAVE_VERIFIED_KEY_LOGIN") && ssh.includes("PasswordAuthentication no") && prepare.includes("sshd -t")],
  ["firewall fail-safe and no media opens", prepare.includes("I_HAVE_CONSOLE_ACCESS") && prepare.includes("default deny incoming") && !/ufw allow[^\n]+(788|3478|50000)/.test(prepare)],
  ["security updates and time sync", prepare.includes("unattended-upgrades") && prepare.includes("chrony")],
  ["disk alert and log rotation", prepare.includes("picom-livekit-host-health.timer") && prepare.includes("picom-livekit-logrotate")],
  ["redacted host evidence", prerequisites.includes("hostnameIncluded:false") && prerequisites.includes("ipAddressesIncluded:false") && prerequisites.includes("secretsIncluded:false")],
  ["throughput remains explicit", prerequisites.includes("blocked_missing_controlled_iperf3_target") && prerequisites.includes("STAGING_ONLY")],
  ["rollback preserves data", rollback.includes("Docker packages, images, and volumes were preserved") && !rollback.includes("rm -rf /var/lib/docker")],
  ["truthful external blocker", docs.includes("BLOCKED_PENDING_REAL_LINUX_HOST_EXECUTION")],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Self-hosted LiveKit Linux host hardening contract passed.");
