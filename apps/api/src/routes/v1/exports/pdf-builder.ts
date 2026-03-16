import PDFDocument from "pdfkit";

interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Build a branded PDF airplay report buffer from event data.
 *
 * Uses PDFKit directly for server-side PDF generation with built-in
 * Helvetica fonts (no external font files needed).
 *
 * Layout:
 * - Header: "myFuckingMusic" brand + "Airplay Report" title
 * - Subtitle: date range
 * - Meta: generated for user, generated timestamp
 * - Summary: total detections, unique songs, unique stations
 * - Table: Song, Artist, Station, ISRC, Date, Plays
 * - Footer: brand text centered on each page
 */
export async function buildPDFBuffer(
  events: Array<Record<string, unknown>>,
  dateRange: DateRange,
  userName: string,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
    info: {
      Title: `Airplay Report ${dateRange.startDate} to ${dateRange.endDate}`,
      Author: "myFuckingMusic",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // --- Header ---
  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("myFuckingMusic", { align: "left" });

  doc
    .fontSize(16)
    .font("Helvetica")
    .text("Airplay Report", { align: "left" });

  doc.moveDown(0.5);

  // --- Subtitle: date range ---
  doc
    .fontSize(12)
    .font("Helvetica")
    .text(`${dateRange.startDate}  -  ${dateRange.endDate}`, {
      align: "left",
    });

  doc.moveDown(0.3);

  // --- Meta ---
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#666666")
    .text(`Generated for: ${userName}`)
    .text(`Generated: ${new Date().toISOString().split("T")[0]}`);

  doc.moveDown(0.5);

  // --- Summary ---
  const uniqueSongs = new Set(
    events.map((e) => `${e.songTitle}|${e.artistName}`),
  ).size;
  const uniqueStations = new Set(
    events.map((e) => {
      const station = e.station as { name: string } | null;
      return station?.name ?? "Unknown";
    }),
  ).size;

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text(
      `${events.length} detections  |  ${uniqueSongs} unique songs  |  ${uniqueStations} unique stations`,
    );

  doc.moveDown(1);

  // --- Table ---
  const tableTop = doc.y;
  const colWidths = [130, 100, 80, 80, 70, 40];
  const headers = ["Song", "Artist", "Station", "ISRC", "Date", "Plays"];
  const pageWidth = 495; // A4 width minus margins

  // Table header
  drawTableRow(doc, tableTop, colWidths, headers, true);

  // Horizontal line under header
  doc
    .moveTo(50, tableTop + 18)
    .lineTo(50 + pageWidth, tableTop + 18)
    .strokeColor("#999999")
    .lineWidth(0.5)
    .stroke();

  let yPos = tableTop + 22;

  // Table rows
  for (const event of events) {
    // Check if we need a new page
    if (yPos > 750) {
      doc.addPage();
      yPos = 50;
      drawTableRow(doc, yPos, colWidths, headers, true);
      doc
        .moveTo(50, yPos + 18)
        .lineTo(50 + pageWidth, yPos + 18)
        .strokeColor("#999999")
        .lineWidth(0.5)
        .stroke();
      yPos += 22;
    }

    const station = event.station as { name: string } | null;
    const startedAt = event.startedAt as Date;

    const row = [
      truncate(String(event.songTitle ?? ""), 25),
      truncate(String(event.artistName ?? ""), 20),
      truncate(String(station?.name ?? ""), 15),
      String(event.isrc ?? ""),
      startedAt.toISOString().split("T")[0],
      String(event.playCount ?? 0),
    ];

    drawTableRow(doc, yPos, colWidths, row, false);

    // Light line between rows
    yPos += 16;
    doc
      .moveTo(50, yPos)
      .lineTo(50 + pageWidth, yPos)
      .strokeColor("#eeeeee")
      .lineWidth(0.25)
      .stroke();
    yPos += 4;
  }

  // --- Footer on all pages ---
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#999999")
      .text("myFuckingMusic - Airplay Monitoring", 50, 780, {
        align: "center",
        width: pageWidth,
      });
  }

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Draw a row of text cells at the given y position.
 */
function drawTableRow(
  doc: PDFKit.PDFDocument,
  y: number,
  colWidths: number[],
  cells: string[],
  isHeader: boolean,
): void {
  let x = 50;
  const fontSize = isHeader ? 9 : 8;
  const font = isHeader ? "Helvetica-Bold" : "Helvetica";

  doc.fontSize(fontSize).font(font).fillColor("#000000");

  for (let i = 0; i < cells.length; i++) {
    doc.text(cells[i], x, y, {
      width: colWidths[i],
      lineBreak: false,
    });
    x += colWidths[i];
  }
}

/**
 * Truncate a string to maxLen characters, appending "..." if needed.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
