import { Type, type Static } from "@sinclair/typebox";

// --- Request Body Schemas ---

export const RegisterSchema = Type.Object({
  code: Type.String({ minLength: 14, maxLength: 14 }),
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 8 }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
});

export type RegisterBody = Static<typeof RegisterSchema>;

export const LoginSchema = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 1 }),
});

export type LoginBody = Static<typeof LoginSchema>;

export const RefreshSchema = Type.Object({
  refreshToken: Type.String({ minLength: 1 }),
});

export type RefreshBody = Static<typeof RefreshSchema>;

export const LogoutSchema = Type.Object({
  refreshToken: Type.String({ minLength: 1 }),
});

export type LogoutBody = Static<typeof LogoutSchema>;
