import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../middleware/authenticate.js";
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  LogoutSchema,
} from "./schema.js";
import { register, login, refresh, logout } from "./handlers.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /register - Public (no auth)
  fastify.post(
    "/register",
    {
      schema: { body: RegisterSchema },
    },
    register
  );

  // POST /login - Public (no auth)
  fastify.post(
    "/login",
    {
      schema: { body: LoginSchema },
    },
    login
  );

  // POST /refresh - Public (no auth)
  fastify.post(
    "/refresh",
    {
      schema: { body: RefreshSchema },
    },
    refresh
  );

  // POST /logout - Requires authentication
  fastify.post(
    "/logout",
    {
      preHandler: [authenticate],
      schema: { body: LogoutSchema },
    },
    logout
  );
};

export default authRoutes;
