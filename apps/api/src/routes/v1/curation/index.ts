import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireRole } from "../../../middleware/authorize.js";
import {
  StationParamSchema,
  VoteBodySchema,
  SongParamSchema,
  AddCurationSongSchema,
  ScoresQuerySchema,
} from "./schema.js";
import {
  listCurationStations,
  getNextSong,
  submitVote,
  getScores,
  addCurationSong,
  removeCurationSong,
  listCurationSongs,
  syncFromRotation,
} from "./handlers.js";

const curationRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Public endpoints (no auth) ────────────────────────────────

  // List stations with curation enabled
  fastify.get("/stations", listCurationStations);

  // Get next song for voting
  fastify.get(
    "/stations/:stationId/next",
    { schema: { params: StationParamSchema } },
    getNextSong,
  );

  // Submit a vote
  fastify.post(
    "/vote",
    { schema: { body: VoteBodySchema } },
    submitVote,
  );

  // Get scores/leaderboard
  fastify.get(
    "/scores",
    { schema: { querystring: ScoresQuerySchema } },
    getScores,
  );

  // ─── Station-managed endpoints (require auth) ──────────────────

  // List curation songs for a station
  fastify.get(
    "/stations/:stationId/songs",
    {
      schema: { params: StationParamSchema },
      preHandler: [authenticate, requireRole("STATION", "ADMIN")],
    },
    listCurationSongs,
  );

  // Add a song to curation
  fastify.post(
    "/stations/:stationId/songs",
    {
      schema: { params: StationParamSchema, body: AddCurationSongSchema },
      preHandler: [authenticate, requireRole("STATION", "ADMIN")],
    },
    addCurationSong,
  );

  // Remove a curation song
  fastify.delete(
    "/songs/:id",
    {
      schema: { params: SongParamSchema },
      preHandler: [authenticate, requireRole("STATION", "ADMIN")],
    },
    removeCurationSong,
  );

  // Sync from airplay rotation
  fastify.post(
    "/stations/:stationId/sync-rotation",
    {
      schema: { params: StationParamSchema },
      preHandler: [authenticate, requireRole("STATION", "ADMIN")],
    },
    syncFromRotation,
  );
};

export default curationRoutes;
