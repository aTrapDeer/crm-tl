export const PREDEFINED_CATEGORIES = [
  "Demo",
  "Carpentry",
  "Electrical",
  "Plumbing",
  "Drywall/Mud/Taping",
  "Coatings",
  "Custom",
] as const;

export type EstimateCategory = (typeof PREDEFINED_CATEGORIES)[number];
