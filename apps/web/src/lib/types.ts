export type Role = "ARTIST" | "LABEL" | "STATION";
export type Tier = "FREE" | "PREMIUM";

export interface Feature {
  id: number;
  key: string;
  name: string;
  description: string | null;
  category: string;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: number;
  role: Role;
  tier: Tier;
  name: string;
  featureIds: number[];
}

export interface PlanMatrix {
  features: Feature[];
  plans: Plan[];
}

export interface FeatureFormData {
  key: string;
  name: string;
  description: string;
  category: string;
  roles: Role[];
}
