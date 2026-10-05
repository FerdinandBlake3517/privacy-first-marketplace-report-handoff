import assert from "node:assert/strict";
import test from "node:test";
import { handoffMarketplaceReport, type EmailSender } from "../src/marketplace_report_handoff.js";

const baseRequest = {
  orderId: "ORDER-77",
  seller: { displayName: "Clinical Asset Lab", assetCount: 1 },
  buyer: { email: "buyer@example.test", displayName: "Avery", updatesAllowed: false },
  handoff: { acceptedAt: "2026-09-21T08:30:00.000Z", assetNames: ["intake-layout.pdf"] },
};

test("generates the handoff PDF but respects a buyer who declined updates", async () => {
  let sends = 0;
  const sender: EmailSender = {
    email: { send: async () => { sends += 1; return { message_id: "unused" }; } },
  };

  const result = await handoffMarketplaceReport(baseRequest, sender);

  assert.equal(result.state, "report_generated");
  assert.equal(sends, 0);
  assert.equal(Buffer.from(result.pdf).subarray(0, 4).toString(), "%PDF");
});

test("notifies an opted-in buyer with the order-scoped idempotency key", async () => {
  let capturedKey = "";
  const sender: EmailSender = {
    email: {
      send: async (_body, key) => {
        capturedKey = key;
        return { message_id: "msg_42" };
      },
    },
  };

  const result = await handoffMarketplaceReport({
    ...baseRequest,
    buyer: { ...baseRequest.buyer, updatesAllowed: true },
  }, sender);

  assert.equal(result.state, "buyer_notified");
  assert.equal(result.messageId, "msg_42");
  assert.equal(capturedKey, "order-handoff:ORDER-77");
});
