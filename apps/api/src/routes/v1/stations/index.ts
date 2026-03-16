import type { FastifyPluginAsync } from "fastify";
import {
  StationCreateSchema,
  StationBulkCreateSchema,
  StationUpdateSchema,
  StationParamsSchema,
} from "./schema.js";
import {
  createStation,
  createStationsBulk,
  listStations,
  getStation,
  updateStation,
  deleteStation,
} from "./handlers.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireRole } from "../../../middleware/authorize.js";

const stationRoutes: FastifyPluginAsync = async (fastify) => {
  // All station routes require authentication
  fastify.addHook("preHandler", authenticate);

  // GET / - List all stations (any authenticated user)
  fastify.get("/", listStations);

  // GET /:id - Get single station (any authenticated user)
  fastify.get(
    "/:id",
    {
      schema: {
        params: StationParamsSchema,
      },
    },
    getStation,
  );

  // Write operations require ADMIN role
  // POST / - Create a single station
  fastify.post(
    "/",
    {
      preHandler: requireRole("ADMIN"),
      schema: {
        body: StationCreateSchema,
      },
    },
    createStation,
  );

  // POST /bulk - Bulk create stations
  fastify.post(
    "/bulk",
    {
      preHandler: requireRole("ADMIN"),
      schema: {
        body: StationBulkCreateSchema,
      },
    },
    createStationsBulk,
  );

  // PATCH /:id - Update station
  fastify.patch(
    "/:id",
    {
      preHandler: requireRole("ADMIN"),
      schema: {
        params: StationParamsSchema,
        body: StationUpdateSchema,
      },
    },
    updateStation,
  );

  // DELETE /:id - Soft delete station
  fastify.delete(
    "/:id",
    {
      preHandler: requireRole("ADMIN"),
      schema: {
        params: StationParamsSchema,
      },
    },
    deleteStation,
  );
};

export default stationRoutes;
