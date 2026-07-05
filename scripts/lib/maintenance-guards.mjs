import process from "node:process";

export function hasFlag(flag) {
  return process.argv.includes(flag);
}

export function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

export function requireDevelopmentDefault(scriptName) {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production" && process.env.PICOM_ALLOW_PRODUCTION_MAINTENANCE !== "true") {
    throw new Error(`${scriptName} refused to run in production without PICOM_ALLOW_PRODUCTION_MAINTENANCE=true.`);
  }
}

export function requireDestructiveConfirmation(scriptName, confirmFlag) {
  if (process.env.PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE !== "true" || !hasFlag(confirmFlag)) {
    throw new Error(`${scriptName} is destructive. Set PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE=true and pass ${confirmFlag}.`);
  }
}

export function redactConnectionString(value) {
  if (!value) return "[not configured]";
  return value.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:[redacted]@");
}

export function printMaintenanceResult(title, details) {
  console.log(JSON.stringify({ title, timestamp: new Date().toISOString(), ...details }, null, 2));
}
