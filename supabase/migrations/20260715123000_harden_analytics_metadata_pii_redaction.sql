-- T54 — strengthen analytics metadata sanitization with value-level PII redaction.
-- Applied to live "piso" (Picom prod) on 2026-07-15. Additive + reversible; stays IMMUTABLE.
-- The prior version only dropped a denylist of sensitive KEYS; PII embedded in string VALUES
-- (e.g. an email in a "note" field) slipped through. This adds value-level redaction of
-- email / phone / IPv4 / bearer-token patterns plus a length cap, on top of an expanded key
-- denylist. Existing callers (record_analytics_event) are unaffected beyond stricter cleaning.
create or replace function public.sanitize_analytics_metadata(metadata_input jsonb default '{}'::jsonb)
returns jsonb language plpgsql immutable set search_path to 'public'
as $function$
declare
  sanitized jsonb := coalesce(metadata_input, '{}'::jsonb);
  k text; v jsonb; sval text;
begin
  -- 1) drop sensitive keys (original denylist + a few direct identifiers)
  sanitized := sanitized
    - 'text' - 'message' - 'content' - 'body'
    - 'password' - 'token' - 'access_token' - 'refresh_token'
    - 'secret' - 'authorization' - 'email' - 'ip' - 'phone'
    - 'username' - 'user_id' - 'session';
  -- 2) value-level PII redaction on remaining string values
  for k, v in select key, value from jsonb_each(sanitized) loop
    if jsonb_typeof(v) = 'string' then
      sval := v #>> '{}';
      sval := regexp_replace(sval, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[redacted-email]', 'g');
      sval := regexp_replace(sval, '((25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])', '[redacted-ip]', 'g');
      sval := regexp_replace(sval, '\+?[0-9][0-9 ().-]{6,}[0-9]', '[redacted-number]', 'g');
      sval := regexp_replace(sval, 'bearer\s+[A-Za-z0-9._-]+', '[redacted-token]', 'gi');
      sval := left(sval, 200);
      sanitized := jsonb_set(sanitized, array[k], to_jsonb(sval), true);
    end if;
  end loop;
  return sanitized;
end;
$function$;

-- Rollback: restore the prior key-denylist-only body of sanitize_analytics_metadata.
