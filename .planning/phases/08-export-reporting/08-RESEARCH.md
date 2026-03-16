# Phase 8: Export & Reporting - Research

**Researched:** 2026-03-16
**Domain:** Server-side CSV/PDF generation, iOS file sharing
**Confidence:** HIGH

## Summary

Phase 8 adds two export capabilities: CSV export of filtered detection data (EXPT-01) and branded PDF airplay reports for date ranges (EXPT-02). Both require new backend API endpoints that generate files server-side, plus iOS UI to trigger exports and present the share sheet.

The architecture is straightforward: backend endpoints accept the same filter parameters as the existing `GET /airplay-events` list endpoint (already built in Phase 6), query the data with role-based scope filtering (already implemented), and return file content with appropriate Content-Type/Content-Disposition headers. The iOS app downloads the file data and presents it via SwiftUI's `ShareLink` (available since iOS 16, project targets iOS 17).

**Primary recommendation:** Use `csv-stringify` (streaming Transform API) for CSV generation and `pdfmake` (declarative JSON layout with built-in tables) for PDF reports. Server-side generation ensures role-based access is enforced at the data layer. iOS uses `ShareLink` with `Transferable` conformance for native share sheet integration.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPT-01 | User can export filtered detection data as CSV | Backend CSV endpoint reuses existing airplay-events query logic with scope filtering; csv-stringify streams rows; Fastify reply.send(stream) with text/csv Content-Type; iOS downloads via APIClient and shares via ShareLink |
| EXPT-02 | User can generate branded PDF airplay report for a date range | Backend PDF endpoint uses pdfmake declarative document definition with tables, header/footer branding; returns application/pdf; iOS downloads Data and shares via ShareLink with FileRepresentation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| csv-stringify | ^6.6.0 | CSV generation from arrays/objects | Part of node-csv ecosystem (1.2M+ weekly npm downloads), streaming Transform API, zero dependencies, handles escaping/quoting edge cases automatically |
| pdfmake | ^0.3.6 | PDF document generation | Declarative JSON document definition, built-in table/list/column support, automatic pagination, custom fonts, 1M+ weekly npm downloads, works server-side in Node.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sinclair/typebox | (already installed) | Schema validation for export query params | Reuse existing pattern for route schemas |
| @types/pdfmake | ^0.3.0 | TypeScript types for pdfmake | Dev dependency for type safety |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| csv-stringify | Manual string concatenation | csv-stringify handles RFC 4180 edge cases (embedded commas, quotes, newlines) that manual approaches miss |
| pdfmake | PDFKit | PDFKit (0.17.2) is imperative/canvas-like API -- you must manually position every element. pdfmake's declarative approach with built-in tables is far better for data-driven reports |
| pdfmake | Puppeteer (HTML-to-PDF) | Puppeteer requires Chromium binary (~200MB), massive dependency, overkill for structured reports. Not viable for lightweight server deployment |
| Server-side generation | Client-side (iOS) generation | Server-side enforces role-based access at the data query layer, which is a hard requirement. Client already has the data in memory but not all pages (cursor pagination). Server can query the full filtered dataset without pagination limits |

**Installation:**
```bash
cd apps/api && pnpm add csv-stringify pdfmake && pnpm add -D @types/pdfmake
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/routes/v1/exports/
  index.ts          # Route registration with authenticate middleware
  schema.ts         # TypeBox schemas for CSV/PDF query params
  handlers.ts       # Export handler functions
  csv-builder.ts    # CSV streaming logic (csv-stringify wrapper)
  pdf-builder.ts    # pdfmake document definition builder

apps/ios/myFuckingMusic/
  Services/
    ExportService.swift      # Download CSV/PDF data from API
  ViewModels/
    ExportViewModel.swift    # Manages export state (loading, errors)
  Views/
    Detections/
      DetectionsView.swift   # Add export button to toolbar (modified)
    Export/
      ExportButton.swift     # Toolbar button + ShareLink integration
```

### Pattern 1: Streamed CSV via Fastify reply.send()
**What:** Generate CSV as a Node.js Readable stream, pipe through Fastify's reply.send()
**When to use:** CSV export -- data can be large, streaming avoids buffering entire file in memory
**Example:**
```typescript
// Source: Fastify docs + csv-stringify docs
import { stringify } from "csv-stringify";
import { Readable } from "node:stream";

async function exportCSV(request, reply) {
  const events = await queryFilteredEvents(request); // reuse existing query logic

  const columns = ["Song Title", "Artist", "Station", "ISRC", "Started At", "Ended At", "Play Count"];
  const stringifier = stringify({ header: true, columns });

  for (const event of events) {
    stringifier.write([
      event.songTitle,
      event.artistName,
      event.station.name,
      event.isrc ?? "",
      event.startedAt.toISOString(),
      event.endedAt.toISOString(),
      event.playCount,
    ]);
  }
  stringifier.end();

  return reply
    .header("Content-Type", "text/csv")
    .header("Content-Disposition", 'attachment; filename="airplay-export.csv"')
    .send(stringifier); // Fastify accepts Transform streams
}
```

### Pattern 2: PDF Generation via pdfmake Buffer
**What:** Build pdfmake document definition, generate PDF buffer, send as response
**When to use:** PDF report -- document is typically small enough to buffer in memory
**Example:**
```typescript
// Source: pdfmake docs
import PdfPrinter from "pdfmake";

const fonts = {
  Roboto: {
    normal: "node_modules/pdfmake/build/vfs_fonts.js", // or bundled font paths
  },
};

function buildReportDocument(events, dateRange, userName) {
  return {
    content: [
      { text: "myFuckingMusic", style: "brand" },
      { text: `Airplay Report`, style: "title" },
      { text: `${dateRange.start} - ${dateRange.end}`, style: "subtitle" },
      { text: `Generated for: ${userName}`, style: "meta" },
      {
        table: {
          headerRows: 1,
          widths: ["*", "*", "auto", "auto", "auto"],
          body: [
            ["Song", "Artist", "Station", "Date", "Plays"],
            ...events.map(e => [
              e.songTitle,
              e.artistName,
              e.station.name,
              new Date(e.startedAt).toLocaleDateString(),
              String(e.playCount),
            ]),
          ],
        },
      },
    ],
    styles: { /* brand styles */ },
  };
}
```

### Pattern 3: iOS ShareLink with Transferable
**What:** Use SwiftUI ShareLink to present the native share sheet with exported file data
**When to use:** iOS 16+ (project targets iOS 17) for sharing downloaded CSV/PDF files
**Example:**
```swift
// Source: Apple docs (ShareLink, Transferable)
struct ExportedFile: Transferable {
    let data: Data
    let filename: String
    let contentType: UTType

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .commaSeparatedText) { file in
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent(file.filename)
            try file.data.write(to: url)
            return SentTransferredFile(url)
        }
    }
}

// In DetectionsView toolbar:
ShareLink(item: exportedFile, preview: SharePreview("Airplay Export", image: Image(systemName: "doc")))
```

### Pattern 4: Reuse Existing Query Logic
**What:** Extract the airplay events query builder from the existing listEvents handler into a shared function
**When to use:** Both CSV and PDF exports need the same filtered, scoped query
**Example:**
```typescript
// Shared query builder extracted from existing handlers.ts
async function queryFilteredEvents(
  filters: { q?: string; startDate?: string; endDate?: string; stationId?: number },
  currentUser: CurrentUser,
  options?: { limit?: number }
) {
  const where = buildWhereClause(filters, currentUser);
  return prisma.airplayEvent.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: options?.limit,
    include: { station: { select: { name: true } } },
  });
}
```

### Anti-Patterns to Avoid
- **Client-side data assembly for export:** Don't try to collect all paginated data on the iOS client and build CSV/PDF locally. The user may have thousands of detections across many pages. Server-side generation with a single unbounded query (capped to a sensible max like 10,000 rows) is the correct approach.
- **Using reply.raw for file responses:** Fastify natively supports `reply.send(readableStream)` with proper header setting. Using `reply.raw` bypasses Fastify's response pipeline and error handling. Only use `reply.raw` for SSE-type scenarios (as Phase 7 did).
- **Generating PDF client-side from HTML:** Don't use WebView + JavaScript PDF generation on iOS. The server already has the data and can enforce access control.
- **Unbounded queries without limits:** Even though exports need "all" data, always cap with a maximum (e.g., 10,000 rows for CSV, 1,000 for PDF) to prevent server OOM on large datasets.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV formatting | Manual string join with commas | csv-stringify | RFC 4180 compliance: fields containing commas, quotes, or newlines must be properly escaped. csv-stringify handles all edge cases (song titles with commas, artist names with quotes) |
| PDF layout with tables | Manual coordinate-based drawing with PDFKit | pdfmake declarative tables | Table layout (column widths, row heights, page breaks, cell wrapping) is extremely complex. pdfmake handles automatic pagination, cell overflow, and consistent styling |
| iOS file sharing | Custom UIActivityViewController wrapper | SwiftUI ShareLink + Transferable | ShareLink is the native SwiftUI approach for iOS 16+. No UIViewControllerRepresentable wrapping needed |
| Query filtering for exports | Duplicate query logic from listEvents | Extract shared query builder | The listEvents handler already has tested, working filter + scope logic. Extract and reuse it |

**Key insight:** The export endpoints are thin wrappers around existing query logic. The hard part (filtering, scope-based access, pagination-free queries) is already solved. The new work is file format serialization and iOS download/share UX.

## Common Pitfalls

### Pitfall 1: CSV Injection (Formula Injection)
**What goes wrong:** Cell values starting with `=`, `+`, `-`, `@`, `\t`, `\r` can be interpreted as formulas by Excel/Google Sheets, leading to arbitrary code execution when users open the exported CSV.
**Why it happens:** Song titles and artist names are user-generated content (from ACRCloud detection data) and could contain these characters.
**How to avoid:** Prefix cells that start with dangerous characters with a single quote (`'`) or tab character. csv-stringify doesn't do this automatically. Add a sanitization step before writing each row.
**Warning signs:** User reports of "broken" CSV files or security scanner flags.

### Pitfall 2: Memory Exhaustion on Large Exports
**What goes wrong:** Loading all matching airplay events into memory at once for a broad date range can cause Node.js heap exhaustion.
**Why it happens:** A popular artist could have 50,000+ detections over a month across 200+ stations.
**How to avoid:** For CSV: use Prisma cursor-based iteration (findMany in batches of 1000, stream each batch through csv-stringify). For PDF: cap at a reasonable limit (1,000 rows) since PDFs with 50K rows are unusable anyway. Return 400 if the result set exceeds the limit with a message suggesting narrowing the date range.
**Warning signs:** Server crashes on export, 502 timeouts.

### Pitfall 3: Fastify Content-Type Negotiation with Streams
**What goes wrong:** Fastify sets Content-Type to `application/octet-stream` when sending a stream without explicit Content-Type header.
**Why it happens:** Fastify cannot infer the correct Content-Type from a generic Readable/Transform stream.
**How to avoid:** Always set `reply.header("Content-Type", "text/csv")` or `reply.header("Content-Type", "application/pdf")` BEFORE calling `reply.send(stream)`.
**Warning signs:** Browser downloads file with wrong extension, iOS can't determine file type.

### Pitfall 4: pdfmake Font Loading in Production
**What goes wrong:** pdfmake's `PdfPrinter` constructor requires explicit font file paths. In production, `node_modules` may not exist or paths differ.
**Why it happens:** pdfmake uses virtual file system (vfs) for fonts; the default build includes Roboto but needs explicit wiring in server-side Node.js usage.
**How to avoid:** Use `pdfmake/build/vfs_fonts` to load the built-in Roboto font definitions. Import them and pass to PdfPrinter constructor. Do not rely on file paths.
**Warning signs:** "Font not found" errors, blank/missing text in generated PDFs.

### Pitfall 5: iOS Download Fails Silently on Large Files
**What goes wrong:** Using the generic `APIClient.request<T>` method tries to JSON-decode the response, which fails for binary/text file responses.
**Why it happens:** The existing APIClient is designed for JSON API responses, not file downloads.
**How to avoid:** Use `APIClient.requestRaw()` (already exists) which returns raw `(Data, HTTPURLResponse)`. Check Content-Type header to confirm the expected format was received. Write Data to a temporary file for ShareLink.
**Warning signs:** Decoding errors on export, empty files.

### Pitfall 6: Date Range Required for PDF Reports
**What goes wrong:** PDF generation without a date range filter tries to include all historical data, creating massive/slow reports.
**Why it happens:** Unlike CSV (which can stream incrementally), PDF must be fully buffered before sending.
**How to avoid:** Make startDate and endDate required parameters for the PDF endpoint. Return 400 if missing. Enforce maximum range (e.g., 90 days).
**Warning signs:** Timeout errors on PDF generation, very large PDF files.

## Code Examples

Verified patterns from official sources:

### CSV Streaming with csv-stringify
```typescript
// Source: https://csv.js.org/stringify/
import { stringify } from "csv-stringify";

// The stringify function returns a Transform stream
const stringifier = stringify({
  header: true,
  columns: ["Song Title", "Artist", "Station", "ISRC", "Started At", "Ended At", "Play Count"],
});

// Write rows one at a time (can also pipe from a Readable)
stringifier.write(["My Song", "My Artist", "Radio ZU", "ROABC12345678", "2026-03-15T10:00:00Z", "2026-03-15T10:03:00Z", "3"]);
stringifier.end();

// stringifier is a Readable stream -- pipe to reply.send()
```

### pdfmake Server-Side Document Generation
```typescript
// Source: https://pdfmake.github.io/docs/0.1/getting-started/server-side/
import PdfPrinter from "pdfmake";

// Load built-in fonts (Roboto)
const fonts = {
  Roboto: {
    normal: Buffer.from(require("pdfmake/build/vfs_fonts").pdfMake.vfs["Roboto-Regular.ttf"], "base64"),
    bold: Buffer.from(require("pdfmake/build/vfs_fonts").pdfMake.vfs["Roboto-Medium.ttf"], "base64"),
    italics: Buffer.from(require("pdfmake/build/vfs_fonts").pdfMake.vfs["Roboto-Italic.ttf"], "base64"),
    bolditalics: Buffer.from(require("pdfmake/build/vfs_fonts").pdfMake.vfs["Roboto-MediumItalic.ttf"], "base64"),
  },
};

const printer = new PdfPrinter(fonts);

const docDefinition = {
  content: [
    { text: "Airplay Report", fontSize: 20, bold: true, margin: [0, 0, 0, 10] },
    {
      table: {
        headerRows: 1,
        widths: ["*", "*", "auto", "auto", "auto"],
        body: [
          ["Song", "Artist", "Station", "Date", "Plays"],
          // ... data rows
        ],
      },
      layout: "lightHorizontalLines",
    },
  ],
  defaultStyle: { font: "Roboto" },
};

const pdfDoc = printer.createPdfKitDocument(docDefinition);
// pdfDoc is a PDFKit document (Readable stream)
// Collect into buffer or pipe directly
```

### Fastify Stream Response with Headers
```typescript
// Source: https://fastify.dev/docs/latest/Reference/Reply/
reply
  .header("Content-Type", "text/csv; charset=utf-8")
  .header("Content-Disposition", 'attachment; filename="detections.csv"')
  .send(csvStream); // Fastify handles backpressure for Transform/Readable streams
```

### SwiftUI ShareLink with File Data
```swift
// Source: Apple Developer Documentation - ShareLink, Transferable protocol
import UniformTypeIdentifiers

struct ExportedFile: Transferable {
    let url: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .commaSeparatedText) { file in
            SentTransferredFile(file.url)
        }
        FileRepresentation(exportedContentType: .pdf) { file in
            SentTransferredFile(file.url)
        }
    }
}

// Usage in toolbar:
.toolbar {
    ToolbarItem(placement: .topBarTrailing) {
        if let exportedFile = viewModel.exportedFile {
            ShareLink(item: exportedFile, preview: SharePreview("Airplay Data"))
        }
    }
}
```

### iOS File Download via requestRaw
```swift
// Using existing APIClient.requestRaw() method
func downloadExport(endpoint: APIEndpoint) async throws -> URL {
    let (data, response) = try await APIClient.shared.requestRaw(endpoint)

    guard (200...299).contains(response.statusCode) else {
        throw APIError.httpError(statusCode: response.statusCode, data: data)
    }

    // Extract filename from Content-Disposition header
    let filename = extractFilename(from: response) ?? "export.csv"
    let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
    try data.write(to: tempURL)
    return tempURL
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UIActivityViewController wrapping | SwiftUI ShareLink | iOS 16 (2022) | Native SwiftUI, no UIViewControllerRepresentable needed |
| PDFKit manual positioning | pdfmake declarative layout | Stable since 2020 | Tables, auto-pagination handled declaratively |
| csv-generate + manual escaping | csv-stringify streaming API | csv-stringify v6 (2023) | Zero-dependency streaming Transform with header support |
| reply.raw pipe for files | reply.send(stream) | Fastify v4+ | Fastify natively handles backpressure and lifecycle |

**Deprecated/outdated:**
- UIDocumentInteractionController: Replaced by UIActivityViewController, then by ShareLink in SwiftUI
- csv npm package (monolith): Split into individual packages (csv-parse, csv-stringify, csv-generate). Use csv-stringify directly for generation-only needs

## Open Questions

1. **Branding assets for PDF report**
   - What we know: The report should be "branded" per EXPT-02. The app is called "myFuckingMusic".
   - What's unclear: No logo image or brand color hex values are specified in the project.
   - Recommendation: Use text-based branding (app name as header) with a simple color scheme. No logo image needed for v1. Can be refined later.

2. **Export row limits**
   - What we know: Exports should include the user's filtered data, which could be very large.
   - What's unclear: Exact maximum row count acceptable for performance.
   - Recommendation: CSV: 10,000 row cap. PDF: 1,000 row cap. Return error with "narrow your filters" message if exceeded. These can be tuned based on real-world usage.

3. **Export from which view?**
   - What we know: EXPT-01 says "current filtered detection view." DetectionsView has filters (search, date range, station).
   - What's unclear: Should export also be available from Dashboard or Search views?
   - Recommendation: Add export button only to DetectionsView toolbar initially, since it has the full filter UI. The export passes current filter state to the API.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | apps/api/vitest.config.ts |
| Quick run command | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` |
| Full suite command | `cd apps/api && pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPT-01 | CSV export returns valid CSV with correct headers and Content-Type | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | No - Wave 0 |
| EXPT-01 | CSV export respects role-based scope filtering | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | No - Wave 0 |
| EXPT-01 | CSV export applies search/date/station filters | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | No - Wave 0 |
| EXPT-01 | CSV export returns 401 without authentication | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | No - Wave 0 |
| EXPT-02 | PDF report returns valid PDF with correct Content-Type | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | No - Wave 0 |
| EXPT-02 | PDF report requires date range parameters | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | No - Wave 0 |
| EXPT-02 | PDF report respects role-based scope filtering | unit | `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/api && pnpm test -- --run tests/routes/exports.test.ts`
- **Per wave merge:** `cd apps/api && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/tests/routes/exports.test.ts` -- covers EXPT-01, EXPT-02 (route-level tests with mocked Prisma, following existing airplay-events-list.test.ts pattern)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/api/src/routes/v1/airplay-events/handlers.ts` -- existing query logic with scope filtering to reuse
- Existing codebase: `apps/api/src/middleware/authenticate.ts` -- role-based access control pattern
- Existing codebase: `apps/ios/myFuckingMusic/Services/APIClient.swift` -- requestRaw() method for binary downloads
- [csv-stringify npm](https://www.npmjs.com/package/csv-stringify) - v6.6.0, streaming Transform API
- [pdfmake npm](https://www.npmjs.com/package/pdfmake) - v0.3.6, declarative PDF generation
- [Fastify Reply docs](https://fastify.dev/docs/latest/Reference/Reply/) - stream response handling
- [Apple ShareLink docs](https://developer.apple.com/documentation/swiftui/sharelink) - iOS 16+ native sharing

### Secondary (MEDIUM confidence)
- [csv-stringify usage guide](https://csv.js.org/stringify/) - streaming and header configuration
- [pdfmake server-side docs](https://pdfmake.github.io/docs/0.1/getting-started/server-side/) - Node.js font loading
- [Hacking with Swift - ShareLink](https://www.hackingwithswift.com/books/ios-swiftui/how-to-let-the-user-share-content-with-sharelink) - Transferable protocol examples

### Tertiary (LOW confidence)
- None -- all findings verified with official docs or codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - csv-stringify and pdfmake are well-established, widely-used libraries with active maintenance and comprehensive docs
- Architecture: HIGH - follows existing project patterns (Fastify route plugin, TypeBox schemas, authenticate middleware, APIClient.requestRaw)
- Pitfalls: HIGH - based on real production experience with CSV injection, memory exhaustion, and Fastify stream handling documented in official issue trackers

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, libraries have slow release cadence)
