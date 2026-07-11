import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const manifest=JSON.parse(readFileSync("supabase/functions/release-manifest.json","utf8"));
const shouldRun=process.argv.includes("--run");
const requiredNames=["PICOM_EDGE_STAGING_URL","PICOM_EDGE_STAGING_ANON_KEY","PICOM_EDGE_STAGING_CONFIRM","PICOM_EDGE_STAGING_USER_EMAIL","PICOM_EDGE_STAGING_USER_PASSWORD","PICOM_EDGE_STAGING_ORIGIN","PICOM_EDGE_COMMUNITY_ID","PICOM_EDGE_VOICE_CHANNEL_ID"];
const protectedFunctions=manifest.releaseAuthenticated.map((item)=>item.name);
const publicFunctions=manifest.releasePublic.map((item)=>item.name);
const fail=(message)=>{throw new Error(`Hosted staging Edge Function validation failed: ${message}`)};
const pass=(message)=>console.log(`OK ${message}`);

function validateConfiguration(){
  const missing=requiredNames.filter((name)=>!process.env[name]?.trim()); if(missing.length)fail(`missing ${missing.join(", ")}. Values were not printed.`);
  if(process.env.PICOM_EDGE_STAGING_CONFIRM!=="STAGING_ONLY")fail("PICOM_EDGE_STAGING_CONFIRM must equal STAGING_ONLY.");
  if(/service[_-]?role|sb_secret_/i.test(process.env.PICOM_EDGE_STAGING_ANON_KEY))fail("key must be anon/publishable, not service-role.");
  const url=new URL(process.env.PICOM_EDGE_STAGING_URL); const origin=new URL(process.env.PICOM_EDGE_STAGING_ORIGIN);
  if(url.protocol!=="https:"||url.username||url.password)fail("staging URL must be credential-free HTTPS.");
  if(!/^https?:$/.test(origin.protocol))fail("test Origin must use HTTP(S).");
}
async function callFunction(name,{method="POST",accessToken,body,origin=process.env.PICOM_EDGE_STAGING_ORIGIN}={}){
  const headers={apikey:process.env.PICOM_EDGE_STAGING_ANON_KEY,Origin:origin,"x-picom-api-version":"1"};
  if(accessToken)headers.Authorization=`Bearer ${accessToken}`; if(body!==undefined)headers["Content-Type"]="application/json";
  const response=await fetch(`${process.env.PICOM_EDGE_STAGING_URL.replace(/\/+$/,"")}/functions/v1/${name}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const text=await response.text(); let payload=null; if(text)try{payload=JSON.parse(text)}catch{payload=null} return{response,payload};
}
function assertCors(response,label){const value=response.headers.get("access-control-allow-origin");if(value!=="*"&&value!==process.env.PICOM_EDGE_STAGING_ORIGIN)fail(`${label} has an unexpected CORS policy.`);if(response.headers.get("access-control-allow-credentials"))fail(`${label} enables credentialed CORS.`);}
async function validateDeniedOrigin(name,method="OPTIONS"){const result=await callFunction(name,{method,origin:"https://denied-origin.invalid"});if(result.response.status!==403)fail(`${name} accepted a denied Origin.`);if(result.response.headers.get("access-control-allow-origin"))fail(`${name} reflected a denied Origin.`);}
async function validateProtection(name){const options=await callFunction(name,{method:"OPTIONS"});if(!options.response.ok)fail(`${name} preflight returned ${options.response.status}.`);assertCors(options.response,`${name} preflight`);await validateDeniedOrigin(name);const missing=await callFunction(name,{body:{}});if(![401,403].includes(missing.response.status))fail(`${name} accepted a missing JWT.`);const invalid=await callFunction(name,{accessToken:"invalid.synthetic.jwt",body:{}});if(![401,403].includes(invalid.response.status))fail(`${name} accepted an invalid JWT.`);pass(`${name}: CORS and JWT denial`);}

if(!shouldRun){console.log("Hosted staging Edge Function runner requires --run plus explicit STAGING_ONLY confirmation.");console.log(`Required configuration names: ${requiredNames.join(", ")}`);console.log(`Release public functions: ${publicFunctions.join(", ")}`);console.log(`Release protected functions: ${protectedFunctions.join(", ")}`);console.log(`Excluded functions: ${manifest.excluded.map((item)=>`${item.name}(${item.classification})`).join(", ")}`);console.log("No network connection was made and no credential values were printed.");process.exit(0);}
validateConfiguration();
for(const name of publicFunctions){const result=await callFunction(name,{method:"GET"});if(!result.response.ok)fail(`${name} public GET returned ${result.response.status}.`);assertCors(result.response,`${name} public GET`);await validateDeniedOrigin(name,"GET");pass(`${name}: public allowed/denied Origin`);}
for(const name of protectedFunctions)await validateProtection(name);
const authClient=createClient(process.env.PICOM_EDGE_STAGING_URL,process.env.PICOM_EDGE_STAGING_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const{data:authData,error:authError}=await authClient.auth.signInWithPassword({email:process.env.PICOM_EDGE_STAGING_USER_EMAIL,password:process.env.PICOM_EDGE_STAGING_USER_PASSWORD});const accessToken=authData.session?.access_token;if(authError||!accessToken||!authData.user)fail("synthetic staging user authentication failed.");
try{
  for(const name of protectedFunctions){const wrong=await callFunction(name,{method:"GET",accessToken});if(wrong.response.status!==405)fail(`${name} authenticated GET expected 405, received ${wrong.response.status}.`);}
  const validation=await callFunction("validate-file",{accessToken,body:{fileName:"staging.png",mimeType:"image/png",sizeBytes:128}});if(validation.response.status!==200||validation.payload?.valid!==true)fail("validate-file allowed request failed.");pass("validate-file authenticated allowed request");
  const livekit=await callFunction("livekit-token",{accessToken,body:{communityId:process.env.PICOM_EDGE_COMMUNITY_ID,channelId:process.env.PICOM_EDGE_VOICE_CHANNEL_ID,intent:"voice",participantName:"Staging validation"}});if(livekit.response.status!==200||typeof livekit.payload?.token!=="string"||livekit.payload.token.length<20)fail(`livekit-token did not issue a token; status ${livekit.response.status}.`);if(livekit.payload.identity!==authData.user.id)fail("livekit-token identity binding is invalid.");pass("livekit-token allowed request (token not printed)");
}finally{await authClient.auth.signOut({scope:"local"});}
console.log("Hosted staging release Edge Function validation passed without logging response tokens, URLs, credentials, or private data.");
