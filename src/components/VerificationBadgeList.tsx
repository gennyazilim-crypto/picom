import type { VerificationBadge } from "../types/verification";
import { AppIcon } from "./AppIcon";
export function VerificationBadgeList({badges}:{badges:VerificationBadge[]}){if(!badges.length)return null;return <div className="verification-badge-list" aria-label="Picom review markers">{badges.map((badge)=><span key={badge.id} className={`verification-badge ${badge.kind}`} title={`${badge.scopeNote} This marker is not a legal identity, safety, quality, or endorsement guarantee.`}><AppIcon name="lock" size="xs" />{badge.label}</span>)}</div>;}
