import { legalConfig } from "../config/legalConfig";
export type LegalDocumentId = "terms" | "privacy" | "guidelines" | "acceptableUse";
export type LegalDocument = Readonly<{ id: LegalDocumentId; title: string; updatedLabel: string; sections: ReadonlyArray<Readonly<{ heading: string; body: string }>> }>;
const label = `${legalConfig.effectiveLabel} - Not final legal advice`;
export const legalDocuments: Record<LegalDocumentId, LegalDocument> = {
  terms: { id: "terms", title: "Terms of Service - Legal Review Draft", updatedLabel: label, sections: [
    { heading: "Account", body: "You are responsible for accurate account information, protecting session access, and activity performed through your account." },
    { heading: "User and community content", body: "You retain responsibility for messages, attachments, profiles, communities, and content you create or manage. A limited service license and final regional terms require qualified legal review." },
    { heading: "Prohibited use", body: "Do not use Picom for abuse, harassment, illegal activity, impersonation, unauthorized access, malware, spam, or rights infringement." },
    { heading: "Beta status", body: "Picom is beta software. Features may be incomplete, interrupted, changed, or removed while reliability and safety work continues." },
    { heading: "Termination and limitations", body: "Restrictions may be required for safety, legal, or operational reasons. Warranty, liability, dispute, governing-law, and regional consumer language remains pending." },
  ] },
  privacy: { id: "privacy", title: "Privacy Notice - Legal Review Draft", updatedLabel: label, sections: [
    { heading: "Data Picom may process", body: "Account/profile data, memberships, messages, attachments, settings, reports, live-session metadata, and security events may be processed to provide and protect the service." },
    { heading: "Voice and screen share", body: "LiveKit may process connection metadata and media required for a session. Picom does not claim production end-to-end encryption." },
    { heading: "Diagnostics", body: "Redacted diagnostics are user-controlled. Passwords, auth tokens, authorization headers, and private message content are excluded by design." },
    { heading: "Providers and transfers", body: "Supabase and LiveKit are planned providers. Final entities, regions, subprocessors, transfer mechanisms, and contracts require review." },
    { heading: "User controls", body: "Authenticated export and reviewed account deletion workflows exist. Retention, legal holds, backup deletion, rights deadlines, and regional exceptions require approval." },
  ] },
  guidelines: { id: "guidelines", title: "Community Guidelines - Legal Review Draft", updatedLabel: `${legalConfig.effectiveLabel} - Moderation and legal review required`, sections: [
    { heading: "Respect and safety", body: "Harassment, targeted abuse, hate, credible threats, exploitation, glorification of violence, and encouragement of harm are not acceptable." },
    { heading: "Spam and illegal content", body: "Do not distribute spam, scams, malware, illegal content, or instructions intended to facilitate serious harm or unauthorized access." },
    { heading: "Privacy and identity", body: "Do not expose personal/private data without authority, impersonate people, or misrepresent affiliation or verified status." },
    { heading: "Reporting and appeals", body: "Use reporting tools for safety concerns. Notice, evidence, appeal windows, emergency actions, and regional statements of reasons remain operational/legal review items." },
    { heading: "Owner responsibilities", body: "Owners should publish understandable rules, appoint trusted moderators, protect private channels, respond proportionately, and preserve audit integrity." },
  ] },
  acceptableUse: { id: "acceptableUse", title: "Acceptable Use Policy - Legal Review Draft", updatedLabel: label, sections: [
    { heading: "Permitted use", body: "Use Picom for lawful community communication, collaboration, events, and live sessions while respecting access controls and consent." },
    { heading: "Security boundaries", body: "Do not probe, bypass, overload, exploit, or gain unauthorized access to Picom, Supabase, LiveKit, accounts, private resources, or desktop IPC." },
    { heading: "Content and automation", body: "Do not upload malware, abusive or unlawful content, unauthorized copyrighted material, deceptive links, or traffic that degrades the service." },
    { heading: "Enforcement", body: "Picom may limit access and preserve limited safety evidence. Final notices, appeal rules, research safe harbor, and regional restrictions require approval." },
  ] },
};
export const legalDocumentOrder: LegalDocumentId[] = ["terms", "privacy", "guidelines", "acceptableUse"];
