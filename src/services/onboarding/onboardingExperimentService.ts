import type { OnboardingStepId } from "../../types/onboarding";
import { featureFlagService } from "../featureFlagService";

export type OnboardingExperimentVariant = "control" | "guided";
export type OnboardingExperimentAggregate = Readonly<{ started: number; completed: number }>;
type AggregateStore = Readonly<{ schemaVersion: 1; control: OnboardingExperimentAggregate; guided: OnboardingExperimentAggregate }>;

const STORAGE_KEY = "picom.onboardingExperiment.aggregate.v1";
const emptyStore: AggregateStore = { schemaVersion: 1, control: { started: 0, completed: 0 }, guided: { started: 0, completed: 0 } };
const labels: Record<OnboardingStepId, string> = { profile: "Profile", theme: "Theme", community: "Community", follow: "Follow", finish: "Finish" };
const controlOrder: OnboardingStepId[] = ["profile", "theme", "community", "follow", "finish"];
const guidedOrder: OnboardingStepId[] = ["profile", "community", "follow", "theme", "finish"];

function readStore(): AggregateStore {
  try { const parsed=JSON.parse(window.localStorage.getItem(STORAGE_KEY)??"null") as Partial<AggregateStore>|null; if(parsed?.schemaVersion===1&&parsed.control&&parsed.guided)return parsed as AggregateStore; } catch { /* restricted fallback */ }
  return emptyStore;
}
function writeStore(value: AggregateStore): void { try { window.localStorage.setItem(STORAGE_KEY,JSON.stringify(value)); } catch { /* restricted fallback */ } }
function hash(value: string): number { let result=2166136261;for(let index=0;index<value.length;index+=1){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return result>>>0; }
function configuredOverride(): OnboardingExperimentVariant | null { const value=import.meta.env.VITE_ONBOARDING_VARIANT;return value==="control"||value==="guided"?value:null; }

export const onboardingExperimentService = {
  getVariant(userId: string): OnboardingExperimentVariant {
    if (!featureFlagService.isEnabled("enableOnboardingExperiment")) return "control";
    return configuredOverride() ?? (hash(userId)%2===0?"control":"guided");
  },
  getSteps(variant: OnboardingExperimentVariant): Array<{ id: OnboardingStepId; label: string }> { return (variant==="guided"?guidedOrder:controlOrder).map((id)=>({id,label:labels[id]})); },
  recordStarted(variant: OnboardingExperimentVariant): void { const store=readStore();writeStore({...store,[variant]:{...store[variant],started:store[variant].started+1}}); },
  recordCompleted(variant: OnboardingExperimentVariant): void { const store=readStore();writeStore({...store,[variant]:{...store[variant],completed:store[variant].completed+1}}); },
  getAggregateResults(): AggregateStore { return readStore(); },
  resetForTesting(): void { try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* restricted fallback */ } },
};
