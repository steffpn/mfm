import type { FastifyReply, FastifyRequest } from "fastify";
import { queryFilteredEvents } from "./query.js";
import { buildCSVStream } from "./csv-builder.js";
import type { ExportCSVQuery, ExportPDFQuery } from "./schema.js";

const CSV_MAX_ROWS = 10_000;
const PDF_MAX_ROWS = 1_000;

/**
 * GET /exports/csv - Export filtered airplay events as CSV.
 *
 * Applies the same search, date range, station, and scope filters as
 * the airplay-events list endpoint. Caps at 10,000 rows.
 */
export async function exportCSV(
  request: FastifyRequest<{ Querystring: ExportCSVQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { q, startDate, endDate, stationId } = request.query;
  const { currentUser } = request;

  const { events, exceeded } = await queryFilteredEvents(
    { q, startDate, endDate, stationId },
    currentUser,
    { maxRows: CSV_MAX_ROWS },
  );

  if (exceeded) {
    return reply.status(400).send({
      error:
        "Too many results (>10,000). Please narrow your date range or filters.",
    });
  }

  const csvStream = buildCSVStream(events);

  return reply
    .header("Content-Type", "text/csv; charset=utf-8")
    .header(
      "Content-Disposition",
      'attachment; filename="airplay-export.csv"',
    )
    .send(csvStream);
}

/**
 * GET /exports/pdf - Export filtered airplay events as branded PDF report.
 *
 * Requires startDate and endDate. Caps at 1,000 rows.
 */
export async function exportPDF(
  request: FastifyRequest<{ Querystring: ExportPDFQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { q, startDate, endDate, stationId } = request.query;
  const { currentUser } = request;

  const { events, exceeded } = await queryFilteredEvents(
    { q, startDate, endDate, stationId },
    currentUser,
    { maxRows: PDF_MAX_ROWS },
  );

  if (exceeded) {
    return reply.status(400).send({
      error:
        "Too many results (>1,000). Please narrow your date range.",
    });
  }

  // Lazy import: pdfkit module is heavy (~68s load in dev).
  // Deferring to request time avoids blocking server startup.
  const { buildPDFBuffer } = await import("./pdf-builder.js");

  const pdfBuffer = await buildPDFBuffer(
    events,
    { startDate, endDate },
    currentUser.email,
  );

  return reply
    .header("Content-Type", "application/pdf")
    .header(
      "Content-Disposition",
      `attachment; filename="airplay-report-${startDate}-to-${endDate}.pdf"`,
    )
    .send(pdfBuffer);
}
