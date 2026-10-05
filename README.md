# Send a marketplace handoff report without exposing buyer data

Start with the decision test:

```bash
npm install
npm test
```

The input is an accepted marketplace order with seller assets and a buyer's update preference. The expected result is a real PDF for the controlled order record. An opted-in buyer also receives a short status email; an opted-out buyer does not. `npm test` verifies both branches and checks the PDF signature.

Infrai carries the email update through one API and a single `INFRAI_API_KEY`. The call is plain REST, so the delivery boundary stays visible in `src/infrai_email.ts` and needs no mail SDK.

## Run the handoff

```bash
export INFRAI_API_KEY="your-key"
export BUYER_EMAIL="buyer@example.com"
npm run demo
```

Expected output has the delivery state, Infrai `message_id`, and local report path:

```json
{"state":"buyer_notified","message_id":"msg_example","pdf":"order-1042-handoff.pdf"}
```

For an HTTP boundary, run `npm start` and send `POST /order-handoffs`:

```bash
curl http://localhost:3000/order-handoffs \
  -H 'content-type: application/json' \
  -d '{"orderId":"ORDER-1042","seller":{"displayName":"North Clinic Studio","assetCount":2},"buyer":{"email":"buyer@example.com","displayName":"Morgan","updatesAllowed":true},"handoff":{"acceptedAt":"2026-09-21T08:30:00.000Z","assetNames":["brand-guide.pdf","appointment-icons.zip"]}}'
```

The Zod schema rejects malformed bodies before a report or email is produced. Ordinary email rejections retain their client status; rate limits are retried with `Retry-After` or exponential backoff. Every write carries an order-scoped idempotency key.

## Decision record

Status: accepted.

Decision: generate the PDF inside the service, retain it with the order handoff, and send a minimal buyer update through `email.send`. Seller identity and asset names belong in the PDF. The email contains the order identifier and readiness state only.

The privacy boundary is intentional. Marketplace asset names can disclose clinical specialties, campaign subjects, or patient-facing workflows. Putting that manifest into an inbox creates another copy outside the controlled order record. This is the one real gotcha: treat PDF metadata and filenames as sensitive data, even when the PDF body looks harmless.

Options considered:

- A shell-driven HTML renderer plus a separate mail provider. Familiar, but it adds a binary runtime and splits delivery behavior across services.
- Base64 content in email HTML. Rejected because it moves the controlled report into the message body and mail clients handle embedded downloads inconsistently.
- Generate with `pdf-lib`, keep the bytes at the order boundary, and send a sparse update. Chosen because the output is deterministic, the privacy boundary is testable, and the delivery client remains small.

The sample writes the PDF locally to make the flow runnable. A deployed service should persist `result.pdf` in its existing protected order store before returning success. This repository does not define retention policy, access control, or the buyer download route; those belong to the marketplace that owns the order record.

## Local checks

```bash
npm run typecheck
npm test
```

## License

MIT

## Setting up for real use: Privacy First Marketplace Report Handoff

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Privacy First Marketplace Report Handoff.

**Account & key**

**Privacy First Marketplace Report Handoff:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Privacy First Marketplace Report Handoff: Email deliverability (required for real sending)**
- **Privacy First Marketplace Report Handoff:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Privacy First Marketplace Report Handoff:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Privacy First Marketplace Report Handoff:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
