import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const auth = read("src/services/authService.ts");
const social = read("src/services/auth/socialAuthService.ts");
const settings = read("src/components/SettingsModal.tsx");
const app = read("src/App.tsx");
const sessions = read("src/services/sessionManagementService.ts");
const deletion = read("src/services/accountDeletionService.ts");

const requireAll = (source, values, label) => {
  const missing = values.filter((value) => !source.includes(value));
  if (missing.length) throw new Error(label + ": missing " + missing.join(", "));
};

requireAll(auth, ["changeCurrentPassword", "reauthenticateCurrentUser", "updateUser({ password: newPassword })", 'signOut({ scope: "global" })', "requestPasswordReset"], "password security service");
requireAll(social, ["getAccountProviderStates", "beginProviderLink", "linkIdentity", "googleOAuthEnabled", "appleOAuthEnabled", "steamOAuthEnabled", "epicOAuthEnabled", "SOCIAL_AUTH_PROVIDER_ORDER"], "social provider service");
requireAll(settings, ["Account identity", "Connected sign-in providers", "Send password reset email", "Change password and sign out all sessions", "Confirm session revocation", "Confirm logout", "Request data export", 'autoComplete="current-password"', "Refresh identity", "Manage sessions", "Check verification status", "subscribeToDeviceSessionChanges"], "Account settings UI");
requireAll(settings, ["accountActivityService.recordActivity", 'type: "password_changed"', 'type: "session_revoked"', 'type: "account_deletion_requested"'], "destructive action audit");
requireAll(app, ["onLogout={handleLogout}", "currentEmail={authSession?.user?.email}"], "App account identity and logout wiring");
requireAll(sessions, ['signOut({scope:"others"})', "revoke_other_device_sessions", "subscribeToDeviceSessionChanges"], "session revocation");
requireAll(deletion, ["requestDeletion", "confirmationText", "ownedCommunityCount"], "account deletion confirmation");
if (settings.includes("void requestDataExport}")) throw new Error("Data export button still references the handler without invoking it.");
if (settings.includes("Enable 2FA (Coming soon)")) throw new Error("Out-of-scope fake 2FA action remains in Account settings.");
if (/setSessionManagementMessage\(result\.data\.message\);\s*void refreshActiveSessions\(\);/.test(settings)) throw new Error("Active-session refresh still recurses after every successful request.");
if (/from\(["']/.test(settings)) throw new Error("Settings UI must not call Supabase directly.");

console.log("Account identity, password, provider availability, session, export, deletion, confirmation, and audit contracts passed.");
