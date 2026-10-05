import { createServer } from "node:http";
import { ZodError } from "zod";
import { createInfraiEmail, InfraiError } from "./infrai_email.js";
import { handoffMarketplaceReport } from "./marketplace_report_handoff.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");
const infrai = createInfraiEmail(apiKey);
const port = Number(process.env.PORT ?? "3000");

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/order-handoffs") {
    response.writeHead(404).end();
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = await handoffMarketplaceReport(input, infrai);
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      orderId: result.orderId,
      state: result.state,
      messageId: result.messageId,
      pdfBytes: result.pdf.byteLength,
    }));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "invalid_request" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.code }));
      return;
    }
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "internal_error" }));
  }
}).listen(port, () => console.log(`Report handoff service listening on http://localhost:${port}`));
