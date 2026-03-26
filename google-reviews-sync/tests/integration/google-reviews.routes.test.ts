import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../../src/app";
import { setupTestDatabase, teardownTestDatabase } from "../helpers/test-db";

let app: ReturnType<typeof createApp>;
let db: Database.Database;

beforeEach(() => {
  db = setupTestDatabase();
  app = createApp();
});

afterEach(() => {
  teardownTestDatabase();
});

describe("POST /integrations/google-reviews/sync", () => {
  // Case 01: Eligible positive feedback, provider sync succeeds
  it("case_01: should sync eligible positive feedback successfully", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_001",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: {
          id: "resto_123",
          name: "Restaurant A",
          googleSyncEnabled: true,
          googleReviewUrl: "https://g.page/r/restaurant-a/review",
        },
        simulateMode: "FORCE_SYNCED",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SYNCED");
    expect(res.body.reasonCode).toBe("ELIGIBLE_AND_SYNCED");
    expect(res.body.attemptCount).toBeGreaterThanOrEqual(1);
    expect(res.body.provider).toBe("google_reviews");
    expect(res.body.fallback).toBeUndefined();
  });

  // Case 02: Eligible feedback but provider policy blocks direct create
  it("case_02: should return BLOCKED_BY_PROVIDER_POLICY with fallback prompt", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_002",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:05:00.000Z",
        restoinfo: {
          id: "resto_123",
          googleSyncEnabled: true,
          googleReviewUrl: "https://g.page/r/restaurant-a/review",
        },
        simulateMode: "FORCE_POLICY_BLOCK",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("BLOCKED_BY_PROVIDER_POLICY");
    expect(res.body.reasonCode).toBe("CREATE_REVIEW_NOT_SUPPORTED");
    expect(res.body.attemptCount).toBeGreaterThanOrEqual(1);
    expect(res.body.fallback).toBeDefined();
    expect(res.body.fallback.promptIssued).toBe(true);
    expect(res.body.fallback.promptUrl).toBe(
      "https://g.page/r/restaurant-a/review",
    );
  });

  // Case 03: Negative feedback should not trigger Google sync
  it("case_03: should skip negative feedback", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_003",
        restaurantId: "resto_123",
        rating: 1,
        isFeedbackNegative: true,
        timestamp: "2026-03-25T12:10:00.000Z",
        restoinfo: {
          id: "resto_123",
          googleSyncEnabled: true,
          googleReviewUrl: "https://g.page/r/restaurant-a/review",
        },
        simulateMode: "NONE",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SKIPPED_NOT_ELIGIBLE");
    expect(res.body.reasonCode).toBe("NOT_ELIGIBLE_NEGATIVE_FEEDBACK");
    expect(res.body.attemptCount).toBe(0);
  });

  // Case 04: Low rating below threshold should be skipped
  it("case_04: should skip low rating feedback", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_004",
        restaurantId: "resto_123",
        rating: 2,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:15:00.000Z",
        restoinfo: {
          id: "resto_123",
          googleSyncEnabled: true,
          googleReviewUrl: "https://g.page/r/restaurant-a/review",
        },
        simulateMode: "NONE",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SKIPPED_NOT_ELIGIBLE");
    expect(res.body.reasonCode).toBe("NOT_ELIGIBLE_LOW_RATING");
    expect(res.body.attemptCount).toBe(0);
  });

  // Case 05: Provider timeout - should be retryable
  it("case_05: should return FAILED_RETRYABLE for provider timeout", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_005",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:20:00.000Z",
        restoinfo: {
          id: "resto_123",
          googleSyncEnabled: true,
          googleReviewUrl: "https://g.page/r/restaurant-a/review",
        },
        simulateMode: "FORCE_TIMEOUT",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FAILED_RETRYABLE");
    expect(res.body.reasonCode).toBe("PROVIDER_TIMEOUT");
    expect(res.body.attemptCount).toBeGreaterThanOrEqual(1);
  });

  // Case 06: Duplicate event - should not duplicate side effects
  it("case_06: should handle duplicate events idempotently", async () => {
    const firstEvent = {
      feedbackId: "fb_006",
      restaurantId: "resto_123",
      rating: 5,
      isFeedbackNegative: false,
      timestamp: "2026-03-25T12:25:00.000Z",
      restoinfo: {
        id: "resto_123",
        googleSyncEnabled: true,
        googleReviewUrl: "https://g.page/r/restaurant-a/review",
      },
      simulateMode: "FORCE_SYNCED",
    };

    const secondEvent = {
      ...firstEvent,
      timestamp: "2026-03-25T12:26:00.000Z", // Different timestamp, same feedbackId
    };

    // First request
    const res1 = await request(app)
      .post("/integrations/google-reviews/sync")
      .send(firstEvent);

    expect(res1.body.status).toBe("SYNCED");
    expect(res1.body.attemptCount).toBe(1);

    // Duplicate request - should return existing status
    const res2 = await request(app)
      .post("/integrations/google-reviews/sync")
      .send(secondEvent);

    expect(res2.body.status).toBe("SYNCED");
    expect(res2.body.attemptCount).toBe(1); // Not incremented - no new provider call
    expect(res2.body.duplicate).toBe(true);
  });

  // Case 07: Restaurant-level flag disables Google sync
  it("case_07: should skip when google sync is disabled at restaurant level", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_007",
        restaurantId: "resto_999",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:30:00.000Z",
        restoinfo: {
          id: "resto_999",
          googleSyncEnabled: false,
          googleReviewUrl: "https://g.page/r/restaurant-b/review",
        },
        simulateMode: "NONE",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SKIPPED_NOT_ELIGIBLE");
    expect(res.body.reasonCode).toBe("NOT_ELIGIBLE_GOOGLE_DISABLED");
  });

  // Case 08: Malformed payload - missing required field
  it("case_08: should return 400 for missing restaurantId", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_008",
        // restaurantId is missing
        rating: 4,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:35:00.000Z",
        restoinfo: {
          id: "resto_123",
          googleSyncEnabled: true,
        },
        simulateMode: "NONE",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });
});

describe("GET /integrations/google-reviews/status/:feedbackId", () => {
  it("should return sync status for existing record", async () => {
    // First, create a record
    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_status_test",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: { googleSyncEnabled: true },
        simulateMode: "FORCE_SYNCED",
      });

    // Then query status
    const res = await request(app).get(
      "/integrations/google-reviews/status/fb_status_test",
    );

    expect(res.status).toBe(200);
    expect(res.body.feedbackId).toBe("fb_status_test");
    expect(res.body.status).toBe("SYNCED");
    expect(res.body.provider).toBe("google_reviews");
    expect(res.body.reasonCode).toBe("ELIGIBLE_AND_SYNCED");
  });

  it("should return 404 for non-existent feedbackId", async () => {
    const res = await request(app).get(
      "/integrations/google-reviews/status/fb_nonexistent",
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /integrations/google-reviews/retry/:feedbackId", () => {
  it("should accept retry for FAILED_RETRYABLE record", async () => {
    // Create a retryable failure
    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_retry_test",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: {
          googleSyncEnabled: true,
          googleReviewUrl: "https://g.page/r/test/review",
        },
        simulateMode: "FORCE_TIMEOUT",
      });

    // Retry
    const res = await request(app)
      .post("/integrations/google-reviews/retry/fb_retry_test")
      .send({ requestedBy: "admin" });

    expect(res.status).toBe(200);
    expect(res.body.retryAccepted).toBe(true);
    expect(res.body.feedbackId).toBe("fb_retry_test");
  });

  it("should reject retry for SYNCED record", async () => {
    // Create a successful record
    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_synced_no_retry",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: { googleSyncEnabled: true },
        simulateMode: "FORCE_SYNCED",
      });

    const res = await request(app)
      .post("/integrations/google-reviews/retry/fb_synced_no_retry")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.retryAccepted).toBe(false);
  });

  it("should return 404 for non-existent feedbackId", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/retry/fb_nonexistent")
      .send({});

    expect(res.status).toBe(404);
  });

  it("should reject retry for SKIPPED_NOT_ELIGIBLE record", async () => {
    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_skip_no_retry",
        restaurantId: "resto_123",
        rating: 1,
        isFeedbackNegative: true,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: { googleSyncEnabled: true },
        simulateMode: "NONE",
      });

    const res = await request(app)
      .post("/integrations/google-reviews/retry/fb_skip_no_retry")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.retryAccepted).toBe(false);
    expect(res.body.message).toContain("SKIPPED_NOT_ELIGIBLE");
  });

  it("should reject retry for FAILED_PERMANENT record", async () => {
    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_perm_no_retry",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: { googleSyncEnabled: true },
        simulateMode: "FORCE_PERMANENT_FAILURE",
      });

    const res = await request(app)
      .post("/integrations/google-reviews/retry/fb_perm_no_retry")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.retryAccepted).toBe(false);
    expect(res.body.message).toContain("FAILED_PERMANENT");
  });

  it("should reject retry for BLOCKED_BY_PROVIDER_POLICY record", async () => {
    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_blocked_no_retry",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: {
          googleSyncEnabled: true,
          googleReviewUrl: "https://g.page/r/test/review",
        },
        simulateMode: "FORCE_POLICY_BLOCK",
      });

    const res = await request(app)
      .post("/integrations/google-reviews/retry/fb_blocked_no_retry")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.retryAccepted).toBe(false);
    expect(res.body.message).toContain("BLOCKED_BY_PROVIDER_POLICY");
  });

  it("should reject retry with force=true on terminal status (SYNCED)", async () => {
    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_force_synced",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: { googleSyncEnabled: true },
        simulateMode: "FORCE_SYNCED",
      });

    const res = await request(app)
      .post("/integrations/google-reviews/retry/fb_force_synced")
      .send({ force: true });

    expect(res.status).toBe(200);
    expect(res.body.retryAccepted).toBe(false);
    expect(res.body.message).toContain("terminal status");
  });
});

describe("POST /integrations/google-reviews/sync - validation edge cases", () => {
  it("should return 400 for missing feedbackId", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("should return 400 for missing rating", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_val_1",
        restaurantId: "resto_123",
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("should return 400 for missing isFeedbackNegative", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_val_2",
        restaurantId: "resto_123",
        rating: 5,
        timestamp: "2026-03-25T12:00:00.000Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("should return 400 for missing timestamp", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_val_3",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("should return 400 for negative rating", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_val_4",
        restaurantId: "resto_123",
        rating: -1,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("should return 400 for rating above 5", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_val_5",
        restaurantId: "resto_123",
        rating: 6,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("should return 400 for empty string feedbackId", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("should return 400 for empty string restaurantId", async () => {
    const res = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_val_7",
        restaurantId: "",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });
});

describe("GET /integrations/google-reviews/list", () => {
  it("should return empty list when no records exist", async () => {
    const res = await request(app).get("/integrations/google-reviews/list");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.records).toEqual([]);
  });

  it("should return all records after syncing multiple events", async () => {
    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_list_1",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: { googleSyncEnabled: true },
        simulateMode: "FORCE_SYNCED",
      });

    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_list_2",
        restaurantId: "resto_123",
        rating: 1,
        isFeedbackNegative: true,
        timestamp: "2026-03-25T12:01:00.000Z",
        restoinfo: { googleSyncEnabled: true },
      });

    const res = await request(app).get("/integrations/google-reviews/list");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.records).toHaveLength(2);
    expect(res.body.records[0].feedbackId).toBeDefined();
    expect(res.body.records[0].status).toBeDefined();
  });

  it("should respect limit query parameter", async () => {
    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_limit_1",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: { googleSyncEnabled: true },
        simulateMode: "FORCE_SYNCED",
      });

    await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_limit_2",
        restaurantId: "resto_123",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:01:00.000Z",
        restoinfo: { googleSyncEnabled: true },
        simulateMode: "FORCE_SYNCED",
      });

    const res = await request(app).get(
      "/integrations/google-reviews/list?limit=1",
    );

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.records).toHaveLength(1);
  });
});

describe("GET /health", () => {
  it("should return ok status", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
  });
});

describe("POST sync then GET status consistency", () => {
  it("should return matching data from sync response and status endpoint", async () => {
    const syncRes = await request(app)
      .post("/integrations/google-reviews/sync")
      .send({
        feedbackId: "fb_consistency",
        restaurantId: "resto_456",
        rating: 5,
        isFeedbackNegative: false,
        timestamp: "2026-03-25T12:00:00.000Z",
        restoinfo: {
          googleSyncEnabled: true,
          googleReviewUrl: "https://g.page/r/test/review",
        },
        simulateMode: "FORCE_POLICY_BLOCK",
      });

    const statusRes = await request(app).get(
      "/integrations/google-reviews/status/fb_consistency",
    );

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.feedbackId).toBe(syncRes.body.feedbackId);
    expect(statusRes.body.restaurantId).toBe(syncRes.body.restaurantId);
    expect(statusRes.body.status).toBe(syncRes.body.status);
    expect(statusRes.body.reasonCode).toBe(syncRes.body.reasonCode);
    expect(statusRes.body.provider).toBe(syncRes.body.provider);
    expect(statusRes.body.fallback).toBeDefined();
    expect(statusRes.body.fallback.promptIssued).toBe(true);
  });
});
