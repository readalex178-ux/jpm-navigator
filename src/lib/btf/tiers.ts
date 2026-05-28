// Single source of truth for tier metadata — price, setter cut, what's included.
// Used by TierBadge tooltips throughout the app.
import type { Tier } from "./types";

export type TierMeta = {
  id: Tier;
  label: string;
  price: string;
  setterCutMin: number;
  setterCutMax: number;
  setterCutLabel: string;
  included: string;
};

export const TIER_META: Record<Tier, TierMeta> = {
  DIY: {
    id: "DIY",
    label: "DIY",
    price: "$997",
    setterCutMin: 50,
    setterCutMax: 100,
    setterCutLabel: "$50 – $100",
    included: "Self-serve course + templates. Buyer runs everything.",
  },
  DWY: {
    id: "DWY",
    label: "DWY",
    price: "$2,997",
    setterCutMin: 150,
    setterCutMax: 300,
    setterCutLabel: "$150 – $300",
    included: "Done-with-you build + group calls + Slack support.",
  },
  DFY: {
    id: "DFY",
    label: "DFY",
    price: "$11,997",
    setterCutMin: 600,
    setterCutMax: 1200,
    setterCutLabel: "$600 – $1,200",
    included: "Full done-for-you setter team running the entire pipeline.",
  },
};

export const TIERS_ORDERED: Tier[] = ["DIY", "DWY", "DFY"];
