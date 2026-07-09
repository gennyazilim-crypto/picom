import type { Community } from "../types/community";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";
export type DiscoveryCategory="development"|"design"|"gaming"|"music"|"study"|"work";
export type DiscoveryCommunity=Readonly<{id:string;name:string;description:string;icon:string;accentColor:string;memberCount:number;visibility:"public";category:DiscoveryCategory}>;
const categories:DiscoveryCategory[]=["design","development","gaming","music","study","work"];
function fromCommunity(community:Community,index=0):DiscoveryCommunity{return{id:community.id,name:community.name,description:community.description??"A public Picom community.",icon:community.icon,accentColor:community.accentColor,memberCount:community.members.length,visibility:"public",category:community.discoveryCategory??categories[index%categories.length]}}
export const communityDiscoveryService={
 async listPublicCommunities(mockCommunities:Community[]):Promise<DiscoveryCommunity[]>{if(dataSourceService.getStatus().isMock)return mockCommunities.filter((community)=>community.visibility!=="private").map(fromCommunity);const client=getSupabaseClient();if(!client)return[];const {data}=await client.from("communities").select("id,name,description,icon_url,accent_color,visibility,public_read_enabled,discovery_listed,category").eq("visibility","public").eq("public_read_enabled",true).eq("discovery_listed",true).limit(60);return(data??[]).map((row)=>({id:row.id,name:row.name,description:row.description??"A public Picom community.",icon:row.icon_url??row.name.slice(0,2),accentColor:row.accent_color,memberCount:0,visibility:"public",category:(row.category??"work") as DiscoveryCategory}))}
};
