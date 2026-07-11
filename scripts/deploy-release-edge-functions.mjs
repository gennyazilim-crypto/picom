import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const manifest=JSON.parse(readFileSync("supabase/functions/release-manifest.json","utf8"));
const apply=process.argv.includes("--apply");
const functions=[...manifest.releasePublic,...manifest.releaseAuthenticated,...manifest.releaseInternal];
const run=(args,options={})=>spawnSync("supabase",args,{encoding:"utf8",shell:false,...options});
const cli=run(["--version"]);
if(!apply){console.log(JSON.stringify({status:cli.status===0?"READY_FOR_EXPLICIT_STAGING_APPLY":"BLOCKED",mode:"dry_run",releaseFunctions:functions.map((item)=>item.name),excluded:manifest.excluded.map((item)=>({name:item.name,classification:item.classification})),blocker:cli.status===0?null:"Supabase CLI is unavailable"},null,2));process.exit(0);}
const projectRef=process.env.SUPABASE_PROJECT_REF?.trim();const approvedRef=process.env.PICOM_EDGE_STAGING_PROJECT_REF?.trim();
if(process.env.PICOM_CONFIRM_EDGE_DEPLOY!=="STAGING_ONLY")throw new Error("Apply requires PICOM_CONFIRM_EDGE_DEPLOY=STAGING_ONLY.");
if(!projectRef||projectRef!==approvedRef)throw new Error("SUPABASE_PROJECT_REF must equal the explicitly approved PICOM_EDGE_STAGING_PROJECT_REF.");
if(cli.status!==0)throw new Error("Supabase CLI is unavailable.");
const secrets=run(["secrets","list","--project-ref",projectRef]);if(secrets.status!==0)throw new Error("Supabase secret-name inventory failed.");
for(const name of manifest.requiredSecretNames)if(!secrets.stdout.includes(name))throw new Error(`Required Supabase secret name is missing: ${name}`);
for(const item of functions){const args=["functions","deploy",item.name,"--project-ref",projectRef];if(!item.verifyJwt)args.push("--no-verify-jwt");const result=run(args,{stdio:"inherit"});if(result.status!==0)throw new Error(`Deployment failed for ${item.name}.`);console.log(`DEPLOYED ${item.name}`);}
console.log("Release-scoped Edge Functions deployed to the explicitly approved staging project.");
