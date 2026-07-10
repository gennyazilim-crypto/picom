import { legalConfig } from "../config/legalConfig";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type TermsAcceptanceStatus = Readonly<{ accepted: boolean; currentVersion: string; acceptedTermsVersion: string | null; acceptedPrivacyVersion: string | null; acceptedAt: string | null; source: "registration" | "reaccept" | null; legacyMockBypass: boolean }>;
type StoredAcceptance = { termsVersion: string; privacyVersion: string; acceptedAt: string; source: "registration" | "reaccept" };

const key = (userId: string) => `picom.legalAcceptance.v1:${userId}`;
function readMock(userId: string): StoredAcceptance | null {
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredAcceptance>;
    if (typeof value.termsVersion !== "string" || typeof value.privacyVersion !== "string" || typeof value.acceptedAt !== "string") return null;
    return { termsVersion: value.termsVersion, privacyVersion: value.privacyVersion, acceptedAt: value.acceptedAt, source: value.source === "registration" ? "registration" : "reaccept" };
  } catch { return null; }
}
function writeMock(userId: string, source: StoredAcceptance["source"]): StoredAcceptance {
  const value = { termsVersion: legalConfig.termsVersion, privacyVersion: legalConfig.privacyVersion, acceptedAt: new Date().toISOString(), source };
  try { window.localStorage.setItem(key(userId), JSON.stringify(value)); } catch { /* No credentials/content are stored. */ }
  return value;
}
function toStatus(value: StoredAcceptance | null): TermsAcceptanceStatus {
  return { accepted: Boolean(value && value.termsVersion === legalConfig.termsVersion && value.privacyVersion === legalConfig.privacyVersion), currentVersion: legalConfig.currentVersion, acceptedTermsVersion: value?.termsVersion ?? null, acceptedPrivacyVersion: value?.privacyVersion ?? null, acceptedAt: value?.acceptedAt ?? null, source: value?.source ?? null, legacyMockBypass: false };
}

export const termsAcceptanceService = {
  recordMockRegistrationAcceptance(userId: string): TermsAcceptanceStatus { return toStatus(writeMock(userId, "registration")); },
  async getStatus(userId: string): Promise<TermsAcceptanceStatus> {
    if (dataSourceService.getStatus().isMock) {
      const stored = readMock(userId);
      return toStatus(stored);
    }
    const client = getSupabaseClient();
    if (!client) return toStatus(null);
    const { data, error } = await client.from("profiles").select("accepted_terms_version,accepted_privacy_version,terms_accepted_at").eq("id", userId).maybeSingle();
    if (error || !data) return toStatus(null);
    return toStatus({ termsVersion: data.accepted_terms_version ?? "", privacyVersion: data.accepted_privacy_version ?? "", acceptedAt: data.terms_accepted_at ?? "", source: "reaccept" });
  },
  async acceptCurrent(userId: string): Promise<{ ok: true; status: TermsAcceptanceStatus } | { ok: false; message: string }> {
    if (dataSourceService.getStatus().isMock) return { ok: true, status: toStatus(writeMock(userId, "reaccept")) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Legal acceptance is unavailable. Sign out and try again." };
    const { data, error } = await client.rpc("accept_current_legal_terms");
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return { ok: false, message: "Picom could not record your acceptance safely." };
    return { ok: true, status: toStatus({ termsVersion: row.terms_version, privacyVersion: row.privacy_version, acceptedAt: row.accepted_at, source: "reaccept" }) };
  },
};
