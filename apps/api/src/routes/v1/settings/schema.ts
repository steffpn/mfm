import { Type, type Static } from "@sinclair/typebox";

export const UpdateSettingsSchema = Type.Object({
  dailyReportTime: Type.Optional(Type.String({ pattern: "^\\d{2}:\\d{2}$" })),
  dailyReportTimezone: Type.Optional(Type.String()),
  dailyReportEnabled: Type.Optional(Type.Boolean()),
  chartAlertsEnabled: Type.Optional(Type.Boolean()),
  chartAlertCountries: Type.Optional(Type.Array(Type.String({ minLength: 2, maxLength: 2 }))),
});
export type UpdateSettingsBody = Static<typeof UpdateSettingsSchema>;
