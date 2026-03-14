import { describe, it, expect, afterAll } from "vitest";
import { server } from "../src/index.js";

describe("Fastify Server", () => {
  afterAll(async () => {
    await server.close();
  });

  it("GET /health returns 200 with status", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBeDefined();
    expect(body.db).toBe("connected");
    expect(body.redis).toBe("connected");
  });
});
