import type { CSSProperties } from "react";
import { AppIcon, type IconName } from "../AppIcon";

type LoginBackgroundAnimationProps = {
  theme: "light" | "dark";
};

type OrbitNode = {
  icon: IconName;
  angle: number;
  tone: "accent" | "warm" | "neutral";
};

const orbitNodes: OrbitNode[][] = [
  [
    { icon: "inbox", angle: 30, tone: "accent" },
    { icon: "smile", angle: 150, tone: "warm" },
    { icon: "microphone", angle: 270, tone: "accent" },
  ],
  [
    { icon: "image", angle: 0, tone: "neutral" },
    { icon: "bell", angle: 100, tone: "warm" },
    { icon: "user", angle: 190, tone: "neutral" },
    { icon: "headphones", angle: 285, tone: "accent" },
  ],
  [
    { icon: "hash", angle: 45, tone: "accent" },
    { icon: "smile", angle: 120, tone: "warm" },
    { icon: "voice", angle: 200, tone: "neutral" },
    { icon: "reply", angle: 270, tone: "accent" },
    { icon: "send", angle: 340, tone: "neutral" },
  ],
];

export function LoginBackgroundAnimation({ theme }: LoginBackgroundAnimationProps) {
  return (
    <div className={`login-background-animation ${theme === "dark" ? "is-dark" : "is-light"}`} aria-hidden="true">
      <div className="login-background-glows"><i /><i /><i /></div>
      <div className="login-background-dots login-background-dots-left" />
      <div className="login-background-dots login-background-dots-right" />
      {orbitNodes.map((nodes, orbitIndex) => (
        <div className={`login-orbit login-orbit-${orbitIndex + 1}`} key={`orbit-${orbitIndex + 1}`}>
          <div className="login-orbit-spinner">
            {nodes.map((node) => (
              <span
                className="login-orbit-node"
                key={`${node.icon}-${node.angle}`}
                style={{ "--orbit-angle": `${node.angle}deg`, "--orbit-counter-angle": `${-node.angle}deg` } as CSSProperties}
              >
                <span className={`login-orbit-node-surface ${node.tone}`}>
                  <AppIcon name={node.icon} size={orbitIndex === 0 ? "lg" : "md"} />
                </span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
