import { legalConfig } from "../config/legalConfig";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type TermsAcceptanceStatus = Readonly<{ accepted: boolean; currentVersion: string; acceptedTermsVersion: string | null; acceptedPrivacyVersion: string | null; acceptedAt: string | null; legacyMockBypass: boolean }>;
type StoredAcceptance = { termsVersion: string; privacyVersion: string; acceptedAt: string };

const key = (userId: string) => `picom.legalAcceptance.v1:${userId}`;
function readMock(userId: string): StoredAcceptance | null {
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredAcceptance>;
    return typeof value.termsVersion === "string" && typeof value.privacyVersion === "string" && typeof value.acceptedAt === "string" ? value as StoredAcceptance : null;
  } catch { return null; }
}
function writeMock(userId: string): StoredAcceptance {
  const value = { termsVersion: legalConfig.termsVersion, privacyVersion: legalConfig.privacyVersion, acceptedAt: new Date().toISOString() };
  try { window.localStorage.setItem(key(userId), JSON.stringify(value)); } catch { /* No credentials/content are stored. */ }
  return value;
}
function toStatus(value: StoredAcceptance | null, legacyMockBypass = false): TermsAcceptanceStatus {
  return { accepted: legacyMockBypass || Boolean(value && value.termsVersion === legalConfig.termsVersion && value.privacyVersion === legalConfig.privacyVersion), currentVersion: legalConfig.currentVersion, acceptedTermsVersion: value?.termsVersion ?? null, acceptedPrivacyVersion: value?.privacyVersion ?? null, acceptedAt: value?.acceptedAt ?? null, legacyMockBypass };
}

export const termsAcceptanceService = {
  recordMockRegistrationAcceptance(userId: string): TermsAcceptanceStatus { return toStatus(writeMock(userId)); },
  async getStatus(userId: string): Promise<TermsAcceptanceStatus> {
    if (dataSourceService.getStatus().isMock) {
      const stored = readMock(userId);
      return stored ? toStatus(stored) : toStatus(null, true);
    }
    const client = getSupabaseClient();
    if (!client) return toStatus(null);
    const { data, error } = await client.from("profiles").select("accepted_terms_version,accepted_privacy_version,terms_accepted_at").eq("id", userId).maybeSingle();
    if (error || !data) return toStatus(null);
    return toStatus({ termsVersion: data.accepted_terms_version ?? "", privacyVersion: data.accepted_privacy_version ?? "", acceptedAt: data.terms_accepted_at ?? "" });
  },
  async acceptCurrent(userId: string): Promise<{ ok: true; status: TermsAcceptanceStatus } | { ok: false; message: string }> {
    if (dataSourceService.getStatus().isMock) return { ok: true, status: toStatus(writeMock(userId)) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Legal acceptance is unavailable. Sign out and try again." };
    const { data, error } = await client.rpc("accept_current_legal_terms");
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return { ok: false, message: "Picom could not record your acceptance safely." };
    return { ok: true, status: toStatus({ termsVersion: row.terms_version, privacyVersion: row.privacy_version, acceptedAt: row.accepted_at }) };
  },
};
