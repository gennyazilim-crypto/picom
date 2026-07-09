const STORAGE_KEY = "picom.messageDrafts.v1";
export type DraftRecord = Readonly<{ text: string; updatedAt: string }>;
type DraftMap = Record<string, DraftRecord>;
export type DraftContext = Readonly<{ communityId: string; channelId: string; directConversationId?: never } | { directConversationId: string; communityId?: never; channelId?: never }>;
function storage():Storage|null{if(typeof window==="undefined")return null;try{return window.localStorage}catch{return null}}
function key(context:DraftContext){return context.directConversationId?`dm:${context.directConversationId}`:`community:${context.communityId}:channel:${context.channelId}`}
function legacyKey(context:DraftContext){return context.directConversationId?null:`${context.communityId}:${context.channelId}`}
function read():DraftMap{const target=storage();if(!target)return{};try{const parsed=JSON.parse(target.getItem(STORAGE_KEY)??"{}") as DraftMap;return parsed&&typeof parsed==="object"?parsed:{}}catch{return{}}}
function write(items:DraftMap){const target=storage();if(!target)return;try{target.setItem(STORAGE_KEY,JSON.stringify(items))}catch{/* best-effort; sending must not fail */}}
function getDraft(context:DraftContext):DraftRecord|null{const items=read();const current=items[key(context)];if(current)return current;const legacy=legacyKey(context);if(legacy&&items[legacy]){items[key(context)]=items[legacy];delete items[legacy];write(items);return items[key(context)]}return null}
function setDraft(context:DraftContext,text:string){const items=read();const target=key(context);if(!text.trim()){delete items[target];const legacy=legacyKey(context);if(legacy)delete items[legacy];write(items);return}items[target]={text,updatedAt:new Date().toISOString()};write(items)}
function clearDraft(context:DraftContext){const items=read();delete items[key(context)];const legacy=legacyKey(context);if(legacy)delete items[legacy];write(items)}
export const messageDraftService={getDraft,setDraft,saveDraft:setDraft,clearDraft,hasDraft(context:DraftContext){return Boolean(getDraft(context)?.text.trim())},getStorageKey(){return STORAGE_KEY}};
