import { readFile } from "node:fs/promises";
const [doc, slo, packageText] = await Promise.all([readFile("docs/observability-slo-dashboards.md", "utf8"), readFile("docs/slo.md", "utf8"), readFile("package.json", "utf8")]);
const checks = [
  [doc.includes("API uptime") && doc.includes("Auth success") && doc.includes("Message send") && doc.includes("Realtime stability") && doc.includes("Upload success") && doc.includes("Crash-free sessions"), "required SLO panels"],
  [doc.includes("rolling 30d") && doc.includes("fast burn page") && doc.includes("slow burn ticket"), "windows and burn alerts"],
  [doc.includes("Missing/stale data displays **unknown**") && doc.includes("data freshness"), "freshness semantics"],
  [doc.includes("Forbidden labels/log payloads") && doc.includes("message/search/voice/screen content") && doc.includes("auth header, token"), "sensitive-label prohibition"],
  [doc.includes("Provider-independent specification only") && doc.includes("not operational evidence"), "no false production claim"],
  [slo.includes("observability-slo-dashboards.md") && packageText.includes('"observability:slo:dashboards:smoke"'), "integration"],
];
const failed=checks.filter(([ok])=>!ok); if(failed.length){for(const[,label]of failed)console.error(`FAIL: ${label}`);process.exit(1);} for(const[,label]of checks)console.log(`PASS: ${label}`);
