import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  keys() { return [...this.#values.keys()]; }
}

const storage = new MemoryStorage();
globalThis.window = {
  localStorage: storage,
  addEventListener() {},
  removeEventListener() {},
};

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});

const {
  createAccountPrivacySetupService,
  PRIVACY_STEP_AUTH_STRATEGY,
  PRESENCE_PRIVACY_STATUS,
  DISCOVERABILITY_STATUS,
  LAST_SEEN_CONTROL_STATUS,
  scopePrivacyReadyStatus,
  friendRequestPrivacyLabelKey,
  directMessagePrivacyLabelKey,
  profileVisibilityLabelKey,
} = await vite.ssrLoadModule("/src/services/privacy/accountPrivacySetupService.ts");
const { firstLaunchPrivacyReadyLabel } = await vite.ssrLoadModule("/src/services/privacy/firstLaunchPrivacyReady.ts");
const { skipFirstLaunchSetupStep, createFirstLaunchSetupState, updateFirstLaunchSetupState } = await vite.ssrLoadModule("/src/services/firstLaunchSetupState.ts");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createHarness(options = {}) {
  let userId = Object.hasOwn(options, "userId") ? options.userId : "11111111-1111-4111-8111-111111111111";
  const calls = [];
  const store = {
    friend_request_privacy: options.friend ?? "community_members",
    dm_privacy: options.dm ?? "friends",
    profile: {
      profile_visibility: options.visibility ?? "friends",
      show_online_status: options.showOnlineStatus ?? false,
      show_location: true,
      show_timezone: true,
      show_activity: true,
      show_media: true,
      show_communities: true,
      show_friends: true,
      show_follows: true,
      show_audio: true,
    },
  };
  let failNext = options.failNext ?? null;
  let slowUpdate = options.slowUpdate ?? null;
  const listeners = new Set();

  const client = {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
      onAuthStateChange: (listener) => {
        listeners.add(listener);
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
      },
    },
    rpc: async (name, args = {}) => {
      calls.push({ type: "rpc", name, args, userId });
      if (!userId) return { data: null, error: { message: "AUTH_REQUIRED" } };
      if (failNext === name) {
        failNext = null;
        return { data: null, error: { message: "FAILED" } };
      }
      if (name === "get_own_profile_privacy_v3") return { data: [{ ...store.profile }], error: null };
      if (name === "get_direct_message_privacy") return { data: store.dm_privacy, error: null };
      if (name === "update_direct_message_privacy") {
        if (slowUpdate === name || slowUpdate?.name === name) await delay(slowUpdate?.ms ?? 30);
        store.dm_privacy = args.next_privacy;
        return { data: true, error: null };
      }
      if (name === "update_profile_privacy_v3") {
        if (slowUpdate === name || slowUpdate?.name === name) await delay(slowUpdate?.ms ?? 30);
        store.profile = {
          ...store.profile,
          profile_visibility: args.next_visibility,
          show_online_status: args.next_show_online_status,
          show_location: args.next_show_location,
          show_timezone: args.next_show_timezone,
          show_activity: args.next_show_activity,
          show_media: args.next_show_media,
          show_communities: args.next_show_communities,
          show_friends: args.next_show_friends,
          show_follows: args.next_show_follows,
          show_audio: args.next_show_audio,
        };
        return { data: true, error: null };
      }
      return { data: null, error: { message: "UNKNOWN_RPC" } };
    },
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          maybeSingle: async () => {
            calls.push({ type: "select", table, columns, column, value, userId });
            if (!userId || value !== userId) return { data: null, error: { message: "DENIED" } };
            return { data: { friend_request_privacy: store.friend_request_privacy }, error: null };
          },
        }),
      }),
      update: (values) => ({
        eq: (column, value) => ({
          select: () => ({
            maybeSingle: async () => {
              calls.push({ type: "update", table, values, column, value, userId });
              if (!userId || value !== userId) return { data: null, error: { message: "DENIED" } };
              if (failNext === "friend_request_privacy") {
                failNext = null;
                return { data: null, error: { message: "FAILED" } };
              }
              store.friend_request_privacy = values.friend_request_privacy;
              return { data: { friend_request_privacy: store.friend_request_privacy }, error: null };
            },
          }),
        }),
      }),
    }),
  };

  const service = createAccountPrivacySetupService({
    isSupabase: () => options.isSupabase !== false,
    getClient: () => options.missingClient ? null : client,
  });

  return {
    service,
    calls,
    store,
    setUser(next) {
      userId = next;
      for (const listener of listeners) listener();
    },
    failNext(name) { failNext = name; },
  };
}

assert.equal(PRIVACY_STEP_AUTH_STRATEGY, "INTERACTIVE_ONLY_WHEN_AUTHENTICATED");
assert.equal(PRESENCE_PRIVACY_STATUS, "EXISTING_REAL");
assert.equal(DISCOVERABILITY_STATUS, "NOT_EXPOSED");
assert.equal(LAST_SEEN_CONTROL_STATUS, "NOT_EXPOSED");

const anonymous = createHarness({ userId: null });
assert.deepEqual(await anonymous.service.hydrate(), { status: "anonymous" });
assert.equal(anonymous.calls.some((call) => call.type === "rpc" || call.type === "update"), false, "CASE 01/02: anonymous hydrate must not mutate or call privacy RPCs");
assert.deepEqual(await anonymous.service.updateDirectMessagePrivacy("11111111-1111-4111-8111-111111111111", "no_one"), { ok: false, reason: "anonymous" });
assert.equal(anonymous.calls.some((call) => call.type === "update" || call.name === "update_direct_message_privacy"), false, "CASE 01: anonymous mutation is denied");

const unavailable = createHarness({ isSupabase: false, userId: "11111111-1111-4111-8111-111111111111" });
assert.deepEqual(await unavailable.service.hydrate(), { status: "unavailable" });
assert.deepEqual(await unavailable.service.updateFriendRequestPrivacy("11111111-1111-4111-8111-111111111111", "nobody"), { ok: false, reason: "unavailable" });

const missing = createHarness({ missingClient: true });
assert.deepEqual(await missing.service.hydrate(), { status: "unavailable" });

const accountA = "11111111-1111-4111-8111-111111111111";
const accountB = "22222222-2222-4222-8222-222222222222";
const ready = createHarness({
  userId: accountA,
  friend: "nobody",
  dm: "no_one",
  visibility: "friends",
  showOnlineStatus: false,
});
const loaded = await ready.service.hydrate();
assert.equal(loaded.status, "ready");
assert.equal(loaded.snapshot.accountId, accountA);
assert.equal(loaded.snapshot.friendRequestPrivacy, "nobody");
assert.equal(loaded.snapshot.directMessagePrivacy, "no_one");
assert.equal(loaded.snapshot.profile.visibility, "friends");
assert.equal(loaded.snapshot.profile.showOnlineStatus, false);
assert.equal(storage.keys().some((key) => String(key).includes("privacy")), false, "CASE 03/04/27: restrictive server values hydrate without a local privacy cache");

const invalidFriend = await ready.service.updateFriendRequestPrivacy(accountA, "everyone_plus");
assert.deepEqual(invalidFriend, { ok: false, reason: "rejected" });
assert.equal(ready.store.friend_request_privacy, "nobody", "CASE 08: invalid friend enum is rejected");

const invalidDm = await ready.service.updateDirectMessagePrivacy(accountA, "community_members");
assert.deepEqual(invalidDm, { ok: false, reason: "rejected" });
assert.equal(ready.store.dm_privacy, "no_one", "CASE 16: invalid DM enum is rejected");

const invalidProfile = await ready.service.updateProfile(accountA, { visibility: "private" });
assert.deepEqual(invalidProfile, { ok: false, reason: "rejected" });
assert.equal(ready.store.profile.profile_visibility, "friends");

const spoof = await ready.service.updateFriendRequestPrivacy(accountB, "everyone");
assert.deepEqual(spoof, { ok: false, reason: "account_changed" });
assert.equal(ready.store.friend_request_privacy, "nobody", "CASE 09/38: another account id cannot mutate this session");

const friendOk = await ready.service.updateFriendRequestPrivacy(accountA, "community_members");
assert.equal(friendOk.ok, true);
assert.equal(friendOk.snapshot.friendRequestPrivacy, "community_members");
assert.equal(ready.store.friend_request_privacy, "community_members");

const dmOk = await ready.service.updateDirectMessagePrivacy(accountA, "friends");
assert.equal(dmOk.ok, true);
assert.equal(dmOk.snapshot.directMessagePrivacy, "friends");

const profileOk = await ready.service.updateProfile(accountA, { visibility: "shared_communities", showOnlineStatus: true });
assert.equal(profileOk.ok, true);
assert.equal(profileOk.snapshot.profile.visibility, "shared_communities");
assert.equal(profileOk.snapshot.profile.showOnlineStatus, true);
assert.equal(ready.store.profile.show_online_status, true, "CASE 23/24: presence preference persists through profile privacy RPC");

ready.failNext("update_direct_message_privacy");
const failed = await ready.service.updateDirectMessagePrivacy(accountA, "everyone");
assert.equal(failed.ok, false);
assert.equal(ready.store.dm_privacy, "friends", "CASE 31/32: failed mutation does not keep a false success");

const race = createHarness({ userId: accountA, dm: "everyone", slowUpdate: { name: "update_direct_message_privacy", ms: 40 } });
const first = race.service.updateDirectMessagePrivacy(accountA, "friends");
await delay(5);
const second = race.service.updateDirectMessagePrivacy(accountA, "no_one");
const [firstResult, secondResult] = await Promise.all([first, second]);
assert.equal(firstResult.ok && secondResult.ok, true);
assert.equal(race.store.dm_privacy, "no_one", "CASE 34: latest confirmed DM policy wins");

ready.setUser(accountB);
ready.store.friend_request_privacy = "everyone";
ready.store.dm_privacy = "everyone";
ready.store.profile.profile_visibility = "everyone";
ready.store.profile.show_online_status = true;
const switched = await ready.service.hydrate();
assert.equal(switched.status, "ready");
assert.equal(switched.snapshot.accountId, accountB);
assert.equal(switched.snapshot.friendRequestPrivacy, "everyone");
assert.notEqual(switched.snapshot.accountId, accountA, "CASE 05/42: account switch hydrates the new account");

const inFlight = createHarness({ userId: accountA, dm: "friends", slowUpdate: { name: "update_direct_message_privacy", ms: 40 } });
const pending = inFlight.service.updateDirectMessagePrivacy(accountA, "no_one");
inFlight.setUser(accountB);
const afterSwitch = await pending;
assert.equal(afterSwitch.ok, false);
assert.equal(afterSwitch.reason, "account_changed", "CASE 43: in-flight mutation cannot land on the next account");

const t = (key) => key;
assert.deepEqual(scopePrivacyReadyStatus({ status: "ready", snapshot: loaded.snapshot }, accountB), { status: "loading" }, "CASE 42/44: an account switch clears the prior account summary before it can render");
assert.deepEqual(scopePrivacyReadyStatus({ status: "ready", snapshot: loaded.snapshot }, null), { status: "anonymous" }, "CASE 42: signing out clears the prior account summary");
assert.deepEqual(firstLaunchPrivacyReadyLabel(null, true, t), [{ term: "ready.privacy", value: "ready.privacySkipped" }]);
assert.deepEqual(firstLaunchPrivacyReadyLabel({ status: "anonymous" }, false, t), [{ term: "ready.privacy", value: "privacy.reviewAfterSignIn" }]);
assert.deepEqual(firstLaunchPrivacyReadyLabel({ status: "unavailable" }, false, t), [{ term: "ready.privacy", value: "privacy.loadFailed" }]);
const readyRows = firstLaunchPrivacyReadyLabel({
  status: "ready",
  snapshot: {
    accountId: accountA,
    friendRequestPrivacy: "community_members",
    directMessagePrivacy: "friends",
    profile: {
      visibility: "shared_communities",
      showOnlineStatus: false,
      showLocation: true,
      showTimezone: true,
      showActivity: true,
      showMedia: true,
      showCommunities: true,
      showFriends: true,
      showFollows: true,
      showAudio: true,
    },
  },
}, false, t);
assert.deepEqual(readyRows.map((row) => row.value), [
  "privacy.friendRequests.communityMembers",
  "privacy.dm.friends",
  "privacy.profile.sharedCommunities",
  "privacy.presence.hide",
]);

const seed = typeof createFirstLaunchSetupState === "function"
  ? createFirstLaunchSetupState({ completed: false, locale: "en", theme: "dark" })
  : null;
if (seed) {
  const onPrivacy = updateFirstLaunchSetupState(seed, { reviewAllSetup: true, currentStep: "privacy" });
  const skipped = skipFirstLaunchSetupStep(onPrivacy, "privacy");
  assert.deepEqual(skipped.skippedStepIds, ["privacy"]);
  assert.equal(skipped.currentStep, "ready");
}

assert.equal(friendRequestPrivacyLabelKey("community_members"), "privacy.friendRequests.community_members");
assert.equal(directMessagePrivacyLabelKey("no_one"), "privacy.dm.no_one");
assert.equal(profileVisibilityLabelKey("shared_communities"), "privacy.profile.sharedCommunities");

const setupSource = readFileSync("src/components/firstLaunch/FirstLaunchSetup.tsx", "utf8");
const privacySource = readFileSync("src/components/firstLaunch/FirstLaunchPrivacySetup.tsx", "utf8");
const serviceSource = readFileSync("src/services/privacy/accountPrivacySetupService.ts", "utf8");
assert.ok(setupSource.includes("<FirstLaunchPrivacySetup"), "Privacy step must render the account privacy setup");
assert.ok(!setupSource.includes("InformationPage"), "Placeholder privacy information page must not remain");
assert.ok(privacySource.includes('role="radiogroup"') && privacySource.includes("aria-busy") && privacySource.includes('role="alert"'));
assert.ok(!privacySource.includes("last seen") && !privacySource.includes("lastSeen") && !privacySource.includes("discoverability"));
assert.ok(!serviceSource.includes("localStorage") && !serviceSource.includes("picom.firstLaunch.privacy"));
assert.ok(serviceSource.includes("get_own_profile_privacy_v3") && serviceSource.includes("update_direct_message_privacy"));

assert.equal(storage.keys().some((key) => String(key).includes("firstLaunch") && String(key).includes("privacy")), false, "CASE 03: no first-launch privacy device cache");

await vite.close();
console.log("First-launch privacy runtime: auth boundary, hydration, mutation, skip, and account-switch cases passed.");
