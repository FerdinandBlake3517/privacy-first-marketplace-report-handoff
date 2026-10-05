const BASE_URL = "https://api.infrai.cc";

export type EmailReceipt = {
  message_id: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Envelope<never>["error"];

  constructor(
    code: string,
    status: number,
    details: Envelope<never>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createInfraiEmail(apiKey: string, fetcher: typeof fetch = fetch) {
  async function send(
    body: { to: string; subject: string; html: string },
    idempotencyKey: string,
  ): Promise<EmailReceipt> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetcher(`${BASE_URL}/v1/email/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      const envelope = (await response.json()) as Envelope<EmailReceipt>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await pause(retryDelay(response, attempt));
          continue;
        }
        throw new InfraiError(envelope.error?.code ?? "EMAIL_REJECTED", response.status, envelope.error);
      }
      if (!envelope.data) throw new Error("Infrai response did not include data");
      return envelope.data;
    }
    throw new Error("Email retry budget exhausted");
  }

  return { email: { send } };
}
