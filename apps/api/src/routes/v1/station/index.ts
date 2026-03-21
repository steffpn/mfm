import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireRole } from "../../../middleware/authorize.js";
import {
  PeriodQuerySchema,
  TopSongsQuerySchema,
  StationIdQuerySchema,
  CompetitorIdParamsSchema,
} from "./schema.js";
import {
  getStationOverview,
  getStationTopSongs,
  getNewSongs,
  getExclusiveSongs,
  getPlaylistOverlap,
  getGenreDistribution,
  getRotationAnalysis,
  getDiscoveryScore,
} from "./handlers.js";

const stationRoutes: FastifyPluginAsync = async (fastify) => {
  // Plugin-level hooks: authenticate + require STATION or ADMIN role
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("STATION", "ADMIN"));

  // GET /station/overview - Aggregated stats for own station(s)
  fastify.get(
    "/overview",
    {
      schema: {
        querystring: PeriodQuerySchema,
      },
    },
    getStationOverview,
  );

  // GET /station/top-songs - Ranked songs by play count
  fastify.get(
    "/top-songs",
    {
      schema: {
        querystring: TopSongsQuerySchema,
      },
    },
    getStationTopSongs,
  );

  // GET /station/new-songs - Songs first appearing within period
  fastify.get(
    "/new-songs",
    {
      schema: {
        querystring: StationIdQuerySchema,
      },
    },
    getNewSongs,
  );

  // GET /station/exclusive-songs - Songs unique to a station
  fastify.get(
    "/exclusive-songs",
    {
      schema: {
        querystring: StationIdQuerySchema,
      },
    },
    getExclusiveSongs,
  );

  // GET /station/overlap/:competitorId - Playlist overlap analysis
  fastify.get(
    "/overlap/:competitorId",
    {
      schema: {
        params: CompetitorIdParamsSchema,
        querystring: PeriodQuerySchema,
      },
    },
    getPlaylistOverlap,
  );

  // GET /station/genre-distribution - Label/genre distribution
  fastify.get(
    "/genre-distribution",
    {
      schema: {
        querystring: PeriodQuerySchema,
      },
    },
    getGenreDistribution,
  );

  // GET /station/rotation - Rotation analysis with over-rotation detection
  fastify.get(
    "/rotation",
    {
      schema: {
        querystring: PeriodQuerySchema,
      },
    },
    getRotationAnalysis,
  );

  // GET /station/discovery-score - New song discovery percentage
  fastify.get(
    "/discovery-score",
    {
      schema: {
        querystring: PeriodQuerySchema,
      },
    },
    getDiscoveryScore,
  );
};

export default stationRoutes;
