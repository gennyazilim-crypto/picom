/**
 * Hosted / provider canary gate runner — fail-closed.
 * Does not invent provider events. Exits non-zero when external gates are unavailable.
 */
import process from "node:process";

const gates = [
  ["HOSTED_RLS", "BLOCKED", "Real JWT matrix not executed under production mutation guard"],
  ["HOSTED_STORAGE", "BLOCKED", "Hosted storage + malware E2E not executed"],
  ["EDGE_FUNCTION_DEPLOY", "BLOCKED", "Production deploy not authorized"],
  ["STRIPE_BILLING_TEST_MODE_E2E", "BLOCKED", "Stripe test-mode secrets/checkout not evidenced"],
  ["STRIPE_IDENTITY_E2E", "BLOCKED", "Identity provider test-mode not evidenced"],
  ["PAYOUT_PROVIDER_TEST_MODE_E2E", "BLOCKED", "Payout provider test-mode not evidenced"],
  ["REAL_PAYOUT_SEND", "NOT_DONE", "ALLOW_REAL_PAYOUT_CANARY not set"],
  ["TAX_VERIFICATION_E2E", "BLOCKED", "Tax provider not evidenced"],
  ["EMAIL_DELIVERY_E2E", "PARTIAL", "Mailbox receipt not verified; SMTP accepted alone is insufficient"],
  ["HOSTED_WORKER_E2E", "BLOCKED", "Worker images/digests not built; Docker engine down"],
  ["MALWARE_SCANNER_E2E", "BLOCKED", "Scanner E2E not evidenced"],
  ["LEGAL_COPY_ACTIVE", "LEGAL_COPY_REQUIRED", "No real active legal approval evidence"],
];

let blocked = 0;
for (const [name, status, reason] of gates) {
  console.log(`${name}=${status}`);
  console.log(`REASON=${reason}`);
  if (status === "BLOCKED" || status === "LEGAL_COPY_REQUIRED") blocked += 1;
}

console.log(`BLOCKED_GATE_COUNT=${blocked}`);
console.log("REAL_PAYOUT_SEND=NOT_DONE");
process.exit(blocked > 0 ? 2 : 0);
