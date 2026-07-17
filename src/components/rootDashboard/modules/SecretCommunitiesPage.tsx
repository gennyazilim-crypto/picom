import { useCallback, useEffect, useState } from "react";
import { AppIcon } from "../../AppIcon";
import { secretCommunityOperationsService, type RootSecretCommunityDetail, type RootSecretCommunitySummary } from "../../../services/rootDashboard/secretCommunityOperationsService";
import "./SecretCommunitiesPage.css";

export function SecretCommunitiesPage(){
  const [items,setItems]=useState<readonly RootSecretCommunitySummary[]>([]);
  const [selected,setSelected]=useState<RootSecretCommunitySummary|null>(null);
  const [detail,setDetail]=useState<RootSecretCommunityDetail|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [delta,setDelta]=useState("0");const [reason,setReason]=useState("");
  const load=useCallback(async()=>{const result=await secretCommunityOperationsService.list();
    if(result.ok){setItems(result.data);setSelected((current)=>current??result.data[0]??null);}else setMessage(result.message);},[]);
  useEffect(()=>{void load();return secretCommunityOperationsService.subscribe(()=>void load());},[load]);
  useEffect(()=>{if(!selected){setDetail(null);return;}let active=true;
    void secretCommunityOperationsService.detail(selected.id).then((result)=>{if(active){if(result.ok)setDetail(result.data);else setMessage(result.message);}});
    return()=>{active=false;};},[selected]);
  const adjust=async()=>{if(!selected)return;const result=await secretCommunityOperationsService.adjustTrust(selected.id,Number(delta),reason);
    setMessage(result.ok?"Root trust adjustment recorded in the immutable timeline.":result.message);
    if(result.ok){setReason("");setDelta("0");await load();const refreshed=await secretCommunityOperationsService.detail(selected.id);if(refreshed.ok)setDetail(refreshed.data);}};
  return <section className="root-secret-page"><header><div><span className="eyebrow">Root-only operations</span><h1>Secret communities</h1><p>Operational metadata, invisible trust scoring, invitations, and security events. Credentials and raw phone numbers are never shown.</p></div><button type="button" className="secondary-action" onClick={()=>void load()}><AppIcon name="search" size="sm"/>Refresh</button></header>
    {message?<p className="root-secret-message" role="status">{message}</p>:null}
    <div className="root-secret-layout"><div className="root-secret-list">{items.map((item)=><button type="button" key={item.id} className={selected?.id===item.id?"is-active":""} onClick={()=>setSelected(item)}><span><strong>{item.name}</strong><small>{item.kind} / {item.ownerName}</small></span><span className={"risk risk--"+item.riskLevel}>{item.trustScore}</span><small>{item.memberCount} members / {item.activeInviteCount} active invites</small></button>)}{!items.length?<p>No secret communities exist.</p>:null}</div>
      <div className="root-secret-detail">{selected&&detail?<><section className="root-secret-kpis"><article><small>Trust score</small><strong>{String(detail.trust.score??selected.trustScore)}</strong></article><article><small>Risk</small><strong>{String(detail.trust.risk_level??selected.riskLevel)}</strong></article><article><small>Incidents</small><strong>{String(detail.trust.incident_count??selected.incidentCount)}</strong></article><article><small>Invites</small><strong>{detail.invites.length}</strong></article></section>
        <section className="root-secret-card"><h2>Recommendation</h2><p>{String(detail.trust.recommendation??selected.recommendation)}</p></section>
        <section className="root-secret-card"><h2>Root adjustment</h2><div className="root-secret-adjust"><input type="number" min="-25" max="25" value={delta} onChange={(event)=>setDelta(event.target.value)} aria-label="Trust score delta"/><input value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Reason (minimum 8 characters)"/><button type="button" className="secondary-action" disabled={reason.trim().length<8||Number(delta)===0||Math.abs(Number(delta))>25} onClick={()=>void adjust()}>Record</button></div></section>
        <section className="root-secret-card"><h2>Security timeline</h2><div className="root-secret-timeline">{detail.events.map((event)=><article key={String(event.id)}><span className={"severity severity--"+String(event.severity)}>{String(event.severity)}</span><div><strong>{String(event.event_type)}</strong><p>{String(event.reason)}</p><small>{new Date(String(event.created_at)).toLocaleString()}</small></div></article>)}</div></section>
      </>:<p>Select a secret community to inspect its operational record.</p>}</div>
    </div></section>;
}
