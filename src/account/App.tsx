import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { AccountShell } from "./components/AccountShell";
import { GuestOnlyRoute } from "./components/GuestOnlyRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicLayout } from "./components/PublicLayout";
import { captureContinueContextFromLocation } from "./lib/continueToProduct";
import { AuthProvider } from "./lib/session";
import { AccountThemeProvider } from "./lib/theme";
import { AccountOverviewPage } from "./pages/AccountOverviewPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { AuthErrorPage } from "./pages/AuthErrorPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { DataExportPage } from "./pages/DataExportPage";
import { DeactivatePage } from "./pages/DeactivatePage";
import { ConfirmAccountDeletionPage } from "./pages/ConfirmAccountDeletionPage";
import { DeletePage } from "./pages/DeletePage";
import { EmailChangePage } from "./pages/EmailChangePage";
import { ConfirmEmailChangePage } from "./pages/ConfirmEmailChangePage";
import { EmailVerificationPendingPage } from "./pages/EmailVerificationPendingPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HomePage } from "./pages/HomePage";
import { LegalCookiesPage } from "./pages/LegalCookiesPage";
import { LegalPrivacyPage } from "./pages/LegalPrivacyPage";
import { LegalTermsPage } from "./pages/LegalTermsPage";
import { LoginPage } from "./pages/LoginPage";
import { MfaChallengePage } from "./pages/MfaChallengePage";
import { MfaPage } from "./pages/MfaPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OpenAppPage } from "./pages/OpenAppPage";
import { PasswordChangePage } from "./pages/PasswordChangePage";
import { PreferencesPage } from "./pages/PreferencesPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ProfileSetupPage } from "./pages/ProfileSetupPage";
import { ProfileVerificationPage } from "./pages/ProfileVerificationPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SecurityPage } from "./pages/SecurityPage";
import { SessionsPage } from "./pages/SessionsPage";
import { SupportPage } from "./pages/SupportPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ROUTES } from "./routes";

function ProtectedAccountRoutes() {
  return (
    <ProtectedRoute>
      <AccountShell />
    </ProtectedRoute>
  );
}

function PublicAuthLayout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <PublicLayout wide={wide}>{children}</PublicLayout>;
}

/** Split-auth pages own their chrome (AuthSplitLayout); do not wrap in PublicLayout. */
function GuestSplit({ children }: { children: React.ReactNode }) {
  return <GuestOnlyRoute>{children}</GuestOnlyRoute>;
}

export function App() {
  useEffect(() => {
    captureContinueContextFromLocation();
  }, []);

  return (
    <AuthProvider>
      <AccountThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.login} element={<GuestSplit><LoginPage /></GuestSplit>} />
          <Route path={ROUTES.register} element={<GuestSplit><RegisterPage /></GuestSplit>} />
          <Route path={ROUTES.forgotPassword} element={<GuestSplit><ForgotPasswordPage /></GuestSplit>} />
          <Route path={ROUTES.emailVerificationPending} element={<PublicAuthLayout><EmailVerificationPendingPage /></PublicAuthLayout>} />

          <Route path={ROUTES.verifyEmailSuccess} element={<PublicAuthLayout><VerifyEmailPage forcedStatus="success" /></PublicAuthLayout>} />
          <Route path={ROUTES.verifyEmailExpired} element={<PublicAuthLayout><VerifyEmailPage forcedStatus="expired" /></PublicAuthLayout>} />
          <Route path={ROUTES.verifyEmailFailed} element={<PublicAuthLayout><VerifyEmailPage forcedStatus="invalid" /></PublicAuthLayout>} />
          <Route path={ROUTES.verifyEmailCode} element={<PublicAuthLayout><VerifyEmailPage /></PublicAuthLayout>} />
          <Route path={ROUTES.verifyEmail} element={<PublicAuthLayout><VerifyEmailPage /></PublicAuthLayout>} />
          <Route path={ROUTES.verifyEmailLegacyConfirm} element={<PublicAuthLayout><VerifyEmailPage /></PublicAuthLayout>} />

          <Route path={ROUTES.resetPasswordSuccess} element={<ResetPasswordPage forcedStatus="success" />} />
          <Route path={ROUTES.resetPasswordExpired} element={<ResetPasswordPage forcedStatus="expired" />} />
          <Route path={ROUTES.resetPasswordCode} element={<ResetPasswordPage />} />
          <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
          <Route path={ROUTES.resetPasswordLegacy} element={<ResetPasswordPage />} />

          <Route path={ROUTES.confirmEmailChangeCode} element={<PublicAuthLayout><ConfirmEmailChangePage /></PublicAuthLayout>} />
          <Route path={ROUTES.confirmEmailChange} element={<PublicAuthLayout><ConfirmEmailChangePage /></PublicAuthLayout>} />
          <Route path={ROUTES.confirmEmailChangeLegacy} element={<PublicAuthLayout><ConfirmEmailChangePage /></PublicAuthLayout>} />
          <Route path={ROUTES.openAppCode} element={<PublicAuthLayout><OpenAppPage /></PublicAuthLayout>} />
          <Route path={ROUTES.deleteAccountConfirm} element={<PublicAuthLayout><ConfirmAccountDeletionPage /></PublicAuthLayout>} />

          <Route path={ROUTES.mfaChallenge} element={<ProtectedRoute><PublicAuthLayout><MfaChallengePage /></PublicAuthLayout></ProtectedRoute>} />
          <Route path={ROUTES.authCallback} element={<PublicAuthLayout><AuthCallbackPage /></PublicAuthLayout>} />
          <Route path={ROUTES.authError} element={<PublicAuthLayout><AuthErrorPage /></PublicAuthLayout>} />
          <Route path={ROUTES.support} element={<PublicAuthLayout wide><SupportPage /></PublicAuthLayout>} />
          <Route path={ROUTES.legalPrivacy} element={<PublicAuthLayout wide><LegalPrivacyPage /></PublicAuthLayout>} />
          <Route path={ROUTES.legalTerms} element={<PublicAuthLayout wide><LegalTermsPage /></PublicAuthLayout>} />
          <Route path={ROUTES.legalCookies} element={<PublicAuthLayout wide><LegalCookiesPage /></PublicAuthLayout>} />

          <Route element={<ProtectedAccountRoutes />}>
            <Route path={ROUTES.accountOverview} element={<AccountOverviewPage />} />
            <Route path={ROUTES.profile} element={<ProfilePage />} />
            <Route path={ROUTES.profileSetup} element={<ProfileSetupPage />} />
            <Route path={ROUTES.profileVerification} element={<ProfileVerificationPage />} />
            <Route path={ROUTES.emailVerification} element={<EmailVerificationPendingPage />} />
            <Route path={ROUTES.security} element={<SecurityPage />} />
            <Route path={ROUTES.accountSecurity} element={<Navigate to={ROUTES.security} replace />} />
            <Route path={ROUTES.connections} element={<ConnectionsPage />} />
            <Route path={ROUTES.connectionsLegacy} element={<Navigate to={ROUTES.connections} replace />} />
            <Route path={ROUTES.passwordChange} element={<PasswordChangePage />} />
            <Route path={ROUTES.accountPassword} element={<Navigate to={ROUTES.passwordChange} replace />} />
            <Route path={ROUTES.emailChange} element={<EmailChangePage />} />
            <Route path={ROUTES.accountEmail} element={<Navigate to={ROUTES.emailChange} replace />} />
            <Route path={ROUTES.mfa} element={<MfaPage />} />
            <Route path={ROUTES.sessions} element={<SessionsPage />} />
            <Route path={ROUTES.preferences} element={<PreferencesPage />} />
            <Route path={ROUTES.notifications} element={<NotificationsPage />} />
            <Route path={ROUTES.privacy} element={<PrivacyPage />} />
            <Route path={ROUTES.dataExport} element={<DataExportPage />} />
            <Route path={ROUTES.data} element={<DataExportPage />} />
            <Route path={ROUTES.deactivate} element={<DeactivatePage />} />
            <Route path={ROUTES.deleteAccount} element={<DeletePage />} />
          </Route>

          <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
        </Routes>
      </BrowserRouter>
      </AccountThemeProvider>
    </AuthProvider>
  );
}
