import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const exampleFiles = [".env.example", ".env.beta.example", ".env.production.example"];
const serverOnlyNames = new Set([
  "SUPABASE_PROJECT_REF",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET"
]);
const forbiddenRendererName = /VITE_.*(?:SERVICE_ROLE|ACCESS_TOKEN|API_SECRET|DATABASE|PASSWORD|SIGNING|PRIVATE_KEY|OAUTH.*SECRET)/i;
const secretLikeValues = [
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
  /\bsb_secret_[a-zA-Z0-9_-]{12,}\b/i,
  /\bsk-[a-zA-Z0-9_-]{16,}\b/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
  /\b(?:postgres|postgresql):\/\/[^\s:]+:[^\s@]+@/i
];

function parseExample(file) {
  const filePath = resolve(root, file);
  if (!existsSync(filePath)) throw new Error(`Missing environment example: ${file}`);

  const text = readFileSync(filePath, "utf8");
  for (const pattern of secretLikeValues) {
    if (pattern.test(text)) throw new Error(`${file} contains a secret-like value.`);
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator < 1) throw new Error(`${file} contains an invalid environment line.`);
      return { name: line.slice(0, separator), value: line.slice(separator + 1) };
    });
}

for (const file of exampleFiles) {
  for (const { name, value } of parseExample(file)) {
    if (forbiddenRendererName.test(name)) {
      throw new Error(`${file} exposes a server-only variable through the renderer prefix: ${name}`);
    }

    if (serverOnlyNames.has(name) && value !== "") {
      throw new Error(`${file} must leave server/CI placeholder ${name} empty.`);
    }

    if (name === "VITE_SUPABASE_ANON_KEY" && value && !/^YOUR_[A-Z0-9_]+$/.test(value)) {
      throw new Error(`${file} must use an obvious fake anon-key placeholder.`);
    }
  }
}

const gitignore = readFileSync(resolve(root, ".gitignore"), "utf8").split(/\r?\n/);
for (const required of [".env", ".env.local", ".env.production", ".env.*.local"]) {
  if (!gitignore.includes(required)) throw new Error(`.gitignore must protect ${required}.`);
}

console.log("OK environment examples contain placeholders only");
console.log("OK renderer and server secret names remain separated");
console.log("OK local and production environment files are gitignored");
