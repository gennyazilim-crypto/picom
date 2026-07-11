export type DirectMessagePrivacy = "everyone" | "friends" | "no_one";

export type DirectMuteDuration = "one_hour" | "eight_hours" | "one_day" | "until_changed";

export const directMuteDurationLabels: Readonly<Record<DirectMuteDuration, string>> = {
  one_hour: "For 1 hour",
  eight_hours: "For 8 hours",
  one_day: "For 24 hours",
  until_changed: "Until I turn it back on",
};
