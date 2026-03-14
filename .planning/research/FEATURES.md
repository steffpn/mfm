# Feature Research

**Domain:** Music Broadcast Monitoring Platform (Radio/TV Airplay Tracking)
**Researched:** 2026-03-14
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete. Every serious competitor (BMAT, Soundcharts, WARM, Radiostats, Mediabase, ACRCloud dashboard) has these.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **24/7 automated detection** | The entire value prop. If monitoring gaps exist, data is worthless. Every competitor monitors continuously. | HIGH | ACRCloud handles the detection engine. Backend must reliably feed streams to ACRCloud and process results without downtime. This is infrastructure, not a feature toggle. |
| **Per-detection data: station, timestamp, song, artist, duration** | Minimum useful detection record. BMAT, Soundcharts, Mediabase all provide this. Without it, detection is meaningless. | LOW | ACRCloud returns most of this. Store ISRC, exact timestamp, duration, confidence score, station ID. Map to your internal song/artist models. |
| **Aggregated stats dashboard (daily/weekly/monthly)** | Every competitor has this. Artists and labels think in "how many spins this week" not individual detections. WARM, Soundcharts, SongBoost all aggregate. | MEDIUM | Roll-ups by day/week/month. Total plays, plays per station, top stations. Pre-compute for performance. This is the primary view users will interact with. |
| **Station-level breakdown** | Users need to see WHICH stations play their music and how often. Soundcharts, WARM, Mediabase all break down by station. Without this, aggregate numbers lack actionable insight. | MEDIUM | Group detections by station. Show station name, total plays, trend over time. Station metadata (type: radio/TV, city, format) enriches this. |
| **Historical data access** | Users expect to query past data, not just see today. ACRCloud sells years of broadcast history. BMAT provides historical dashboards. Competitors retain indefinitely. | MEDIUM | Retention policy matters. Store everything. Let users filter by date range. Index timestamps properly for fast queries across millions of detections. |
| **Song/artist search and filtering** | Label users managing 50+ artists need to find specific songs quickly. Soundcharts has search across 16M artists. Basic usability requirement. | LOW | Full-text search on song title, artist name, ISRC. Filter by date range, station, station type. Standard database query work. |
| **Data export (CSV)** | Industry standard for sharing data with management, CMOs (UCMR-ADA, CREDIDAM), or internal analysis. WARM, Syndicast, Soundcharts all offer CSV/Excel export. | LOW | Export filtered views as CSV. Include all detection fields. Keep formatting clean for spreadsheet consumption. |
| **Role-based access control** | Different users need different data scopes. Spotify for Artists, Apple Music for Artists, Traxsource all implement RBAC. Admin, Artist, Label are minimum viable roles. | MEDIUM | Artist sees own catalog. Label sees all artists under them. Station sees own station data + competitor intelligence. Admin sees everything + user management. |
| **User management (admin)** | Admins need to add/remove users, assign roles, manage invitations. Every B2B SaaS has this. Without it, onboarding is manual and unscalable. | MEDIUM | Invite-only for v1 simplifies this (no self-registration flow). Admin creates invitation, user receives code/link, creates account with assigned role and scope. |
| **Station management (admin)** | Admins need to add/remove/edit monitored stations and their stream URLs. ACRCloud supports custom streams. Admin must map streams to station metadata. | LOW | CRUD for stations: name, stream URL, type (radio/TV), city, format/genre. Link to ACRCloud channel IDs. |

### Differentiators (Competitive Advantage)

Features that set myFuckingMusic apart from existing solutions. Not every competitor has these, and they align with the project's core value proposition: **audio proof**.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **5-second playable audio snippets at moment of detection** | **This is the killer feature.** No major competitor provides in-app audio playback of the actual broadcast moment. BMAT Vericast provides "audio and video evidence synched with EPG data" but only for enterprise clients paying significant fees. ACRCloud's Timemap has recordings but they are raw API access, not a consumer-friendly experience. For Romanian artists who have never had access to this kind of proof, hearing their song on Kiss FM at 14:32 on Tuesday is emotionally powerful and practically useful for royalty disputes with UCMR-ADA/CREDIDAM. | HIGH | Must record streams locally (not from ACRCloud), cut 5-second snippets at detection time, store efficiently (significant storage at 200+ streams), serve via streaming API. Storage costs and audio processing pipeline are the main engineering challenges. Legal: 5-second snippets likely qualify as fair use/incidental use, but worth validating for Romanian copyright law. |
| **Live detection feed (real-time)** | WARM and SongBoost offer instant notifications. But a live scrolling feed of detections as they happen across all stations is compelling for label users and station users. Watching your catalog light up across Romania in real-time creates engagement and "stickiness." Soundcharts has real-time tracking but behind expensive subscriptions ($140+/mo for Chartmetric tier). | MEDIUM | WebSocket or SSE connection from backend to app. Push new detections as they arrive from ACRCloud processing pipeline. Design for high throughput -- 200+ stations could generate hundreds of detections per hour during peak times. |
| **Competitor station intelligence** | Unique role: stations can see what OTHER stations are playing. Mediabase offers this for US radio programmers. Chartmetric provides station-level analytics. But no platform focuses this on the Romanian market. Station programmers want to know: "What is Kiss FM playing that we aren't?" This creates a distinct user persona and revenue stream. | MEDIUM | Same detection data, different view. Show top songs on competitor stations, new adds, rotation patterns. Requires enough station coverage to be useful (the 200+ stations target helps here). |
| **Digest notifications (daily/weekly summaries)** | WARM and SongBoost do per-detection push notifications, which creates notification fatigue for popular artists. A curated daily/weekly digest with key stats ("Your music was played 47 times across 12 stations this week, up 15%") is more valuable and less annoying. SongBoost and Radiostats do not offer digest mode. | MEDIUM | Scheduled job generates digest per user. Aggregate stats, highlight top stations, notable new stations, trend direction. Push notification with summary, deep-link into app for details. |
| **PDF report generation** | Beyond CSV exports, branded PDF reports that artists/labels can share with management, investors, or post on social media. Syndicast offers customizable PDF reports. BMAT provides formatted reports for enterprise. For independent Romanian artists, a shareable "proof of airplay" PDF is valuable for credibility. | MEDIUM | Template-based PDF generation. Include logo, date range, aggregate stats, top stations, detection timeline chart. Server-side rendering. |
| **Romanian market specialization** | Media Forest is the only current Romania-specific monitoring service, and it only covers ~13 stations for its public chart. myFuckingMusic covers 200+ stations. No international platform (WARM, Soundcharts, Radiostats) has deep Romanian coverage. Being the definitive source for Romanian airplay data is a strong moat. | LOW (by design) | Not a feature to build -- it's a positioning advantage that comes from the 200+ Romanian station coverage. Ensure station metadata includes Romanian-specific info (city, format, network affiliation). |
| **ISRC-based identification** | ACRCloud provides ISRC codes in detection results. Storing and exposing ISRC enables integration with CMO reporting (UCMR-ADA, CREDIDAM) and makes data interoperable with industry systems. Many artist-facing platforms don't expose ISRCs. | LOW | ACRCloud returns ISRCs. Store them. Display in detail views. Include in exports. Enables future CMO integration. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Per-detection push notifications** | Artists want to know the instant their song plays. WARM and SongBoost do this. | Notification fatigue kills engagement. An artist played 50 times/day gets 50 notifications. Users mute the app. SongBoost reviews confirm this complaint. Also, push notification infrastructure for high-volume events is expensive and error-prone. | Digest notifications (daily/weekly) with key stats. Live feed in-app for users who want real-time. The feed is opt-in attention; push notifications are interruptive. |
| **Automatic stream discovery/scraping** | "Why can't the system find stations automatically?" Seems like it would scale faster. | Romanian radio streams are not reliably discoverable. URLs change, geo-restrictions exist, some are behind CDN auth. Automatic discovery creates ghost stations, duplicate entries, and broken streams that pollute data. Maintenance burden exceeds manual curation. | Admin manually adds and validates stream URLs. Quality over quantity. Each stream is verified working before monitoring begins. |
| **Self-registration / public signup** | Standard SaaS pattern. More users = more growth. | Product is B2B for a niche market (Romanian music industry). Self-registration invites spam accounts, requires email verification flow, password reset, abuse prevention. The target user base is known and finite (artists, labels, stations in Romania). Invite-only creates exclusivity and controls quality. | Invite-only auth. Admin sends invitation codes. Users onboard through a controlled flow. Add self-registration later when product-market fit is established and the user base needs to scale beyond admin-managed invitations. |
| **Full song playback** | "Can I listen to the whole song as it was broadcast?" | Copyright violation. Even 30-second previews are legally risky for broadcast recordings. Storage costs explode. Liability for hosting copyrighted recordings. No legitimate monitoring platform offers full playback of broadcast recordings. | 5-second snippets. Short enough for fair use/evidence purposes, long enough to confirm the detection is accurate. This is the industry-accepted approach. |
| **Real-time charts / public rankings** | Media Forest publishes Romania's Airplay 100. Artists want to see charts. | Chart compilation requires editorial methodology, weighting by audience reach, format-specific rules. It's a media product, not a monitoring feature. Building charts creates expectation of "official" status and invites disputes about methodology. Also competes directly with Media Forest's core business. | Provide raw stats and let users draw conclusions. "Your song was played X times on Y stations" is factual. "Your song is #3 in Romania" is editorial. The data enables third parties to create charts if desired. |
| **Android app** | ~50% of Romanian smartphone users are on Android. | Splitting mobile development across two platforms in v1 doubles effort, doubles bugs, and halves iteration speed. The target market (music industry professionals) skews iOS in Romania. Web dashboard can serve Android users temporarily. | iOS only for v1. Build a responsive web dashboard that Android users can access via browser. Add Android when v1 is validated and resources allow. |
| **International coverage** | "When will you cover Hungary/Bulgaria/global?" | Expanding geographically before the Romanian product is solid dilutes focus. Each country requires new station curation, different CMO relationships, different market dynamics. | Romania only for v1. Nail the Romanian market first. International expansion is a v2+ milestone with separate research, partnerships, and infrastructure scaling. |
| **Monetization / subscription billing** | Every SaaS needs revenue eventually. | Adding payment infrastructure before product-market fit is premature optimization. Billing adds complexity: payment gateways, invoicing, failed payments, plan management, free trials. Do this AFTER the product proves valuable. | Free for v1 invited users. Gather usage data and feedback. Design monetization in a later phase informed by actual user behavior and willingness to pay. |
| **AI-generated insights / trend predictions** | "AI" is expected in 2026. Trend prediction sounds impressive. | Requires significant training data that doesn't exist yet (the platform hasn't collected data yet). ML models for music trends are notoriously unreliable. Adds complexity without proven user value. Competitor examples (BMG's StreamSight) are enterprise-scale efforts with massive datasets. | Simple trend indicators: "up 15% vs last week," "new station added your song." Statistical trends, not predictions. Add ML/AI when there is 6-12 months of data to train on. |

## Feature Dependencies

```
[Stream Recording & Storage]
    |-- requires --> [Station Management (admin adds stream URLs)]
    |-- requires --> [ACRCloud Integration (detection engine)]
    |
    |-- enables --> [5-Second Audio Snippets]
    |                   |-- enables --> [Snippet Playback in App]
    |
    |-- enables --> [Detection Data Storage]
                        |-- enables --> [Aggregated Dashboard]
                        |-- enables --> [Historical Data Access]
                        |-- enables --> [Data Export (CSV/PDF)]
                        |-- enables --> [Live Detection Feed]
                        |-- enables --> [Digest Notifications]
                        |-- enables --> [Competitor Station Intelligence]

[Invite-Only Auth]
    |-- enables --> [Role-Based Access Control]
                        |-- shapes --> [Artist View (own catalog)]
                        |-- shapes --> [Label View (all label artists)]
                        |-- shapes --> [Station View (competitors)]
                        |-- shapes --> [Admin View (everything)]

[User Management (admin)]
    |-- requires --> [Invite-Only Auth]
    |-- enables --> [Role Assignment]

[Search & Filtering]
    |-- requires --> [Detection Data Storage]
    |-- enhances --> [Aggregated Dashboard]
    |-- enhances --> [Data Export]
```

### Dependency Notes

- **Audio Snippets require Stream Recording**: You cannot cut 5-second snippets without recording the stream locally. ACRCloud does not provide audio playback -- the project must record streams independently and cut snippets at detection time. This is the most infrastructure-heavy dependency.
- **Everything analytical requires Detection Data Storage**: Dashboard, exports, feeds, notifications all depend on having a well-indexed store of detection events. Database schema design is foundational.
- **RBAC shapes all user-facing views**: Every screen in the app filters data based on the user's role and scope. Artist sees only their songs. Label sees their roster. Station sees competitor data. This must be designed into the data layer from day one, not bolted on later.
- **Live Feed and Digest Notifications are independent**: You can ship one without the other. Live feed requires WebSocket/SSE infrastructure. Digests require scheduled jobs. Neither blocks the other.
- **CSV Export and PDF Report are independent**: CSV is simpler (serialize data rows). PDF requires template rendering. Ship CSV first, add PDF later.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept with invited Romanian music industry users.

- [ ] **Backend monitoring 200+ streams 24/7** -- The core engine. Without this, nothing works.
- [ ] **ACRCloud integration for detection** -- The detection engine. Known quantity, team has experience.
- [ ] **5-second audio snippet capture and storage** -- The killer differentiator. This is WHY users choose this over checking WARM or Soundcharts.
- [ ] **Invite-only authentication** -- Controlled rollout for a known, finite user base.
- [ ] **Four roles: Admin, Artist, Label, Station** -- Each role sees the data relevant to them.
- [ ] **Aggregated stats dashboard** -- Daily/weekly/monthly play counts, top stations. The primary screen.
- [ ] **Station-level breakdown** -- Which stations play which songs, how often.
- [ ] **In-app snippet playback** -- Users tap a detection and hear the 5-second clip. Emotional proof.
- [ ] **Detection detail view** -- Per-detection: station, timestamp, duration, song, artist, ISRC.
- [ ] **Search and filtering** -- Find songs, artists, filter by date range and station.
- [ ] **CSV export** -- Industry-standard data portability.
- [ ] **Admin station management** -- Add/edit/remove stations and stream URLs.
- [ ] **Admin user management** -- Create invitations, assign roles and scopes.

### Add After Validation (v1.x)

Features to add once core is working and initial users confirm value.

- [ ] **Live detection feed** -- Add when users express desire for real-time visibility beyond dashboard stats. Requires WebSocket infrastructure.
- [ ] **Digest notifications (daily/weekly)** -- Add when users stop checking the app daily and need re-engagement. Requires push notification infrastructure.
- [ ] **PDF report generation** -- Add when users request shareable reports for management/CMOs. Requires server-side PDF rendering.
- [ ] **Competitor station intelligence view** -- Add when station-role users are onboarded and express interest. Uses existing data with a different UI lens.
- [ ] **Advanced filtering (by station type, city, format)** -- Add when station metadata is enriched and users need more granular analysis.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Public API for third-party integrations** -- When external developers or CMOs want programmatic access.
- [ ] **Android app** -- When iOS validates the concept and Android user demand is confirmed.
- [ ] **Monetization / subscription tiers** -- When product value is proven and pricing model is informed by usage data.
- [ ] **International expansion** -- When Romanian market is saturated and partnerships in other countries are established.
- [ ] **CMO integration (UCMR-ADA, CREDIDAM)** -- When direct reporting to Romanian CMOs becomes a requested feature. Requires partnership negotiation.
- [ ] **Web dashboard** -- When non-iOS users need access. Could serve Android gap in the interim.
- [ ] **Trend analytics and historical comparisons** -- When 6+ months of data enables meaningful trend analysis.
- [ ] **Team collaboration features** -- When labels with multiple team members need shared access with different permission levels within a role.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 24/7 stream monitoring + ACRCloud integration | HIGH | HIGH | P1 |
| 5-second audio snippet capture | HIGH | HIGH | P1 |
| Aggregated stats dashboard | HIGH | MEDIUM | P1 |
| In-app snippet playback | HIGH | MEDIUM | P1 |
| Invite-only auth + RBAC | HIGH | MEDIUM | P1 |
| Detection data storage (timestamps, ISRC, etc.) | HIGH | MEDIUM | P1 |
| Station-level breakdown | HIGH | LOW | P1 |
| Search and filtering | MEDIUM | LOW | P1 |
| CSV export | MEDIUM | LOW | P1 |
| Admin station management | HIGH | LOW | P1 |
| Admin user management | HIGH | MEDIUM | P1 |
| Live detection feed | MEDIUM | MEDIUM | P2 |
| Digest notifications | MEDIUM | MEDIUM | P2 |
| PDF report generation | MEDIUM | MEDIUM | P2 |
| Competitor station intelligence | MEDIUM | LOW | P2 |
| Advanced filtering | LOW | LOW | P2 |
| Public API | MEDIUM | HIGH | P3 |
| Android app | MEDIUM | HIGH | P3 |
| Monetization | HIGH (long-term) | HIGH | P3 |
| International expansion | LOW (for now) | HIGH | P3 |
| CMO integration | MEDIUM | HIGH | P3 |
| Web dashboard | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible (post-launch, pre-monetization)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | BMAT Vericast | Soundcharts | WARM | Radiostats (Songstats) | Mediabase | ACRCloud Dashboard | Media Forest (Romania) | **myFuckingMusic** |
|---------|---------------|-------------|------|------------------------|-----------|-------------------|----------------------|-------------------|
| 24/7 monitoring | 8,200 channels, 134 countries | 2,465 stations, 87 countries | 28,000+ stations, 130+ countries | 50,000+ stations (AI-powered) | 3,000+ stations, 270+ US markets | 50,000+ stations (raw API) | ~13 Romanian stations | 200+ Romanian stations |
| Audio/video evidence | Yes (enterprise, synched with EPG) | No | No | No | No | Timemap recordings (raw API) | No | **Yes (5-sec snippets, in-app playback)** |
| Real-time detection | Yes | Yes | Yes | Yes (activity feed) | Yes (Mscore) | Yes (API) | No (weekly charts) | Yes (live feed, P2) |
| Aggregated dashboard | Yes (enterprise) | Yes | Yes | Yes | Yes | Basic | Charts only | Yes |
| Per-station breakdown | Yes | Yes | Yes | Yes | Yes | Yes | Limited | Yes |
| Notifications | N/A (enterprise) | Customizable alerts | Email + SMS push | Real-time activity feed | N/A | N/A | N/A | Digest (P2) |
| Data export | API + reports | Yes (export) | Downloadable reports | N/A | Reports | API | N/A | CSV (P1), PDF (P2) |
| Charts / rankings | No | Radio charts by station/country | Weekly charts | No | Format-specific charts | No | Airplay 100 weekly | **No (deliberate)** |
| Role-based access | Enterprise (custom) | Team plans | Single user | Single user | Enterprise | Developer API | Public chart | **Yes (Artist/Label/Station/Admin)** |
| Competitor intelligence | Market analysis | Station analytics | No | No | Yes (programming tool) | No | No | **Yes (Station role, P2)** |
| Romanian coverage | Unknown (limited) | Partial (depends on ACRCloud) | Some | Unknown | No (US-focused) | Depends on setup | 13 stations | **200+ stations** |
| Mobile app | No | iOS + Android | No (web) | iOS + Android (via Songstats) | No | No | No (web) | **iOS** |
| Pricing | Enterprise ($$$) | From ~$100/mo | Freemium | From ~$5/mo (with Songstats) | Enterprise ($$$) | Pay per channel | Free (public charts) | **Invite-only / free v1** |

### Key Competitive Insights

1. **Audio proof gap**: Only BMAT Vericast offers audio/video evidence, and only to enterprise clients at high cost. ACRCloud has Timemap recordings but no consumer-friendly playback. No artist-facing platform lets you *hear* your detection. This is the single biggest differentiator.

2. **Romanian market gap**: Media Forest covers only ~13 stations for public charts. No international platform has deep Romanian coverage. 200+ Romanian stations is an immediate and defensible moat.

3. **Role diversity gap**: Most platforms serve one persona (artist OR station programmer OR enterprise rights holder). Having Artist, Label, Station, and Admin roles in one platform creates network effects -- labels invite their artists, stations compare against competitors who are also on the platform.

4. **Price gap**: Enterprise solutions (BMAT, Mediabase) cost thousands per month. Artist-facing solutions (WARM, Radiostats) are $5-20/mo but lack audio proof and Romanian depth. There is room for a mid-market product that delivers enterprise-grade evidence at accessible pricing (once monetization is introduced).

## Sources

- [BMAT Music Innovators](https://www.bmat.com/) - Enterprise broadcast monitoring, 8,200 channels, 134 countries
- [BMAT Vericast for Publishers](https://www.bmat.com/vericast-publishers/) - Audio/video evidence with EPG data, gap analysis, claims management
- [BMAT Vericast for Record Labels](https://www.bmat.com/vericast-record-labels/) - Centralized dashboard, API integration, 2000+ label clients
- [ACRCloud Broadcast Monitoring](https://www.acrcloud.com/broadcast-monitoring/) - 50,000+ stations, Timemap, UCF, API suite
- [ACRCloud Broadcast Monitoring Docs](https://docs.acrcloud.com/tutorials/broadcast-monitoring-for-music) - Recording API, channel management, detection results
- [Soundcharts Radio Airplay Monitoring](https://soundcharts.com/en/radio-airplay-monitoring) - 2,465 stations, 87 countries, ACRCloud-powered
- [WARM - World Airplay Radio Monitor](https://www.warmmusic.net/) - 28,000+ stations, email/SMS alerts, downloadable reports
- [Radiostats by Songstats](https://songstats.com/platforms/radiostats) - AI-powered, 50,000+ stations, real-time activity feed
- [SongBoost](https://songboost.app/) - Africa-focused, 300+ stations, instant notifications, team collaboration
- [Mediabase](https://en.wikipedia.org/wiki/Mediabase) - 3,000+ US stations, 360-degree reporting, format-specific charts
- [Chartmetric Radio Station Analytics](https://chartmetric.com/features/radio-station-analytics) - 3,000+ stations, station-level artist/label/genre analytics
- [Media Forest Romania](https://mediaforest-group.com/) - Romanian airplay charts, ~13 monitored stations, acoustic fingerprinting
- [SourceAudio Detect](https://www.sourceaudio.com/music-monitoring/) - Audio watermarking, broadcast placement tracking, 0.2s detection
- [Soundmouse by Orfium](https://www.orfium.com/broadcasters/) - Cue sheet automation, broadcaster-focused, acquired by Orfium
- [Syndicast](https://syndicast.co.uk/radio-promotion/sample-campaign-and-airplay-monitoring-report/) - Campaign reports, CSV/Excel/PDF export, PRO-ready logs
- [Romanian CMO Guide](https://www.maglas.ro/en/blog-avocat/how-can-a-musician-protect-their-copyright-royalties-in-romania-a-practical-guide-to-ucmr-ada-credidam-dacin-sara-upfr-and-the-role-of-orda/) - UCMR-ADA, CREDIDAM, UPFR roles in Romanian rights management

---
*Feature research for: Music Broadcast Monitoring Platform (Romanian Market)*
*Researched: 2026-03-14*
