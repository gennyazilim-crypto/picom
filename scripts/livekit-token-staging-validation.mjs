import { createClient } from "@supabase/supabase-js";

const run=process.argv.includes("--run");
const hiddenMode=process.env.PICOM_LIVEKIT_EXPECT_HIDDEN==="HIDDEN";
const commonNames=["PICOM_LIVEKIT_STAGING_URL","PICOM_LIVEKIT_STAGING_ANON_KEY","PICOM_LIVEKIT_STAGING_ORIGIN","PICOM_LIVEKIT_STAGING_CONFIRM","PICOM_LIVEKIT_MEMBER_EMAIL","PICOM_LIVEKIT_MEMBER_PASSWORD","PICOM_LIVEKIT_COMMUNITY_ID","PICOM_LIVEKIT_VOICE_CHANNEL_ID"];
const enabledNames=["PICOM_LIVEKIT_VISITOR_EMAIL","PICOM_LIVEKIT_VISITOR_PASSWORD","PICOM_LIVEKIT_UNAUTHORIZED_EMAIL","PICOM_LIVEKIT_UNAUTHORIZED_PASSWORD","PICOM_LIVEKIT_BANNED_EMAIL","PICOM_LIVEKIT_BANNED_PASSWORD","PICOM_LIVEKIT_PRIVATE_CHANNEL_ID"];
const names=[...commonNames,...(hiddenMode?[]:enabledNames)];

if(!run){
  console.log("LiveKit staging validation is BLOCKED until --run and STAGING_ONLY configuration are supplied.");
  console.log(`Required variable names: ${names.join(", ")}`);
  console.log("No network request was made and no values were printed.");
  process.exit(0);
}

const missing=names.filter((name)=>!process.env[name]?.trim());
if(missing.length)throw new Error(`Missing staging configuration names: ${missing.join(", ")}`);
if(process.env.PICOM_LIVEKIT_STAGING_CONFIRM!=="STAGING_ONLY")throw new Error("PICOM_LIVEKIT_STAGING_CONFIRM must equal STAGING_ONLY.");
if(/service[_-]?role|sb_secret_/i.test(process.env.PICOM_LIVEKIT_STAGING_ANON_KEY))throw new Error("Use an anon/publishable key, never service-role.");
const base=process.env.PICOM_LIVEKIT_STAGING_URL.replace(/\/+$/,"");
if(new URL(base).protocol!=="https:")throw new Error("Hosted staging URL must use HTTPS.");

const request=async({token=null,body={},rawBody,method="POST",origin=process.env.PICOM_LIVEKIT_STAGING_ORIGIN,contentType="application/json"}={})=>{
  const response=await fetch(`${base}/functions/v1/livekit-token`,{
    method,
    headers:{apikey:process.env.PICOM_LIVEKIT_STAGING_ANON_KEY,...(origin?{Origin:origin}:{}),...(token?{Authorization:`Bearer ${token}`}:{}),...(contentType?{"Content-Type":contentType}:{})},
    body:method==="POST"?(rawBody??JSON.stringify(body)):undefined,
    signal:AbortSignal.timeout(20000),
  });
  const text=await response.text();
  let payload=null;
  try{payload=text?JSON.parse(text):null}catch{}
  return{response,payload};
};

const auth=async(email,password)=>{
  const client=createClient(base,process.env.PICOM_LIVEKIT_STAGING_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await client.auth.signInWithPassword({email,password});
  if(result.error||!result.data.session)throw new Error("Synthetic staging authentication failed.");
  return{client,user:result.data.user,token:result.data.session.access_token};
};

const member=await auth(process.env.PICOM_LIVEKIT_MEMBER_EMAIL,process.env.PICOM_LIVEKIT_MEMBER_PASSWORD);
const sessions=[member];
try{
  const baseBody={communityId:process.env.PICOM_LIVEKIT_COMMUNITY_ID,channelId:process.env.PICOM_LIVEKIT_VOICE_CHANNEL_ID,intent:"voice"};

  if(hiddenMode){
    const hidden=await request({token:member.token,body:baseBody});
    if(hidden.response.status!==503||hidden.payload?.code!=="VOICE_NOT_CONFIGURED")throw new Error(`V1-hidden state expected 503 VOICE_NOT_CONFIGURED, received ${hidden.response.status}.`);
    console.log("LiveKit hosted V1-hidden state passed; no token or secret was printed.");
    process.exitCode=0;
  }else{
    const visitor=await auth(process.env.PICOM_LIVEKIT_VISITOR_EMAIL,process.env.PICOM_LIVEKIT_VISITOR_PASSWORD);
    const unauthorized=await auth(process.env.PICOM_LIVEKIT_UNAUTHORIZED_EMAIL,process.env.PICOM_LIVEKIT_UNAUTHORIZED_PASSWORD);
    const banned=await auth(process.env.PICOM_LIVEKIT_BANNED_EMAIL,process.env.PICOM_LIVEKIT_BANNED_PASSWORD);
    sessions.push(visitor,unauthorized,banned);

    const wrongMethod=await request({method:"GET"});
    if(wrongMethod.response.status!==405)throw new Error(`Wrong method expected 405, received ${wrongMethod.response.status}.`);

    const malformed=await request({rawBody:"{"});
    if(malformed.response.status!==400)throw new Error(`Malformed body expected 400, received ${malformed.response.status}.`);

    const deniedOrigin=await request({origin:"https://not-allowed.invalid"});
    if(deniedOrigin.response.status!==403)throw new Error(`Origin is not allowed: expected 403, received ${deniedOrigin.response.status}.`);

    const noJwt=await request({body:baseBody});
    if(![401,403].includes(noJwt.response.status))throw new Error("Missing JWT was accepted.");

    const expired=await request({token:"eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJleHAiOjF9.invalid",body:baseBody});
    if(![401,403].includes(expired.response.status))throw new Error("Expired JWT was accepted.");

    const allowed=await request({token:member.token,body:{...baseBody,participantName:"Untrusted renderer label"}});
    if(allowed.response.status!==200||typeof allowed.payload?.token!=="string")throw new Error(`Allowed member token failed with ${allowed.response.status}.`);
    if("apiKey" in (allowed.payload??{})||"apiSecret" in (allowed.payload??{}))throw new Error("Provider credential field reached the response.");
    const payload=JSON.parse(Buffer.from(allowed.payload.token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));
    if(payload.sub!==member.user.id||payload.video?.room!==allowed.payload.roomName||payload.exp-payload.nbf>660||payload.video?.canPublishSources?.includes("camera")||payload.video?.canPublishData!==false)throw new Error("Token identity, room, expiry, data, or source grants are invalid.");
    if(payload.name!==allowed.payload.participantName||payload.name==="Untrusted renderer label")throw new Error("Canonical profile display name was not enforced.");

    const screen=await request({token:member.token,body:{...baseBody,intent:"screen"}});
    if(screen.response.status!==200||typeof screen.payload?.token!=="string")throw new Error(`Allowed screen token failed with ${screen.response.status}.`);
    const screenPayload=JSON.parse(Buffer.from(screen.payload.token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));
    if(!screenPayload.video?.canPublishSources?.includes("screen_share")||screenPayload.video?.canPublishSources?.includes("camera"))throw new Error("Screen token source grants are invalid.");

    for(const [label,session] of [["visitor",visitor],["unauthorized",unauthorized],["banned",banned]]){
      const denied=await request({token:session.token,body:baseBody});
      if(denied.response.status!==403)throw new Error(`${label} user expected 403, received ${denied.response.status}.`);
    }

    const deniedPrivate=await request({token:visitor.token,body:{...baseBody,channelId:process.env.PICOM_LIVEKIT_PRIVATE_CHANNEL_ID}});
    if(deniedPrivate.response.status!==403)throw new Error(`Private channel expected 403, received ${deniedPrivate.response.status}.`);

    console.log("LiveKit hosted allowed/screen/visitor/unauthorized/banned/private/JWT/CORS/method/body matrix passed; no token or secret was printed.");
  }
}finally{
  for(const session of sessions)await session.client.auth.signOut({scope:"local"});
}
