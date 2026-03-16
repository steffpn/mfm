import { describe, it, expect } from "vitest";
import { shouldDeliverToUser } from "../../src/lib/live-feed-filter.js";
import type { LiveDetectionEvent } from "../../src/lib/pubsub.js";
import type { CurrentUser } from "../../src/middleware/authenticate.js";

// ---- Helper: build a LiveDetectionEvent ----
function buildEvent(overrides: Partial<LiveDetectionEvent> = {}): LiveDetectionEvent {
  return {
    id: 1,
    stationId: 5,
    songTitle: "Doua Inimi",
    artistName: "Irina Rimes",
    isrc: "ROA231600001",
    snippetUrl: null,
    stationName: "Radio ZU",
    startedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---- Helper: build a CurrentUser ----
function buildUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 1,
    email: "user@test.com",
    role: "ADMIN",
    isActive: true,
    scopes: [],
    ...overrides,
  };
}

describe("shouldDeliverToUser", () => {
  // Test 1: ADMIN user receives any event regardless of stationId
  it("ADMIN user receives any event regardless of stationId", () => {
    const event = buildEvent({ stationId: 99 });
    const user = buildUser({ role: "ADMIN", scopes: [] });

    expect(shouldDeliverToUser(event, user)).toBe(true);
  });

  // Test 2: STATION user with scope [stationId: 5] receives event from station 5
  it("STATION user with matching station scope receives the event", () => {
    const event = buildEvent({ stationId: 5 });
    const user = buildUser({
      role: "STATION",
      scopes: [{ entityType: "STATION", entityId: 5 }],
    });

    expect(shouldDeliverToUser(event, user)).toBe(true);
  });

  // Test 3: STATION user with scope [stationId: 5] does NOT receive event from station 99
  it("STATION user without matching station scope does NOT receive the event", () => {
    const event = buildEvent({ stationId: 99 });
    const user = buildUser({
      role: "STATION",
      scopes: [{ entityType: "STATION", entityId: 5 }],
    });

    expect(shouldDeliverToUser(event, user)).toBe(false);
  });

  // Test 4: STATION user with multiple station scopes receives events from any of them
  it("STATION user with multiple station scopes receives events from any scoped station", () => {
    const event = buildEvent({ stationId: 10 });
    const user = buildUser({
      role: "STATION",
      scopes: [
        { entityType: "STATION", entityId: 5 },
        { entityType: "STATION", entityId: 10 },
        { entityType: "STATION", entityId: 15 },
      ],
    });

    expect(shouldDeliverToUser(event, user)).toBe(true);
  });

  // Test 5: ARTIST user with any scope entry receives any event
  it("ARTIST user with any scope entry receives any event", () => {
    const event = buildEvent({ stationId: 99 });
    const user = buildUser({
      role: "ARTIST",
      scopes: [{ entityType: "ARTIST", entityId: 1 }],
    });

    expect(shouldDeliverToUser(event, user)).toBe(true);
  });

  // Test 6: LABEL user with any scope entry receives any event
  it("LABEL user with any scope entry receives any event", () => {
    const event = buildEvent({ stationId: 99 });
    const user = buildUser({
      role: "LABEL",
      scopes: [{ entityType: "LABEL", entityId: 1 }],
    });

    expect(shouldDeliverToUser(event, user)).toBe(true);
  });

  // Test 7: ARTIST user with zero scopes does NOT receive events
  it("ARTIST user with zero scopes does NOT receive events", () => {
    const event = buildEvent();
    const user = buildUser({ role: "ARTIST", scopes: [] });

    expect(shouldDeliverToUser(event, user)).toBe(false);
  });

  // Test 8: STATION user with zero scopes does NOT receive events
  it("STATION user with zero scopes does NOT receive events", () => {
    const event = buildEvent();
    const user = buildUser({ role: "STATION", scopes: [] });

    expect(shouldDeliverToUser(event, user)).toBe(false);
  });
});
