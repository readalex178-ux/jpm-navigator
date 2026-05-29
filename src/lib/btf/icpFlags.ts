// ICP green/red flag checker — BTF qualification cheatsheet.
// Each flag is binary; greens add to score, reds subtract.

export type IcpFlag = {
  id: string;
  label: string;
  hint?: string;
  weight: number; // points added to qualScore when checked
};

export const ICP_GREEN_FLAGS: IcpFlag[] = [
  { id: "g_offer", label: "Has a clear offer (1:1, group, course)", weight: 8 },
  { id: "g_calendar", label: "Calendar / booking link in bio", weight: 8 },
  { id: "g_posting", label: "Posting 2+ times per week", weight: 6 },
  { id: "g_scale", label: "Talks about scaling / hiring", weight: 10 },
  { id: "g_testimonials", label: "Shares client wins regularly", weight: 6 },
  { id: "g_decision", label: "Confirmed decision maker", weight: 12 },
  { id: "g_money", label: "Already earning (showing revenue)", weight: 10 },
];

export const ICP_RED_FLAGS: IcpFlag[] = [
  { id: "r_employee", label: "Employee — not the buyer", weight: -15 },
  { id: "r_no_offer", label: "No visible offer or service", weight: -12 },
  { id: "r_inactive", label: "Inactive (last post > 60d)", weight: -8 },
  { id: "r_competitor", label: "Competitor (setter/agency)", weight: -20 },
  { id: "r_broke", label: "Hard pricing complaints / broke language", weight: -10 },
  { id: "r_mlm", label: "MLM / pyramid scheme", weight: -15 },
  { id: "r_starter", label: "Brand new (< 90 days posting)", weight: -6 },
];

export const ALL_FLAGS: IcpFlag[] = [...ICP_GREEN_FLAGS, ...ICP_RED_FLAGS];

export function computeFlagScoreDelta(flags: Record<string, boolean> | undefined): number {
  if (!flags) return 0;
  return ALL_FLAGS.reduce((sum, f) => (flags[f.id] ? sum + f.weight : sum), 0);
}

export function countFlags(flags: Record<string, boolean> | undefined) {
  if (!flags) return { green: 0, red: 0 };
  let green = 0;
  let red = 0;
  for (const f of ICP_GREEN_FLAGS) if (flags[f.id]) green++;
  for (const f of ICP_RED_FLAGS) if (flags[f.id]) red++;
  return { green, red };
}
