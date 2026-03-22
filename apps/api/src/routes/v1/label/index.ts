import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../../middleware/authenticate.js";
import { requireRole } from "../../../middleware/authorize.js";
import {
  AddArtistBodySchema,
  ArtistIdParamsSchema,
  ToggleSongBodySchema,
  ComparisonQuerySchema,
  SongIdParamsSchema,
  BrowseArtistsQuerySchema,
} from "./schema.js";
import {
  getLabelArtists,
  addLabelArtist,
  removeLabelArtist,
  getLabelArtistSongs,
  toggleLabelSongMonitoring,
  getLabelDashboard,
  getArtistComparison,
  getStationAffinity,
  getReleaseTracker,
  browseArtists,
  browseArtistTracks,
} from "./handlers.js";

const labelRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require LABEL or ADMIN role
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireRole("LABEL", "ADMIN"));

  // GET /artists - List all label artists
  fastify.get("/artists", getLabelArtists);

  // POST /artists - Add an artist to the label
  fastify.post(
    "/artists",
    {
      schema: {
        body: AddArtistBodySchema,
      },
    },
    addLabelArtist,
  );

  // DELETE /artists/:id - Remove an artist from the label
  fastify.delete(
    "/artists/:id",
    {
      schema: {
        params: ArtistIdParamsSchema,
      },
    },
    removeLabelArtist,
  );

  // GET /artists/:id/songs - List songs for a label artist
  fastify.get(
    "/artists/:id/songs",
    {
      schema: {
        params: ArtistIdParamsSchema,
      },
    },
    getLabelArtistSongs,
  );

  // POST /artists/:id/songs - Toggle song monitoring
  fastify.post(
    "/artists/:id/songs",
    {
      schema: {
        params: ArtistIdParamsSchema,
        body: ToggleSongBodySchema,
      },
    },
    toggleLabelSongMonitoring,
  );

  // GET /dashboard - Label dashboard overview
  fastify.get("/dashboard", getLabelDashboard);

  // GET /comparison - Compare artists
  fastify.get(
    "/comparison",
    {
      schema: {
        querystring: ComparisonQuerySchema,
      },
    },
    getArtistComparison,
  );

  // GET /station-affinity - Station affinity report
  fastify.get("/station-affinity", getStationAffinity);

  // GET /releases/:id/tracker - Release performance tracker
  fastify.get(
    "/releases/:id/tracker",
    {
      schema: {
        params: SongIdParamsSchema,
      },
    },
    getReleaseTracker,
  );

  // GET /browse-artists - Search artists via Deezer
  fastify.get(
    "/browse-artists",
    { schema: { querystring: BrowseArtistsQuerySchema } },
    browseArtists,
  );

  // GET /browse-artists/:deezerId/tracks - Get artist tracks from Deezer
  fastify.get("/browse-artists/:deezerId/tracks", browseArtistTracks);
};

export default labelRoutes;
