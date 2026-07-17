import { useCallback, useEffect, useState } from "react";
import type { Community, Member } from "../types/community";
import type { CommunityInvitePreview, InviteAcceptanceStatus } from "../services/community/communityInviteService";
import { communityInviteService } from "../services/community/communityInviteService";
import { secretCommunityService, type SecretCommunityEligibility, type SecretCommunityInvite, type SecretCommunityInvitePreview, type SecretInviteCampaign } from "../services/community/secretCommunityService";
import { clipboardService } from "../services/clipboardService";
import { AppIcon } from "./AppIcon";
import "./SecretCommunityFlows.css";

export function SecretCommunityEligibilityPanel({purpose="create",onEligibilityChange}:{purpose?:"create"|"join";onEligibilityChange:(eligible:boolean)=>void}){
  const [eligibility,setEligibility]=useState<SecretCommunityEligibility|null>(null);
  const [phone,setPhone]=useState("");const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState<string|null>(null);
  const load=useCallback(async()=>{
    const result=await secretCommunityService.getEligibility();
    if(!result.ok){setMessage(result.error.message);onEligibilityChange(false);return;}
    setEligibility(result.data);
    onEligibilityChange(result.data.phoneVerified&&result.data.voiceCallVerified&&!result.data.accountSuspended&&(purpose==="join"||!result.data.creationRestricted));
  },[onEligibilityChange,purpose]);
  useEffect(()=>{void load();},[load]);
  const start=async()=>{setBusy(true);setMessage(null);const result=await secretCommunityService.startVoiceVerification(phone);
    setMessage(result.ok?"Picom started the verification call. Enter the spoken code below.":result.error.message);setBusy(false);};
  const verify=async()=>{setBusy(true);setMessage(null);const result=await secretCommunityService.checkVoiceVerification(phone,code);
    if(result.ok){setMessage("Phone and voice-call verification completed.");await load();}else setMessage(result.error.message);setBusy(false);};
  return <section className="secret-eligibility" aria-label="Secret community account verification">
    <header><AppIcon name="lock" size="md"/><div><strong>Verified private access</strong><small>A unique phone number and a completed voice call are required.</small></div></header>
    <ul className="secret-status-list">
      <li className={eligibility?.phoneVerified?"is-ready":""}><span/>Phone ownership {eligibility?.phoneLast4?"ending "+eligibility.phoneLast4:"not verified"}</li>
      <li className={eligibility?.voiceCallVerified?"is-ready":""}><span/>Voice-call verification {eligibility?.voiceCallVerified?"complete":"required"}</li>
      <li className={!eligibility?.accountSuspended?"is-ready":"is-blocked"}><span/>Account {eligibility?.accountSuspended?"suspended":"active"}</li>
      {purpose==="create"?<li className={!eligibility?.creationRestricted?"is-ready":"is-blocked"}><span/>Community creation {eligibility?.creationRestricted?"restricted":"allowed"}</li>:null}
    </ul>
    {!eligibility?.phoneVerified||!eligibility?.voiceCallVerified?<div className="secret-verification-form">
      <label>Phone number in international format<input value={phone} onChange={(event)=>setPhone(event.target.value)} placeholder="+491234567890" autoComplete="tel"/></label>
      <button type="button" className="secondary-action" disabled={busy||!/^\+[1-9][0-9]{7,14}$/.test(phone.replace(/[\s()-]/g,""))} onClick={()=>void start()}><AppIcon name="voice" size="sm"/>Call me with a code</button>
      <label>Code from the call<input value={code} onChange={(event)=>setCode(event.target.value.replace(/\D/g,""))} inputMode="numeric" maxLength={10}/></label>
      <button type="button" className="secondary-action" disabled={busy||!/^[0-9]{4,10}$/.test(code)} onClick={()=>void verify()}>Verify code</button>
    </div>:null}
    {message?<p className="secret-flow-message" role="status">{message}</p>:null}
  </section>;
}

export function SecretInvitePeoplePanel({community,canCreate,onClose}:{community:Community;currentUserId:string;canCreate:boolean;onClose:()=>void}){
  const [username,setUsername]=useState("");const [invite,setInvite]=useState<SecretCommunityInvite|null>(null);
  const [campaigns,setCampaigns]=useState<readonly SecretInviteCampaign[]>([]);
  const [message,setMessage]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{if(!canCreate)return;const result=await secretCommunityService.listInvites(community.id);
    if(result.ok)setCampaigns(result.data);else setMessage(result.error.message);},[canCreate,community.id]);
  useEffect(()=>{void load();},[load]);
  const create=async()=>{setBusy(true);setMessage(null);setInvite(null);const result=await secretCommunityService.createInvite(community.id,username);
    if(result.ok){setInvite(result.data);setUsername("");setMessage("Private invitation created and delivered through Picom notification, DM when allowed, and email.");await load();}
    else setMessage(result.error.message);setBusy(false);};
  const copy=async()=>{if(!invite)return;const result=await clipboardService.copyText(secretCommunityService.getInviteLink(invite.code));
    setMessage(result.ok?"Private invitation link copied. It is visible only in this session.":result.reason);};
  const revoke=async(id:string)=>{setBusy(true);const result=await secretCommunityService.revokeInvite(id);
    setMessage(result.ok?"Invitation revoked.":result.error.message);if(result.ok){if(invite?.id===id)setInvite(null);await load();}setBusy(false);};
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="community-modal secret-invite-modal" role="dialog" aria-modal="true" aria-labelledby="secret-invite-title" onMouseDown={(event)=>event.stopPropagation()}>
    <button type="button" className="icon-button modal-close" aria-label="Close private invitation" onClick={onClose}><AppIcon name="close" size="lg"/></button>
    <header><span className="eyebrow">Recipient-bound access</span><h2 id="secret-invite-title">Invite to {community.name}</h2><p>Every link is bound to one Picom account, expires in exactly one hour, and is invalidated after acceptance or departure.</p></header>
    {!canCreate?<p className="auth-error">Your community role cannot create private invitations.</p>:<>
      <label className="invite-code-field"><span>Recipient username</span><input value={username} onChange={(event)=>setUsername(event.target.value)} placeholder="username" autoFocus/></label>
      <div className="secret-invite-contract"><span><AppIcon name="lock" size="sm"/>One account</span><span>1 hour</span><span>Maximum 5 uses</span></div>
      <button type="button" className="send-button" disabled={busy||username.trim().length<2} onClick={()=>void create()}><AppIcon name="send" size="sm"/>{busy?"Securing...":"Create and deliver invitation"}</button>
      {invite?<section className="secret-one-time-credential" aria-label="One-time invitation credential"><strong>Copy this link now</strong><code>{secretCommunityService.getInviteLink(invite.code)}</code><button type="button" className="secondary-action" onClick={()=>void copy()}>Copy link</button><small>Picom stores only its cryptographic hash. The raw link cannot be shown again.</small></section>:null}
      <section className="secret-invite-list"><h3>Recent invitations</h3>{campaigns.length?campaigns.map((item)=><article key={item.id}><div><strong>@{item.recipientUsername}</strong><small>{item.acceptedAt?"Accepted":item.revokedAt?"Revoked":new Date(item.expiresAt)<=new Date()?"Expired":"Active until "+new Date(item.expiresAt).toLocaleTimeString()}</small></div>{!item.revokedAt&&!item.acceptedAt?<button type="button" className="secondary-action" disabled={busy} onClick={()=>void revoke(item.id)}>Revoke</button>:null}</article>):<p>No private invitations have been created.</p>}</section>
    </>}
    {message?<p className="secret-flow-message" role="status">{message}</p>:null}
  </section></div>;
}

type PreviewState={kind:"standard";data:CommunityInvitePreview}|{kind:"secret";data:SecretCommunityInvitePreview};
export function SecretAwareJoinWithInviteModal({initialCode="",isAuthenticated,communities,currentUser,onClose,onAccepted}:{initialCode?:string;isAuthenticated:boolean;communities:Community[];currentUser:Member;onClose:()=>void;onAccepted:(communityId:string,member:Member,status:InviteAcceptanceStatus,preview:CommunityInvitePreview)=>void|Promise<void>}){
  const [code,setCode]=useState(initialCode);const [preview,setPreview]=useState<PreviewState|null>(null);
  const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(false);const [error,setError]=useState<string|null>(null);
  const [warningsAccepted,setWarningsAccepted]=useState(false);const [rulesAccepted,setRulesAccepted]=useState(false);
  const [verificationReady,setVerificationReady]=useState(false);const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if(code.trim().length<8||!isAuthenticated){setPreview(null);setLoading(false);return;}
    let active=true;setLoading(true);setError(null);setPreview(null);
    const timer=window.setTimeout(async()=>{
      const standard=await communityInviteService.getInvitePreview(code, communities);
      if(!active)return;
      if(standard.ok){setPreview({kind:"standard",data:standard.data});setLoading(false);return;}
      const secret=await secretCommunityService.previewInvite(code);if(!active)return;
      if(secret.ok){setPreview({kind:"secret",data:secret.data});setVerificationReady(secret.data.verification.phoneVerified&&secret.data.verification.voiceCallVerified&&!secret.data.verification.accountSuspended&&!secret.data.verification.accountRestricted);}
      else setError(secret.error.message);setLoading(false);
    },250);
    return()=>{active=false;window.clearTimeout(timer);};
  },[code,communities,isAuthenticated,revision]);
  const accept=async()=>{if(!preview)return;setBusy(true);setError(null);
    const result=preview.kind==="secret"
      ?await secretCommunityService.acceptInvite({code,warningVersion:preview.data.warningVersion,rulesVersion:preview.data.rulesVersion,warningsAccepted,rulesAccepted,currentUser})
      :await communityInviteService.acceptInvite({code,communities,currentUser,isAuthenticated});
    if(!result.ok){setError(result.error.message);setBusy(false);return;}
    await onAccepted(result.data.communityId,result.data.member,result.data.status,preview.data);onClose();};
  const secret=preview?.kind==="secret"?preview.data:null;
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="community-modal secret-join-modal" role="dialog" aria-modal="true" aria-labelledby="invite-join-title" onMouseDown={(event)=>event.stopPropagation()}>
    <button type="button" className="icon-button modal-close" aria-label="Close invitation" onClick={onClose}><AppIcon name="close" size="lg"/></button>
    <header><span className="eyebrow">Private access</span><h2 id="invite-join-title">Join with invitation</h2><p>Picom validates the invitation and your account before revealing protected community details.</p></header>
    <label className="invite-code-field"><span>Invitation code or link</span><input autoFocus value={code} onChange={(event)=>setCode(event.target.value)} placeholder="picom://invite/..."/></label>
    {!isAuthenticated?<p className="auth-error">Sign in before opening a private invitation.</p>:null}
    {loading?<p className="community-rules-status">Checking invitation...</p>:null}
    {preview?<section className="community-confirm-panel"><p className="eyebrow">{preview.data.communityKind} community</p><h3>{preview.data.communityName}</h3><p>{preview.data.description??"No description has been published."}</p><dl><div><dt>Members</dt><dd>{preview.data.memberCount}</dd></div><div><dt>Access</dt><dd>{preview.kind==="secret"?"Recipient only":preview.data.visibility}</dd></div><div><dt>Expires</dt><dd>{preview.data.expiresAt?new Date(preview.data.expiresAt).toLocaleString():"No expiry"}</dd></div></dl></section>:null}
    {secret?<>
      <section className="secret-warning-panel"><h3>Security warnings</h3>{secret.warnings.map((warning)=><p key={warning}><AppIcon name="lock" size="xs"/>{warning}</p>)}<label><input type="checkbox" checked={warningsAccepted} onChange={(event)=>setWarningsAccepted(event.target.checked)}/>I understand and accept every security warning.</label></section>
      <section className="secret-rules-panel"><h3>Community rules</h3>{secret.rules.map((rule)=><article key={rule.id}><strong>{rule.title}</strong><p>{rule.body}</p></article>)}<label><input type="checkbox" checked={rulesAccepted} onChange={(event)=>setRulesAccepted(event.target.checked)}/>I accept the current community rules.</label></section>
      {!verificationReady?<SecretCommunityEligibilityPanel purpose="join" onEligibilityChange={(ready)=>{setVerificationReady(ready);if(ready)setRevision((value)=>value+1);}}/>:null}
    </>:null}
    {error?<p className="auth-error" role="alert">{error}</p>:null}
    <footer className="secret-flow-footer"><button type="button" className="secondary-action" onClick={onClose}>Cancel</button><button type="button" className="send-button" disabled={busy||!preview||(preview.kind==="secret"&&(!verificationReady||!warningsAccepted||!rulesAccepted))} onClick={()=>void accept()}>{busy?"Joining...":"Join community"}</button></footer>
  </section></div>;
}
