import { UserRole } from "../enums/roles.js";
import { InvitationStatus } from "../enums/roles.js";

export interface Invitation {
  id: number;
  code: string;
  role: UserRole;
  scopeId: number | null;
  status: InvitationStatus;
  createdBy: number;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface InvitationCreate {
  role: UserRole;
  scopeId?: number;
  maxUses?: number;
  expiresAt?: Date;
}
