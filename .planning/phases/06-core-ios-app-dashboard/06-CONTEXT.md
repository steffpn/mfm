# Phase 6: Core iOS App & Dashboard - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

iOS app with complete auth flow, dashboard with aggregated analytics, detection browsing with search/filtering, and inline audio snippet playback. Covers requirements DASH-01 through DASH-05 (dashboard and analytics), DETC-04 (historical date range queries), PLAY-01 and PLAY-02 (inline snippet playback). The backend API endpoints for auth, airplay events, and snippet URLs already exist from Phases 3-5. This phase builds the iOS client that consumes them.

</domain>

<decisions>
## Implementation Decisions

### Auth flow & onboarding
- Multi-step onboarding flow: welcome splash → enter invite code → create account (email + password + name) → login confirmation → land on dashboard
- Silent token refresh — app automatically refreshes the JWT access token in the background when it expires (1h); user never sees token expiry
- Tokens stored securely in iOS Keychain (access token + refresh token)
- After login, user lands on the Dashboard tab
- If refresh token is invalid/expired (30d), redirect to login screen silently

### App navigation
- Standard iOS tab bar at the bottom with tabs: Dashboard, Detections, Search, Settings
- Tab bar visible on all main screens
- Settings tab for logout, account info, and future notification preferences (Phase 9)

### Dashboard layout
- Vertically scrollable view with sections: summary cards at top, then play count chart, then top stations list
- Summary cards: bold numbers for total plays today, this week, this month
- Play count trend shown as a line/bar chart over the selected time period
- Segmented control at the top to switch time period: Day | Week | Month — charts and cards update in place
- Top stations shown as a ranked list (top 5-10) with horizontal bars showing relative play count, station name, and count number
- Data sourced from TimescaleDB continuous aggregates (already set up in Phase 1)

### Detection browsing & search
- Compact row layout: each detection shows song title, artist, station name, timestamp, and small play button in a single row
- Persistent search bar at top of the Detections/Search tab — type to search by song title, artist name, or ISRC
- Filter chips below search bar for date range and station selection
- Filters apply immediately as changed
- Infinite scroll — automatically loads more detections as user scrolls near the bottom
- Pull-to-refresh supported — pull down to fetch latest detections

### Snippet playback
- Inline expand-in-row player: tapping play on a detection row expands that row to show a progress bar and play/pause button
- Simple thin horizontal progress bar showing playback position (no waveform)
- One snippet plays at a time — tapping play on a different detection stops the current one immediately, collapses the previous row, and starts the new one
- When a detection has no snippet (snippetUrl is null), the play button is shown but grayed out/disabled
- Audio fetched via GET /airplay-events/:id/snippet presigned URL (24h expiry, from Phase 4)

### Claude's Discretion
- Chart library choice (Swift Charts or third-party)
- Exact color scheme and typography
- Loading skeleton/shimmer design
- Error state handling and retry UX
- Empty state illustrations and copy
- Keychain wrapper implementation details
- API response pagination format (cursor vs offset)
- ViewModel structure within MVVM pattern
- Network reachability handling

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **APIClient** (apps/ios/Services/APIClient.swift): Actor-based URLSession client with async/await, JSON decoding with snake_case conversion, ISO8601 dates. Has auth token placeholder (commented out).
- **APIEndpoint** (apps/ios/Services/APIEndpoint.swift): Stub enum with only .health case. Needs detection, auth, dashboard, and snippet endpoints added.
- **Detection model** (apps/ios/Models/Detection.swift): Detection and AirplayEvent structs already defined with all fields including snippetUrl.
- **User model** (apps/ios/Models/User.swift): User struct with UserRole enum (ADMIN, ARTIST, LABEL, STATION).
- **Station model** (apps/ios/Models/Station.swift): Station struct with StationType and StreamStatus enums.
- **AudioSnippet model** (apps/ios/Models/AudioSnippet.swift): AudioSnippet struct with presignedUrl field.
- **ContentView** (apps/ios/App/ContentView.swift): Placeholder view — to be replaced with auth-gated navigation.

### Established Patterns
- MVVM architecture with SwiftUI (decided Phase 1)
- iOS 17 minimum — @Observable macro, modern SwiftUI APIs available
- URLSession async/await (no Alamofire)
- Actor isolation for API client (thread safety)
- Swift enum raw values use UPPER_CASE matching backend enum values

### Integration Points
- **Auth endpoints**: POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout (from Phase 5)
- **Airplay events**: GET /airplay-events (with query params for filtering/pagination) — scope-filtered by JWT role
- **Snippet URL**: GET /airplay-events/:id/snippet — returns presigned URL with 24h expiry
- **Stations**: GET /stations — for filter picker population
- **Dashboard aggregates**: Need new API endpoints for aggregated play counts (continuous aggregates exist in DB, no REST endpoint yet)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-core-ios-app-dashboard*
*Context gathered: 2026-03-16*
