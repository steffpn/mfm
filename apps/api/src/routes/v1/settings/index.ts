import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../middleware/authenticate.js";
import { UpdateSettingsSchema } from "./schema.js";
import { getSettings, updateSettings } from "./handlers.js";

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", getSettings);
  fastify.patch("/", { schema: { body: UpdateSettingsSchema } }, updateSettings);
};

export default settingsRoutes;
