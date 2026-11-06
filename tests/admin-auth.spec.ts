import { test, expect } from "@playwright/test";

test.describe("Admin API authorization enforcement", () => {
  test("rejects unauthorized GET to /api/admin/puzzles", async ({ request }) => {
    const res = await request.get("/api/admin/puzzles");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  test("rejects unauthorized POST to /api/admin/publish", async ({ request }) => {
    const res = await request.post("/api/admin/publish", {
      data: {
        puzzle_id: "non-existent-id",
        publish_date: "2026-01-01"
      }
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  test("rejects unauthorized POST to /api/admin/generate-ai", async ({ request }) => {
    const res = await request.post("/api/admin/generate-ai");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  test("rejects requests with invalid admin token", async ({ request }) => {
    const res = await request.get("/api/admin/puzzles", {
      headers: {
        authorization: "Bearer wrong-secret-token"
      }
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });
});
