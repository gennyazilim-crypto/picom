import { spawnSync } from "node:child_process";

const apply=process.argv.includes("--apply");
const requiredSecretNames=["LIVEKIT_URL","LIVEKIT_API_KEY","LIVEKIT_API_SECRET","PICOM_ALLOWED_ORIGINS","PICOM_V1_VOICE_SCREEN_ENABLED"];
const run=(args,options={})=>spawnSync("supabase",args,{encoding:"utf8",shell:false,...options});
const cli=run(["--version"]);

if(!apply){
  console.log(JSON.stringify({
    status:cli.status===0?"READY_FOR_EXPLICIT_STAGING_APPLY":"BLOCKED",
    mode:"dry_run",
    function:"livekit-token",
    requiredSecretNames,
    blocker:cli.status===0?null:"Supabase CLI is unavailable",
  },null,2));
  process.exit(0);
}

const projectRef=process.env.SUPABASE_PROJECT_REF?.trim();
const approvedRef=process.env.PICOM_LIVEKIT_STAGING_PROJECT_REF?.trim();
if(process.env.PICOM_CONFIRM_LIVEKIT_EDGE_DEPLOY!=="STAGING_ONLY")throw new Error("Apply requires PICOM_CONFIRM_LIVEKIT_EDGE_DEPLOY=STAGING_ONLY.");
if(process.env.PICOM_CONFIRM_LIVEKIT_MIGRATIONS_APPLIED!=="YES")throw new Error("Apply requires reviewed Voice authorization migrations to be applied first.");
if(!projectRef||projectRef!==approvedRef)throw new Error("SUPABASE_PROJECT_REF must equal the explicitly approved LiveKit staging project.");
if(cli.status!==0)throw new Error("Supabase CLI is unavailable.");

const secrets=run(["secrets","list","--project-ref",projectRef]);
if(secrets.status!==0)throw new Error("Supabase secret-name inventory failed.");
for(const name of requiredSecretNames){
  if(!new RegExp(`(^|\\s)${name}(\\s|$)`,"m").test(secrets.stdout))throw new Error(`Required Supabase secret name is missing: ${name}`);
}

const deploy=run(["functions","deploy","livekit-token","--project-ref",projectRef],{stdio:"inherit"});
if(deploy.status!==0)throw new Error("LiveKit token Function deployment failed.");
console.log("DEPLOYED livekit-token to the explicitly approved staging project; run hosted validation before any V1 reclassification.");
