export type MunAwardPresetKey =
  | "best_delegate"
  | "outstanding_delegate"
  | "high_commendation"
  | "verbal_mention"
  | "special_mention"
  | "best_position_paper"
  | "best_chair"
  | "best_delegation";

export type MunAwardPreset = {
  key: MunAwardPresetKey;
  category: string;
  defaultPrizeTitle?: string;
  description?: string;
};

export const MUN_AWARD_PRESETS: MunAwardPreset[] = [
  { key: "best_delegate", category: "Best Delegate", defaultPrizeTitle: "Best Delegate" },
  { key: "outstanding_delegate", category: "Outstanding Delegate", defaultPrizeTitle: "Outstanding Delegate" },
  { key: "high_commendation", category: "High Commendation", defaultPrizeTitle: "High Commendation" },
  { key: "verbal_mention", category: "Verbal Mention", defaultPrizeTitle: "Verbal Mention" },
  { key: "special_mention", category: "Special Mention", defaultPrizeTitle: "Special Mention" },
  { key: "best_position_paper", category: "Best Position Paper", defaultPrizeTitle: "Best Position Paper" },
  { key: "best_chair", category: "Best Chair", defaultPrizeTitle: "Best Chair" },
  { key: "best_delegation", category: "Best Delegation", defaultPrizeTitle: "Best Delegation" },
];

export function getAwardPreset(key: string): MunAwardPreset | undefined {
  return MUN_AWARD_PRESETS.find((p) => p.key === key);
}
