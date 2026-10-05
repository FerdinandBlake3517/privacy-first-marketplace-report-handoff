import { writeFile } from "node:fs/promises";
import { createInfraiEmail } from "../src/infrai_email.js";
import { handoffMarketplaceReport } from "../src/marketplace_report_handoff.js";

const apiKey = process.env.INFRAI_API_KEY;
const buyerEmail = process.env.BUYER_EMAIL;
if (!apiKey || !buyerEmail) throw new Error("INFRAI_API_KEY and BUYER_EMAIL are required");

const infrai = createInfraiEmail(apiKey);
const result = await handoffMarketplaceReport({
  orderId: "ORDER-1042",
  seller: { displayName: "North Clinic Studio", assetCount: 2 },
  buyer: { email: buyerEmail, displayName: "Morgan", updatesAllowed: true },
  handoff: {
    acceptedAt: "2026-09-21T08:30:00.000Z",
    assetNames: ["brand-guide.pdf", "appointment-icons.zip"],
  },
}, infrai);

await writeFile("order-1042-handoff.pdf", result.pdf);
console.log(JSON.stringify({ state: result.state, message_id: result.messageId, pdf: "order-1042-handoff.pdf" }));
