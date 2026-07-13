import type { ImgHTMLAttributes, SVGProps } from "react";
import type { SocialAuthProvider } from "../../services/auth/socialAuthService";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  provider: SocialAuthProvider;
  size?: number;
};

const SOCIAL_LOGO_URLS: Partial<Record<SocialAuthProvider, string>> = {
  google: `${import.meta.env.BASE_URL}icons/social/google.svg`,
  apple: `${import.meta.env.BASE_URL}icons/social/apple.svg`,
};

function SteamLogo({ size = 28, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className ? `social-provider-logo social-provider-logo--steam ${className}` : "social-provider-logo social-provider-logo--steam"}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 23c6.075 0 11 -4.925 11 -11S18.075 1 12 1C6.248 1 1.527 5.415 1.041 11.042l5.92 2.494a3.235 3.235 0 0 1 1.892 -0.534l2.409 -3.433a4.25 4.25 0 1 1 4.127 3.93l-3.406 2.414a3.25 3.25 0 0 1 -6.447 0.82l-4.123 -1.737C2.718 19.616 6.963 23 12 23Zm-3.25 -4.371a2.38 2.38 0 0 1 -2.198 -1.467l1.36 0.572A1.75 1.75 0 0 0 9.27 14.51l-1.246 -0.525a2.379 2.379 0 1 1 0.726 4.645Zm6.904 -11.127a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0 -3.5Zm-2.75 1.75a2.75 2.75 0 1 1 5.5 0 2.75 2.75 0 0 1 -5.5 0Z"
      />
    </svg>
  );
}

function EpicLogo({ size = 28, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className ? `social-provider-logo social-provider-logo--epic ${className}` : "social-provider-logo social-provider-logo--epic"}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 1a1.5 1.5 0 0 0 -1.5 1.5v16a0.5 0.5 0 0 0 0.297 0.457l9 4a0.5 0.5 0 0 0 0.406 0l9 -4a0.5 0.5 0 0 0 0.297 -0.457v-16A1.5 1.5 0 0 0 20 1H4Zm10.25 11.75h-1.5v-8.5h1.5v8.5ZM8 18.5l4 2 4 -2H8ZM8 4.25H5.25v8.5H8v-1.5H6.75v-2H8v-1.5H6.75v-2H8v-1.5Zm2.5 0H8.75v8.5h1.5v-2.5h0.25a1.75 1.75 0 0 0 1.75 -1.75V6a1.75 1.75 0 0 0 -1.75 -1.75Zm0 4.5h-0.25v-3h0.25a0.25 0.25 0 0 1 0.25 0.25v2.5a0.25 0.25 0 0 1 -0.25 0.25Zm4.25 -3.25c0 -0.69 0.56 -1.25 1.25 -1.25h1.5c0.69 0 1.25 0.56 1.25 1.25v2h-1.5V5.75h-1v5.5h1V9.5h1.5v2c0 0.69 -0.56 1.25 -1.25 1.25H16c-0.69 0 -1.25 -0.56 -1.25 -1.25v-6ZM5.5 16.25h12v-1.5h-12v1.5Z"
      />
    </svg>
  );
}

export function SocialProviderLogo({ provider, size = 20, className, ...props }: Props) {
  const logoClassName = className ? `social-provider-logo social-provider-logo--${provider} ${className}` : `social-provider-logo social-provider-logo--${provider}`;

  if (provider === "steam") {
    return <SteamLogo size={28} className={className} />;
  }

  if (provider === "epic") {
    return <EpicLogo size={28} className={className} />;
  }

  const src = SOCIAL_LOGO_URLS[provider];
  if (!src) return null;

  return (
    <img
      {...props}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      className={logoClassName}
    />
  );
}
