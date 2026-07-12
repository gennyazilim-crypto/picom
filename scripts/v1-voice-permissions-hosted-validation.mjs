import { createClient } from "@supabase/supabase-js";

const run=process.argv.includes("--run");
const accountNames=["OWNER","ADMIN","MODERATOR","MEMBER","ROLELESS_MEMBER","VISITOR","BLOCKED"];
const names=[
  "PICOM_RLS_STAGING_URL","PICOM_RLS_STAGING_ANON_KEY","PICOM_RLS_STAGING_CONFIRM",
  ...accountNames.flatMap((name)=>[`PICOM_RLS_${name}_EMAIL`,`PICOM_RLS_${name}_PASSWORD`]),
  "PICOM_LIVEKIT_UNAUTHORIZED_EMAIL","PICOM_LIVEKIT_UNAUTHORIZED_PASSWORD",
  "PICOM_VOICE_PERMISSIONS_COMMUNITY_ID","PICOM_VOICE_PERMISSIONS_CHANNEL_ID","PICOM_VOICE_PERMISSIONS_PRIVATE_CHANNEL_ID",
];

if(!run){
  console.log("V1 Voice permission hosted validation is BLOCKED until --run and STAGING_ONLY fixtures are supplied.");
  console.log(`Required variable names: ${names.join(", ")}`);
  console.log("No network request was made and no credential value was printed.");
  process.exit(0);
}

const missing=names.filter((name)=>!process.env[name]?.trim());
if(missing.length)throw new Error(`Missing hosted Voice permission configuration names: ${missing.join(", ")}`);
if(process.env.PICOM_RLS_STAGING_CONFIRM!=="STAGING_ONLY")throw new Error("PICOM_RLS_STAGING_CONFIRM must equal STAGING_ONLY.");
if(/service[_-]?role|sb_secret_/i.test(process.env.PICOM_RLS_STAGING_ANON_KEY))throw new Error("Use an anon/publishable key, never service-role.");

const url=process.env.PICOM_RLS_STAGING_URL;
const anonKey=process.env.PICOM_RLS_STAGING_ANON_KEY;
if(new URL(url).protocol!=="https:")throw new Error("Hosted staging URL must use HTTPS.");
const communityId=process.env.PICOM_VOICE_PERMISSIONS_COMMUNITY_ID;
const channelId=process.env.PICOM_VOICE_PERMISSIONS_CHANNEL_ID;
const privateChannelId=process.env.PICOM_VOICE_PERMISSIONS_PRIVATE_CHANNEL_ID;

const signIn=async(email,password)=>{
  const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await client.auth.signInWithPassword({email,password});
  if(result.error||!result.data.user)throw new Error("Synthetic Voice permission sign-in failed.");
  return{client,user:result.data.user};
};

const actors=new Map();
for(const name of accountNames){
  actors.set(name.toLowerCase(),await signIn(process.env[`PICOM_RLS_${name}_EMAIL`],process.env[`PICOM_RLS_${name}_PASSWORD`]));
}
actors.set("unauthorized",await signIn(process.env.PICOM_LIVEKIT_UNAUTHORIZED_EMAIL,process.env.PICOM_LIVEKIT_UNAUTHORIZED_PASSWORD));

const expectAuthorized=async(name,intent="voice",targetChannelId=channelId)=>{
  const actor=actors.get(name);
  const result=await actor.client.rpc("authorize_livekit_room",{target_community_id:communityId,target_channel_id:targetChannelId,target_intent:intent});
  if(result.error||!Array.isArray(result.data)||result.data.length!==1)throw new Error(`${name} expected authorized ${intent} access.`);
  return result.data[0];
};
const expectDenied=async(name,intent="voice",targetChannelId=channelId)=>{
  const actor=actors.get(name);
  const result=await actor.client.rpc("authorize_livekit_room",{target_community_id:communityId,target_channel_id:targetChannelId,target_intent:intent});
  if(!result.error)throw new Error(`${name} unexpectedly received ${intent} authorization.`);
};

try{
  for(const name of ["owner","admin","moderator","member","roleless_member"]){
    const rooms=await actors.get(name).client.rpc("list_visible_voice_rooms",{target_community_id:communityId});
    if(rooms.error||!rooms.data?.some((room)=>room.channel_id===channelId))throw new Error(`${name} cannot discover the permitted Voice room.`);
    const grant=await expectAuthorized(name);
    if(!grant.can_publish_audio)throw new Error(`${name} expected canonical publishAudio grant.`);
    const screen=await expectAuthorized(name,"screen");
    if(!screen.can_publish_screen)throw new Error(`${name} expected shareScreen grant.`);
  }

  for(const name of ["visitor","blocked","unauthorized"]){
    const channels=await actors.get(name).client.from("channels").select("id,name,type,is_private").in("id",[channelId,privateChannelId]);
    if(channels.error&&channels.error.code!=="42501")throw new Error(`${name} channel visibility probe failed unexpectedly.`);
    if(channels.data?.length)throw new Error(`${name} received private/Voice channel metadata.`);
    const rooms=await actors.get(name).client.rpc("list_visible_voice_rooms",{target_community_id:communityId});
    if(!rooms.error&&rooms.data?.length)throw new Error(`${name} discovered Voice metadata.`);
    await expectDenied(name);
  }

  for(const name of ["owner","admin","moderator","member","roleless_member"])await expectAuthorized(name,"voice",privateChannelId);

  const hierarchy=[
    ["owner","admin",true],
    ["admin","moderator",true],
    ["moderator","member",true],
    ["member","moderator",false],
    ["moderator","admin",false],
  ];
  for(const [actorName,targetName,allowed] of hierarchy){
    const actor=actors.get(actorName),target=actors.get(targetName);
    const result=await actor.client.rpc("authorize_livekit_voice_moderation",{target_community_id:communityId,target_channel_id:channelId,target_user_id:target.user.id,target_action:"remove"});
    if(allowed&&result.error)throw new Error(`${actorName} should moderate lower-ranked ${targetName}.`);
    if(!allowed&&!result.error)throw new Error(`${actorName} should not moderate ${targetName}.`);
  }

  console.log("Hosted V1 Voice discovery/join/audio/screen/private/role/ban/hierarchy matrix passed; no token, credential, participant history, or private room metadata was printed.");
}finally{
  for(const actor of actors.values())await actor.client.auth.signOut({scope:"local"});
}
