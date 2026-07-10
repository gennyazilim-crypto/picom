import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/20260710085000_community_discovery_production_v1.sql","utf8");
const service=readFileSync("src/services/communityDiscoveryService.ts","utf8");
const view=readFileSync("src/components/DiscoveryView.tsx","utf8");
const app=readFileSync("src/App.tsx","utf8");
for(const marker of ["review.status = 'approved'","community.visibility = 'public'","community.public_read_enabled = true","community.discovery_listed = true","join_or_request_discovery_community","AUTH_REQUIRED"]){if(!migration.includes(marker))throw new Error(`Missing discovery security marker: ${marker}`);}
for(const forbidden of ["private channel","invite_secret","owner_email","audit_log"]){if(migration.includes(`'${forbidden}'`))throw new Error(`Unsafe discovery field marker: ${forbidden}`);}
for(const marker of ["listPublicCommunities","joinOrRequestAccess"]){if(!service.includes(marker))throw new Error(`Missing discovery service marker: ${marker}`);}
for(const marker of ["onReport(item)","Request access","Only reviewed public profiles are listed"]){if(!view.includes(marker))throw new Error(`Missing DiscoveryView marker: ${marker}`);}
if(!app.includes('onReport={(community) => setReportTarget({ targetType: "community"'))throw new Error("Discovery report flow is not connected to ReportModal.");
console.log("Community discovery public listing smoke test passed.");
