import type { FastifyPluginAsync } from "fastify";
import {
  UpdatePreferencesBodySchema,
  RegisterDeviceTokenBodySchema,
  DeleteDeviceTokenBodySchema,
  NotificationPreferencesResponseSchema,
} from "./schema.js";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  registerDeviceToken,
  deleteDeviceToken,
} from "./handlers.js";
import { authenticate } from "../../../middleware/authenticate.js";

const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // All notification routes require authentication
  fastify.addHook("preHandler", authenticate);

  // GET /notifications/preferences
  fastify.get(
    "/preferences",
    {
      schema: {
        response: {
          200: NotificationPreferencesResponseSchema,
        },
      },
    },
    getNotificationPreferences,
  );

  // PUT /notifications/preferences
  fastify.put(
    "/preferences",
    {
      schema: {
        body: UpdatePreferencesBodySchema,
        response: {
          200: NotificationPreferencesResponseSchema,
        },
      },
    },
    updateNotificationPreferences,
  );

  // POST /notifications/device-token
  fastify.post(
    "/device-token",
    {
      schema: {
        body: RegisterDeviceTokenBodySchema,
      },
    },
    registerDeviceToken,
  );

  // DELETE /notifications/device-token
  fastify.delete(
    "/device-token",
    {
      schema: {
        body: DeleteDeviceTokenBodySchema,
      },
    },
    deleteDeviceToken,
  );
};

export default notificationRoutes;
