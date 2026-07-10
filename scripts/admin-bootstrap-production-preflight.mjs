const args = Object.fromEntries(process.argv.slice(2).flatMap((item) => {
  const match = item.match(/^--([^=]+)=(.*)$/);
  return match ? [[match[1], match[2]]] : [];
}));
const forbiddenArgs = process.argv.slice(2).filter((item) => /password|token|secret|service.?role|authorization/i.test(item));
if (forbiddenArgs.length) throw new Error("Do not pass passwords, tokens, authorization headers, or service-role values to bootstrap preflight.");
if (!['staging', 'production'].includes(args.environment)) throw new Error("Use --environment=staging or --environment=production.");
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args['user-id'] ?? '')) throw new Error("Use a valid --user-id UUID; email lookup is not accepted.");
if (args.confirm !== 'PICOM_APP_ADMIN_BOOTSTRAP_REVIEWED') throw new Error("Explicit --confirm=PICOM_APP_ADMIN_BOOTSTRAP_REVIEWED is required.");
if (args.environment === 'production' && process.env.PICOM_ALLOW_PRODUCTION_ADMIN_BOOTSTRAP_PREFLIGHT !== 'true') {
  throw new Error("Production preflight requires PICOM_ALLOW_PRODUCTION_ADMIN_BOOTSTRAP_PREFLIGHT=true.");
}

console.log(JSON.stringify({
  mode: 'operator_preflight_only',
  environment: args.environment,
  targetFingerprint: `...${args['user-id'].slice(-8)}`,
  requiresTwoPersonApproval: true,
  requiresMfaReadyAuthUser: true,
  sqlExecuted: false,
  networkConnectionMade: false,
  passwordAccepted: false,
  nextStep: 'Follow docs/admin-bootstrap.md in the approved operator console.',
}, null, 2));
