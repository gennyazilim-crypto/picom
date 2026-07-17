import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const config={host:process.env.PICOM_VERIFY_BIND_HOST?.trim()||"127.0.0.1",port:Number(process.env.PICOM_VERIFY_PORT||"8787"),
  sharedSecret:process.env.PICOM_VERIFY_SHARED_SECRET?.trim()||"",ariUrl:process.env.ASTERISK_ARI_URL?.trim()||"http://127.0.0.1:8088/ari/",
  ariUsername:process.env.ASTERISK_ARI_USERNAME?.trim()||"",ariPassword:process.env.ASTERISK_ARI_PASSWORD?.trim()||"",
  outboundEndpoint:process.env.ASTERISK_OUTBOUND_ENDPOINT?.trim()||"",callerId:process.env.ASTERISK_CALLER_ID?.trim()||"Picom"};
if(!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error("PICOM_VERIFY_PORT is invalid.");
if(config.sharedSecret.length<32)throw new Error("PICOM_VERIFY_SHARED_SECRET must contain at least 32 characters.");
if(!config.ariUsername||!config.ariPassword)throw new Error("Asterisk ARI credentials are required.");
if(!/^[A-Za-z0-9_.-]{1,64}$/.test(config.outboundEndpoint))throw new Error("ASTERISK_OUTBOUND_ENDPOINT is invalid.");
const ariBase=new URL(config.ariUrl);if(!new Set(["http:","https:"]).has(ariBase.protocol))throw new Error("ASTERISK_ARI_URL is invalid.");if(!ariBase.pathname.endsWith("/"))ariBase.pathname+="/";
const maximumBodyBytes=16*1024,signatureWindowSeconds=90,usedNonces=new Map();
function json(response,status,payload){const body=JSON.stringify(payload);response.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(body),"cache-control":"no-store","x-content-type-options":"nosniff"});response.end(body)}
function safeEqualHex(left,right){if(!/^[a-f0-9]{64}$/.test(left)||!/^[a-f0-9]{64}$/.test(right))return false;return timingSafeEqual(Buffer.from(left,"hex"),Buffer.from(right,"hex"))}
function authenticate(request,rawBody){const timestamp=request.headers["x-picom-timestamp"],nonce=request.headers["x-picom-nonce"],supplied=request.headers["x-picom-signature"];
  if(typeof timestamp!=="string"||typeof nonce!=="string"||typeof supplied!=="string"||!/^[0-9]{10}$/.test(timestamp)||!/^[0-9a-f-]{36}$/i.test(nonce))return false;
  const now=Math.floor(Date.now()/1000);if(Math.abs(now-Number(timestamp))>signatureWindowSeconds||usedNonces.has(nonce))return false;
  const expected=createHmac("sha256",config.sharedSecret).update(`${timestamp}.${nonce}.${rawBody}`).digest("hex"),signature=supplied.startsWith("sha256=")?supplied.slice(7):"";
  if(!safeEqualHex(expected,signature))return false;usedNonces.set(nonce,now+signatureWindowSeconds);for(const[key,expiry]of usedNonces)if(expiry<now)usedNonces.delete(key);return true}
function validatePayload(value){if(!value||typeof value!=="object")return null;const{requestId,phone,code,expiresAt}=value;
  if(typeof requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(requestId)||typeof phone!=="string"||!/^\+[1-9][0-9]{7,14}$/.test(phone)||typeof code!=="string"||!/^[0-9]{6}$/.test(code)||typeof expiresAt!=="string")return null;
  const expiry=Date.parse(expiresAt);if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+10*60*1000)return null;return{requestId,phone,code,expiresAt}}
async function readBody(request){const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>maximumBodyBytes)throw new Error("PAYLOAD_TOO_LARGE");chunks.push(chunk)}return Buffer.concat(chunks).toString("utf8")}
async function originateCall(payload){const url=new URL("channels",ariBase);url.searchParams.set("endpoint",`PJSIP/${payload.phone}@${config.outboundEndpoint}`);url.searchParams.set("extension","s");url.searchParams.set("context","picom-verify");url.searchParams.set("priority","1");url.searchParams.set("callerId",config.callerId);url.searchParams.set("timeout","30");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const response=await fetch(url,{method:"POST",headers:{authorization:`Basic ${Buffer.from(`${config.ariUsername}:${config.ariPassword}`).toString("base64")}`,"content-type":"application/json"},body:JSON.stringify({variables:{PICOM_VERIFY_CODE:payload.code,PICOM_VERIFY_REQUEST_ID:payload.requestId}}),signal:controller.signal});if(!response.ok)throw new Error(`ASTERISK_ORIGINATE_${response.status}`)}finally{clearTimeout(timer)}}
const server=createServer(async(request,response)=>{if(request.method==="GET"&&request.url==="/health")return json(response,200,{status:"ok",transport:"asterisk_ari"});if(request.method!=="POST"||request.url!=="/v1/calls/start")return json(response,404,{error:"NOT_FOUND"});
  try{const rawBody=await readBody(request);if(!authenticate(request,rawBody))return json(response,401,{error:"INVALID_SIGNATURE"});let parsed;try{parsed=JSON.parse(rawBody)}catch{return json(response,400,{error:"INVALID_JSON"})}const payload=validatePayload(parsed);if(!payload)return json(response,400,{error:"INVALID_PAYLOAD"});await originateCall(payload);console.log(JSON.stringify({level:"info",event:"verification_call_queued",requestId:payload.requestId}));return json(response,202,{ok:true,requestId:payload.requestId,status:"queued"})}
  catch(error){const code=error instanceof Error?error.message:"UNKNOWN",status=code==="PAYLOAD_TOO_LARGE"?413:503;console.error(JSON.stringify({level:"error",event:"verification_call_failed",code}));return json(response,status,{error:status===413?"PAYLOAD_TOO_LARGE":"CALL_TRANSPORT_UNAVAILABLE"})}});
server.listen(config.port,config.host,()=>console.log(JSON.stringify({level:"info",event:"secret_voice_gateway_ready",host:config.host,port:config.port})));
function shutdown(signal){console.log(JSON.stringify({level:"info",event:"secret_voice_gateway_stopping",signal}));server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),5000).unref()}
process.on("SIGTERM",()=>shutdown("SIGTERM"));process.on("SIGINT",()=>shutdown("SIGINT"));