import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/20260710193000_invite_campaigns_tracking.sql","utf8");
const service=readFileSync("src/services/community/communityInviteService.ts","utf8");
const view=readFileSync("src/components/CommunityInviteModals.tsx","utf8");
for(const marker of ["campaign_label","last_used_at","create_community_invite","revoke_community_invite","list_community_invite_campaigns","community_bans","uses=uses+1","invite_accept","revoke insert,update,delete on public.community_invites"]){if(!migration.includes(marker))throw new Error(`Missing invite campaign marker: ${marker}`);}
const summary=migration.slice(migration.indexOf("list_community_invite_campaigns"));const projection=summary.slice(0,summary.indexOf("end $$;"));for(const forbidden of ["invite.code","ip_address","device_id","referrer","fingerprint"]){if(projection.includes(forbidden))throw new Error(`Invasive or secret campaign projection: ${forbidden}`);}
for(const marker of ["listInviteCampaigns","campaignLabel","creatorName"]){if(!service.includes(marker))throw new Error(`Missing invite service marker: ${marker}`);}
if(!view.includes("aggregate uses only"))throw new Error("Invite UI does not disclose privacy-safe tracking behavior.");
console.log("Invite campaigns and tracking smoke test passed.");
