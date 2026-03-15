import { Type, type Static } from "@sinclair/typebox";

// --- Request Body Schemas ---

export const CreateInvitationSchema = Type.Object({
  role: Type.Union([
    Type.Literal("ADMIN"),
    Type.Literal("ARTIST"),
    Type.Literal("LABEL"),
    Type.Literal("STATION"),
  ]),
  scopeId: Type.Optional(Type.Number()),
  maxUses: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
});

export type CreateInvitationBody = Static<typeof CreateInvitationSchema>;

export const InvitationParamsSchema = Type.Object({
  id: Type.Number(),
});

export type InvitationParams = Static<typeof InvitationParamsSchema>;
