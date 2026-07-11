import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const root = process.cwd();
const extensions = new Set([".ts", ".tsx"]);
const walk = (directory, files = []) => { for (const entry of readdirSync(directory)) { const path = resolve(directory, entry); const stat = statSync(path); if (stat.isDirectory()) walk(path, files); else if (extensions.has(extname(path))) files.push(path); } return files; };
const rendererFiles = walk(resolve(root, "src"));
const clientFiles = rendererFiles.filter((file) => /\bcreateClient\s*\(/.test(readFileSync(file, "utf8"))).map((file) => relative(root, file).replaceAll("\\", "/"));
if (clientFiles.length !== 1 || clientFiles[0] !== "src/services/supabase/supabaseClient.ts") throw new Error(`Expected one renderer Supabase client, found: ${clientFiles.join(", ") || "none"}`);

const directEnvReaders = rendererFiles.filter((file) => /import\.meta\.env\.VITE_SUPABASE_(?:URL|ANON_KEY)/.test(readFileSync(file, "utf8"))).map((file) => relative(root, file).replaceAll("\\", "/"));
if (directEnvReaders.length !== 1 || directEnvReaders[0] !== "src/config/appConfig.ts") throw new Error(`Supabase renderer env must be read only by appConfig: ${directEnvReaders.join(", ") || "none"}`);

const client = readFileSync(resolve(root, "src/services/supabase/supabaseClient.ts"), "utf8");
const source = readFileSync(resolve(root, "src/services/dataSourceService.ts"), "utf8");
const types = readFileSync(resolve(root, "src/services/supabase/database.types.ts"), "utf8");
for (const marker of ["SupabaseClient<Database>", "dataSourceService.getSupabaseConfig()", "persistSession: true", "flowType: \"pkce\""]) if (!client.includes(marker)) throw new Error(`Canonical client is missing ${marker}`);
for (const marker of ["Missing VITE_SUPABASE_URL", "Missing VITE_SUPABASE_ANON_KEY", "must use HTTPS", "service-role secret"]) if (!source.includes(marker)) throw new Error(`Mode validation is missing ${marker}`);
for (const marker of ["radio_sessions", "podcast_episodes", "friendships", "direct_messages", "profile_privacy_settings", "authorize_livekit_room", "authorize_livekit_voice_moderation", "record_livekit_voice_moderation"]) if (!types.includes(marker)) throw new Error(`Committed renderer-facing types are missing ${marker}`);
if (/SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i.test(client)) throw new Error("Server-only credentials crossed into the renderer client.");
if (readFileSync(resolve(root, "src/services/webhookService.ts"), "utf8").includes("import.meta.env.VITE_SUPABASE_URL")) throw new Error("webhookService bypasses centralized configuration.");
console.log("Supabase client, environment, and renderer-facing type contract passed.");
