import { UserRole } from "../enums/roles.js";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreate {
  email: string;
  name: string;
  role: UserRole;
}

export interface UserPublic {
  id: number;
  name: string;
  role: UserRole;
}

export interface UserScope {
  id: number;
  userId: number;
  entityType: string;
  entityId: number;
}
