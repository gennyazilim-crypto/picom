export type LegalDocumentId = "terms" | "privacy" | "guidelines" | "acceptableUse";

export type LegalDocument = Readonly<{
  id: LegalDocumentId;
  title: string;
  updatedLabel: string;
  sections: ReadonlyArray<Readonly<{ heading: string; body: string }>>;
}>;

export const legalDocuments: Record<LegalDocumentId, LegalDocument> = {
  terms: {
    id: "terms",
    title: "Terms of Service - Beta Placeholder",
    updatedLabel: "Draft for beta review · Not final legal advice",
    sections: [
      { heading: "Account", body: "You are responsible for accurate account information, protecting access to your session, and activity performed through your account." },
      { heading: "User and community content", body: "You retain responsibility for messages, attachments, profiles, communities, and other content you create or manage. Community owners are responsible for setting and enforcing appropriate local rules." },
      { heading: "Prohibited use", body: "Do not use Picom for abuse, harassment, illegal activity, impersonation, unauthorized access, malware, spam, or content that violates another person's rights." },
      { heading: "Beta status", body: "Picom is beta software. Features may be incomplete, interrupted, changed, or removed while reliability and safety work continues." },
      { heading: "Termination and limitations", body: "Account restriction or termination may be required for safety, legal, or operational reasons. Final warranty, liability, dispute, and governing-law language requires professional legal review before production release." },
    ],
  },
  privacy: {
    id: "privacy",
    title: "Privacy Policy - Beta Placeholder",
    updatedLabel: "Draft for beta review · Not final legal advice",
    sections: [
      { heading: "Data Picom may process", body: "Account and profile details, community membership, channels, messages, attachments, settings, and safety reports may be processed to provide the service." },
      { heading: "Voice and screen share", body: "Voice and screen-share providers may process connection metadata and media required for a session. Picom does not claim end-to-end encryption in this beta placeholder." },
      { heading: "Diagnostics", body: "Redacted logs and diagnostics may be exported only through explicit support actions. Passwords, auth tokens, and message content are excluded from diagnostics by design." },
      { heading: "Providers", body: "Supabase is the planned backend provider for authentication, database, storage, and realtime. LiveKit is the planned voice and screen-share provider. Final subprocessor and regional details require review." },
      { heading: "User controls", body: "Data export and account deletion foundations exist as placeholders. Final retention periods, legal bases, access, correction, deletion, objection, and appeal rights require jurisdiction-specific legal review." },
    ],
  },
  guidelines: {
    id: "guidelines",
    title: "Community Guidelines - Beta Placeholder",
    updatedLabel: "Draft for beta review · Requires moderation and legal review",
    sections: [
      { heading: "Respect and safety", body: "Harassment, targeted abuse, hate, credible threats, glorification of violence, and encouragement of harm are not acceptable." },
      { heading: "Spam and illegal content", body: "Do not distribute spam, scams, malware, illegal content, or instructions intended to facilitate serious harm or unauthorized access." },
      { heading: "Privacy and identity", body: "Do not expose personal data without permission, impersonate people or organizations, or misrepresent affiliation or authority." },
      { heading: "Reporting and moderation", body: "Use available reporting tools for safety concerns. Moderators should act proportionately, preserve audit integrity, and avoid exposing private content beyond permitted review context." },
      { heading: "Community owner responsibilities", body: "Owners must publish understandable rules, appoint trusted moderators, protect private channels, respond to reports, and avoid granting permissions beyond operational need." },
    ],
  },
  acceptableUse: {
    id: "acceptableUse",
    title: "Acceptable Use Policy - Beta Placeholder",
    updatedLabel: "Draft for beta review · Not final legal advice",
    sections: [
      { heading: "Permitted use", body: "Use Picom for lawful community communication, collaboration, events, and voice sessions while respecting access controls and participant consent." },
      { heading: "Security boundaries", body: "Do not probe, bypass, overload, reverse engineer, or exploit Picom, Supabase, LiveKit, another user's account, or a community's private resources." },
      { heading: "Content and automation", body: "Do not upload malware, abusive content, unauthorized copyrighted material, deceptive links, or automated traffic that degrades service quality." },
      { heading: "Enforcement", body: "Picom may limit features, remove access, preserve relevant safety records, or cooperate with lawful requests. Detailed enforcement and appeal processes remain subject to final policy review." },
    ],
  },
};

export const legalDocumentOrder: LegalDocumentId[] = ["terms", "privacy", "guidelines", "acceptableUse"];
