import fs from "node:fs";

const source = fs.readFileSync("src/services/apiClient.ts", "utf8");
const doc = fs.readFileSync("docs/api-request-timeout-retry.md", "utf8");
const requiredSource = [
  "DEFAULT_TIMEOUT_MS",
  "AbortSignal",
  "Idempotency-Key",
  "REQUEST_TIMEOUT",
  "NETWORK_ERROR",
  "formatApiClientError",
  "isAuthMutation",
  "shouldRetryStatus",
];
const requiredDoc = [
  "Every generic API request should have a timeout",
  "Safe `GET`/`HEAD` requests may retry automatically",
  "Unsafe `POST`/`PATCH`/`DELETE` requests must not retry automatically unless an idempotency key is present",
  "Login/register/auth mutations should not be retried aggressively",
  "Uploads should not be retried automatically",
  "body size limits",
];

const missingSource = requiredSource.filter((item) => !source.includes(item));
const missingDoc = requiredDoc.filter((item) => !doc.includes(item));
if (missingSource.length > 0 || missingDoc.length > 0) {
  console.error(`API timeout/retry policy missing source=${missingSource.join(", ")} doc=${missingDoc.join(", ")}`);
  process.exit(1);
}

console.log("API timeout and retry policy smoke test passed.");
