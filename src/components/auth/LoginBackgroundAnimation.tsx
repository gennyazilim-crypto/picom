import type { CSSProperties } from "react";
import { AppIcon, type IconName } from "../AppIcon";
import "./LoginBackgroundAnimation.css";

type LoginBackgroundAnimationProps = { theme: "light" | "dark" };
type NetworkChip = { icon?: IconName; text?: string; left: number; top: number; tone: "accent" | "warm" | "neutral"; delay: string };

const chips: NetworkChip[] = [
  { icon: "inbox", left: 23, top: 32, tone: "accent", delay: "0s" },
  { text: "@", left: 38, top: 24, tone: "warm", delay: "-9s" },
  { icon: "microphone", left: 53, top: 32, tone: "neutral", delay: "-5s" },
  { icon: "user", left: 23, top: 60, tone: "neutral", delay: "-12s" },
  { icon: "image", left: 38, top: 68, tone: "accent", delay: "-7s" },
  { icon: "headphones", left: 53, top: 60, tone: "neutral", delay: "-15s" },
];

const wavePath = "M-100 620 C 250 520, 480 720, 800 600 S 1350 420, 1700 540";
const warmPath = "M-100 300 C 300 380, 600 220, 950 320 S 1450 420, 1700 340";
const neutralPath = "M-100 480 C 350 420, 650 540, 1000 460 S 1480 380, 1700 440";

export function LoginBackgroundAnimation({ theme }: LoginBackgroundAnimationProps) {
  return (
    <div className={`login-background-animation-v3 ${theme === "dark" ? "is-dark" : "is-light"}`} aria-hidden="true">
      <div className="login-v3-glows"><i /><i /></div>
      <div className="login-v3-grid" />

      <svg className="login-v3-waves" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none">
        <defs>
          <linearGradient id="picom-login-teal" x1="0" y1="0" x2="1600" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset=".35" stopColor="currentColor" stopOpacity=".55" />
            <stop offset=".7" stopColor="currentColor" stopOpacity=".24" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="picom-login-warm" x1="0" y1="0" x2="1600" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--picom-orange)" stopOpacity="0" />
            <stop offset=".5" stopColor="var(--picom-orange)" stopOpacity=".34" />
            <stop offset="1" stopColor="var(--picom-orange)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="picom-login-neutral" x1="0" y1="0" x2="1600" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--text-muted)" stopOpacity="0" />
            <stop offset=".5" stopColor="var(--text-muted)" stopOpacity=".3" />
            <stop offset="1" stopColor="var(--text-muted)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[620, 660, 700, 740].map((y, index) => (
          <path key={y} d={`M-100 ${y} C ${250 + index * 20} ${520 + index * 40}, ${480 + index * 20} ${720 + index * 40}, ${800 + index * 20} ${600 + index * 40} S ${1350 + index * 10} ${420 + index * 40}, 1700 ${540 + index * 40}`} stroke="url(#picom-login-teal)" strokeWidth={1.6 - index * .25} opacity={1 - index * .2} />
        ))}
        <path d={warmPath} stroke="url(#picom-login-warm)" strokeWidth="1.3" />
        <path d="M-100 260 C 320 340, 620 180, 970 280 S 1460 380, 1700 300" stroke="url(#picom-login-warm)" strokeWidth=".9" opacity=".55" />
        <path d={neutralPath} stroke="url(#picom-login-neutral)" strokeWidth="1" />
        <path d="M-100 160 C 350 220, 700 100, 1050 180 S 1500 260, 1700 190" stroke="url(#picom-login-neutral)" strokeWidth=".8" opacity=".55" />
        <path className="login-v3-dash dash-accent" d={wavePath} pathLength="600" />
        <path className="login-v3-dash dash-warm" d={warmPath} pathLength="600" />
        <path className="login-v3-dash dash-neutral" d={neutralPath} pathLength="600" />
      </svg>

      <div className="login-v3-particles">
        <i className="particle-accent" /><i className="particle-warm" /><i className="particle-neutral" />
      </div>

      <svg className="login-v3-network" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        <path d="M25 35 40 27 55 35M25 63 40 71 55 63M25 35V63M55 35V63" />
      </svg>

      <div className="login-v3-chips">
        {chips.map((chip, index) => (
          <span
            className={`login-v3-chip ${chip.tone}`}
            key={`${chip.icon ?? chip.text}-${index}`}
            style={{ left: `${chip.left}%`, top: `${chip.top}%`, "--chip-delay": chip.delay } as CSSProperties}
          >
            {chip.icon ? <AppIcon name={chip.icon} size="lg" /> : <b>{chip.text}</b>}
          </span>
        ))}
      </div>

      <div className="login-v3-specks"><i /><i /><i /><i /><i /></div>
      <div className="login-v3-vignette" />
    </div>
  );
}

