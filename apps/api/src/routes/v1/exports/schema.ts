import { Type, type Static } from "@sinclair/typebox";

// --- CSV Export Query Schema ---

export const ExportCSVQuerySchema = Type.Object({
  q: Type.Optional(Type.String()),
  startDate: Type.Optional(Type.String({ format: "date" })),
  endDate: Type.Optional(Type.String({ format: "date" })),
  stationId: Type.Optional(Type.Number()),
});

export type ExportCSVQuery = Static<typeof ExportCSVQuerySchema>;

// --- PDF Export Query Schema ---

export const ExportPDFQuerySchema = Type.Object({
  q: Type.Optional(Type.String()),
  startDate: Type.String({ format: "date" }),
  endDate: Type.String({ format: "date" }),
  stationId: Type.Optional(Type.Number()),
});

export type ExportPDFQuery = Static<typeof ExportPDFQuerySchema>;
