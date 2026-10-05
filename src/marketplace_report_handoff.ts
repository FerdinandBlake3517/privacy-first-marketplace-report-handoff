import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import type { EmailReceipt } from "./infrai_email.js";

export const handoffRequestSchema = z.object({
  orderId: z.string().trim().min(1).max(80),
  seller: z.object({
    displayName: z.string().trim().min(1).max(120),
    assetCount: z.number().int().nonnegative(),
  }),
  buyer: z.object({
    email: z.string().email(),
    displayName: z.string().trim().min(1).max(120),
    updatesAllowed: z.boolean(),
  }),
  handoff: z.object({
    acceptedAt: z.string().datetime(),
    assetNames: z.array(z.string().trim().min(1).max(160)).max(100),
  }),
});

export type HandoffRequest = z.infer<typeof handoffRequestSchema>;

export type HandoffResult = {
  orderId: string;
  state: "report_generated" | "buyer_notified";
  pdf: Uint8Array;
  messageId?: string;
};

export type EmailSender = {
  email: {
    send(
      body: { to: string; subject: string; html: string },
      idempotencyKey: string,
    ): Promise<EmailReceipt>;
  };
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function buildPdf(request: HandoffRequest): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Order ${request.orderId} handoff report`);
  document.setAuthor("Marketplace Handoff Service");
  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let y = 744;
  page.drawText("Marketplace asset handoff", { x: 48, y, size: 18, font: bold, color: rgb(0.08, 0.2, 0.18) });
  y -= 36;
  const lines = [
    `Order: ${request.orderId}`,
    `Seller: ${request.seller.displayName}`,
    `Accepted: ${request.handoff.acceptedAt}`,
    `Declared assets: ${request.seller.assetCount}`,
    `Transferred assets: ${request.handoff.assetNames.length}`,
    "",
    "Asset manifest",
    ...request.handoff.assetNames.map((name, index) => `${index + 1}. ${name}`),
  ];
  for (const line of lines) {
    page.drawText(line, { x: 48, y, size: 10, font: line === "Asset manifest" ? bold : regular });
    y -= 17;
  }
  return document.save();
}

export async function handoffMarketplaceReport(
  input: unknown,
  infrai: EmailSender,
): Promise<HandoffResult> {
  const request = handoffRequestSchema.parse(input);
  const pdf = await buildPdf(request);
  if (!request.buyer.updatesAllowed) {
    return { orderId: request.orderId, state: "report_generated", pdf };
  }

  // Keep the buyer update minimal; the PDF manifest remains in the controlled order handoff.
  const receipt = await infrai.email.send({
    to: request.buyer.email,
    subject: `Order ${request.orderId} handoff report is ready`,
    html: `<p>Hello ${escapeHtml(request.buyer.displayName)},</p><p>Your order handoff was accepted. The PDF report is ready in the order record.</p>`,
  }, `order-handoff:${request.orderId}`);

  return {
    orderId: request.orderId,
    state: "buyer_notified",
    pdf,
    messageId: receipt.message_id,
  };
}
