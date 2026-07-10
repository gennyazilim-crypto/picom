/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: "development" | "staging" | "production" | string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_IDENTIFIER?: string;
  readonly VITE_DATA_SOURCE?: "mock" | "supabase" | string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_OAUTH_REDIRECT_URL?: string;
  readonly VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL?: string;
  readonly VITE_SUPABASE_GOOGLE_OAUTH_ENABLED?: string;
  readonly VITE_SUPABASE_APPLE_OAUTH_ENABLED?: string;
  readonly VITE_LIVEKIT_URL?: string;
  readonly VITE_LIVEKIT_ENABLED?: string;
  readonly VITE_DEV_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
