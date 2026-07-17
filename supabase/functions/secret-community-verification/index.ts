import { createClient } from "npm:@supabase/supabase-js@2";

type RequestBody = { action?: "start" | "check"; phone?: string; code?: string };

const encoder = new TextEncoder();
function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  const allowed = (Deno.env.get("PICOM_ALLOWED_ORIGINS") ?? "http://127.0.0.1:5173,http://localhost:5173")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (!origin) return "null";
  return allowed.includes(origin) ? origin : null;
}
function respond(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin ?? "null",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin",
    },
  });
}
async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function callingCode(phone: string) {
  const four = ["+1242","+1246","+1264","+1268","+1284","+1340","+1345","+1441","+1473","+1649","+1658","+1664","+1670","+1671","+1684","+1721","+1758","+1767","+1784","+1809","+1829","+1849","+1868","+1869","+1876"];
  const three = ["+211","+212","+213","+216","+218","+220","+221","+222","+223","+224","+225","+226","+227","+228","+229","+230","+231","+232","+233","+234","+235","+236","+237","+238","+239","+240","+241","+242","+243","+244","+245","+246","+248","+249","+250","+251","+252","+253","+254","+255","+256","+257","+258","+260","+261","+262","+263","+264","+265","+266","+267","+268","+269","+290","+291","+297","+298","+299"];
  const two = ["+20","+27","+30","+31","+32","+33","+34","+36","+39","+40","+41","+43","+44","+45","+46","+47","+48","+49","+51","+52","+53","+54","+55","+56","+57","+58","+60","+61","+62","+63","+64","+65","+66","+81","+82","+84","+86","+90","+91","+92","+93","+94","+95","+98"];
  return [...four,...three,...two,"+1","+7"].find((prefix) => phone.startsWith(prefix)) ?? phone.slice(0, 4);
}

Deno.serve(async (request) => {
  const origin = allowedOrigin(request);
  if (request.method === "OPTIONS") return respond({ ok: true }, 204, origin);
  if (!origin || request.method !== "POST") return respond({ error: { code: "REQUEST_NOT_ALLOWED", message: "This verification request is not allowed." } }, 403, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const twilioKey = Deno.env.get("TWILIO_API_KEY") ?? "";
  const twilioSecret = Deno.env.get("TWILIO_API_SECRET") ?? "";
  const verifySid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID") ?? "";
  const hashSecret = Deno.env.get("PHONE_VERIFICATION_HASH_SECRET") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey || !twilioKey || !twilioSecret || !verifySid || !hashSecret) {
    return respond({ error: { code: "VOICE_VERIFICATION_NOT_CONFIGURED", message: "Voice-call verification is not configured on this Picom environment." } }, 503, origin);
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return respond({ error: { code: "AUTH_REQUIRED", message: "Sign in before verifying your phone." } }, 401, origin);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return respond({ error: { code: "AUTH_REQUIRED", message: "Your session could not be verified." } }, 401, origin);

  let body: RequestBody;
  try { body = await request.json() as RequestBody; }
  catch { return respond({ error: { code: "INVALID_REQUEST", message: "The verification request is invalid." } }, 400, origin); }
  const phone = body.phone?.replace(/[\s()-]/g, "") ?? "";
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) return respond({ error: { code: "PHONE_FORMAT_INVALID", message: "Enter a phone number in international format, for example +491234567890." } }, 400, origin);
  if (body.action !== "start" && body.action !== "check") return respond({ error: { code: "VERIFICATION_ACTION_INVALID", message: "Choose a valid verification action." } }, 400, origin);

  const phoneHash = await hmacHex(hashSecret, phone);
  const bucket = await hmacHex(hashSecret, authData.user.id + ":" + phone + ":" + body.action);
  const { data: allowed, error: rateError } = await serviceClient.rpc("consume_secret_verification_rate_limit", {
    target_user_id: authData.user.id,
    target_bucket_hash: bucket,
    target_action: body.action === "start" ? "start_call" : "check_code",
  });
  if (rateError) return respond({ error: { code: "VERIFICATION_RATE_LIMIT_UNAVAILABLE", message: "Picom could not validate the verification rate limit." } }, 503, origin);
  if (!allowed) return respond({ error: { code: "VERIFICATION_RATE_LIMITED", message: "Too many verification attempts. Wait ten minutes and try again." } }, 429, origin);

  const endpoint = "https://verify.twilio.com/v2/Services/" + encodeURIComponent(verifySid) + (body.action === "start" ? "/Verifications" : "/VerificationCheck");
  const form = new URLSearchParams({ To: phone });
  if (body.action === "start") form.set("Channel", "call");
  else {
    const code = body.code?.trim() ?? "";
    if (!/^[0-9]{4,10}$/.test(code)) return respond({ error: { code: "VERIFICATION_CODE_INVALID", message: "Enter the numeric code from the verification call." } }, 400, origin);
    form.set("Code", code);
  }
  const providerResponse = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(twilioKey + ":" + twilioSecret), "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const provider = await providerResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!providerResponse.ok) {
    const limited = providerResponse.status === 429;
    return respond({ error: { code: limited ? "VERIFICATION_PROVIDER_RATE_LIMITED" : "VERIFICATION_PROVIDER_REJECTED", message: limited ? "The verification provider rate limit was reached. Try again later." : "The voice verification request could not be completed." } }, limited ? 429 : 400, origin);
  }
  if (body.action === "start") return respond({ ok: true, status: provider.status ?? "pending", channel: "call" }, 200, origin);
  if (provider.status !== "approved") return respond({ error: { code: "VERIFICATION_CODE_NOT_APPROVED", message: "The code was not approved. Check the code and try again." } }, 400, origin);

  const { error: recordError } = await serviceClient.rpc("record_secret_phone_voice_verification", {
    target_user_id: authData.user.id,
    target_phone_hash: phoneHash,
    target_phone_last4: phone.slice(-4),
    target_country_calling_code: callingCode(phone),
  });
  if (recordError) {
    const duplicate = recordError.message.includes("PHONE_ALREADY_IN_USE") || recordError.code === "23505";
    return respond({ error: { code: duplicate ? "PHONE_ALREADY_IN_USE" : "VERIFICATION_RECORD_FAILED", message: duplicate ? "This phone number is already verified for another Picom account." : "Picom could not save the verification result." } }, duplicate ? 409 : 500, origin);
  }
  return respond({ ok: true, status: "approved", phoneLast4: phone.slice(-4) }, 200, origin);
});
