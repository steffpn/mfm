import type { FastifyReply, FastifyRequest } from "fastify";
import type { AcrcloudSearchQuery } from "./schema.js";

const ACRCLOUD_API_BASE = "https://eu-api-v2.acrcloud.com";

/**
 * GET /admin/acrcloud-search - Search ACRCloud music database.
 *
 * Requires ACRCLOUD_API_TOKEN environment variable (bearer token from ACRCloud console).
 */
export async function searchAcrcloud(
  request: FastifyRequest<{ Querystring: AcrcloudSearchQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { q, type: searchType = "track" } = request.query;

  const apiToken = process.env.ACRCLOUD_API_TOKEN;
  if (!apiToken) {
    return reply
      .status(503)
      .send({ error: "ACRCloud API token not configured" });
  }

  try {
    const params = new URLSearchParams({
      query: q,
      type: searchType,
      format: "json",
    });

    const response = await fetch(
      `${ACRCLOUD_API_BASE}/api/external-metadata/tracks?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      request.log.error(
        { status: response.status, body: text },
        "ACRCloud API error",
      );
      return reply
        .status(response.status)
        .send({ error: "ACRCloud API error", details: text });
    }

    const data = await response.json();
    return reply.send(data);
  } catch (err) {
    request.log.error({ err }, "ACRCloud search failed");
    return reply.status(500).send({ error: "ACRCloud search failed" });
  }
}
