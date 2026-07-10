import { readFileSync } from "node:fs";
const flags=readFileSync("src/services/featureFlagService.ts","utf8");
const service=readFileSync("src/services/onboarding/onboardingExperimentService.ts","utf8");
const flow=readFileSync("src/components/onboarding/OnboardingFlow.tsx","utf8");
if(!flags.includes('"enableOnboardingExperiment"')||!flags.includes("enableOnboardingExperiment: false"))throw new Error("Onboarding experiment is not safely default-off.");
for(const marker of ["controlOrder","guidedOrder","recordStarted","recordCompleted","getAggregateResults","VITE_ONBOARDING_VARIANT"]){if(!service.includes(marker))throw new Error(`Missing experiment marker: ${marker}`);}
for(const forbidden of ['"userId"','"displayName"','"inviteCode"','"followedUserIds"','"timestamp"']){if(service.includes(forbidden))throw new Error(`Experiment aggregate stores forbidden detail: ${forbidden}`);}
for(const marker of ["canSkip","recordStarted(variant)","recordCompleted(variant)"]){if(!flow.includes(marker))throw new Error(`Onboarding flow marker missing: ${marker}`);}
console.log("Onboarding experiments smoke test passed.");
