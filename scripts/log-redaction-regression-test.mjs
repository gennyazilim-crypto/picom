import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/services/logging/logRedaction.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { redactDiagnosticValue, redactLogString, redactLogValue } = await import(moduleUrl);

const sentinels = [
  "TEST_PASSWORD_VALUE_308",
  "TEST_ACCESS_TOKEN_VALUE_308",
  "TEST_REFRESH_TOKEN_VALUE_308",
  "TEST_AUTH_HEADER_VALUE_308",
  "TEST_COOKIE_VALUE_308",
  "TEST_SESSION_VALUE_308",
  "TEST_SERVICE_ROLE_VALUE_308",
  "TEST_LIVEKIT_SECRET_VALUE_308",
  "TEST_SIGNING_KEY_VALUE_308",
  "TEST_PRIVATE_KEY_VALUE_308",
];

const circular = { label: "safe" };
circular.self = circular;
const metadata = {
  password: sentinels[0],
  profile: {
    accessToken: sentinels[1],
    refresh_token: sentinels[2],
    authorization: `Bearer ${sentinels[3]}`,
    cookie: `session=${sentinels[4]}`,
    sessionToken: sentinels[5],
    supabaseServiceRoleKey: sentinels[6],
    livekitSecret: sentinels[7],
    signingKey: sentinels[8],
    privateKey: sentinels[9],
  },
  nested: [
    `password=${sentinels[0]}&access_token=${sentinels[1]}`,
    `"supabase_service_role":"${sentinels[6]}"`,
    `livekit_secret: ${sentinels[7]}`,
    `Authorization: Basic ${sentinels[3]}`,
    `Cookie: ${sentinels[4]}`,
  ],
  circular,
};

const jwt = "aaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc";
const botToken = "picom_bot_sample_TESTTOKENVALUE01234567890123456789";
const message = `Bearer ${sentinels[3]} encoded ${jwt} token=${sentinels[1]} ${botToken}`;
const error = new Error(`password=${sentinels[0]} livekit_secret=${sentinels[7]}`);
const supportExport = JSON.stringify(redactLogValue({ message: redactLogString(message), metadata, error }));

for (const sentinel of [...sentinels, jwt, botToken]) {
  if (supportExport.includes(sentinel)) throw new Error(`Sensitive sentinel survived redaction: ${sentinel}`);
}
for (const marker of ["[redacted]", "[redacted-jwt]", "[redacted-bot-token]", "[circular]"]) {
  if (!supportExport.includes(marker)) throw new Error(`Expected redaction marker missing: ${marker}`);
}
if (!supportExport.includes('"label":"safe"')) throw new Error("Non-sensitive metadata was removed unexpectedly");

const privateContentSentinel = "PRIVATE_DM_BODY_490";
const diagnosticExport = JSON.stringify(redactDiagnosticValue({ body: privateContentSentinel, nested: { preview: privateContentSentinel, safeStatus: "connected" } }));
if (diagnosticExport.includes(privateContentSentinel) || !diagnosticExport.includes("[redacted-private-content]")) throw new Error("Private content fields survived diagnostics redaction");
if (!diagnosticExport.includes("connected")) throw new Error("Safe diagnostics status was removed unexpectedly");

const diagnostics = fs.readFileSync("src/services/diagnostics/diagnosticsService.ts", "utf8");
if (!diagnostics.includes("loggingService.redactDiagnosticsValue") || !diagnostics.includes("recentLogs")) throw new Error("Support diagnostics export does not pass through logging redaction");

console.log("Log redaction regression test passed.");
