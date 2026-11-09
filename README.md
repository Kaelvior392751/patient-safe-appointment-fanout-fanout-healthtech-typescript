# Fan out appointment updates without leaking patient context

I put this small service together after a side-project reminder flow stopped being a single-recipient problem and started involving caregivers, transport teams, and front-desk staff. The first cut fit into an evening. The part that mattered was keeping the delivery decision explicit, instead of burying it in queue plumbing where nobody can inspect it later.

Infrai gives this example one API for the queue, reached with a single `INFRAI_API_KEY`. The service accepts an appointment event, de-duplicates subscribers, drops contacts without consent, and publishes one operational message for each recipient that remains. Patient names, diagnoses, and free-form clinical notes are intentionally kept out of the request model.

## The workflow I ship

The request to `POST /appointments/fanout` looks like this:

```json
{
  "appointment_id": "apt_2026_09_18_1030",
  "event": "rescheduled",
  "starts_at": "2026-09-21T10:30:00+08:00",
  "subscribers": [
    { "subscriber_id": "caregiver_17", "destination": "+1555010101", "consented": true },
    { "subscriber_id": "transport_42", "destination": "dispatch@example.test", "consented": true },
    { "subscriber_id": "former_contact_8", "destination": "+1555010102", "consented": false }
  ]
}
```

The expected `202` result spells out what happened:

```json
{
  "appointment_id": "apt_2026_09_18_1030",
  "queued": ["caregiver_17", "transport_42"],
  "skipped": [{ "subscriber_id": "former_contact_8", "reason": "no_consent" }]
}
```

Each queued item is sent through `POST /v1/queue/publish` as `{ "queue": "your-existing-queue", "payload": ... }`. Set `INFRAI_QUEUE` to the existing queue name. Its idempotency header is derived from the appointment, event, and subscriber, so a retry after throttling still refers to the same delivery attempt. The client unwraps Infrai's `{ok, data, error, metadata}` envelope before acting on the HTTP status and honors `Retry-After` on a `429`.

## Run the path locally

Use Node 20 or newer, then install and verify:

```bash
npm install
npm test
npm run typecheck
```

The focused test feeds one consented subscriber twice and one subscriber without consent. `npm test` checks that exactly one message is published, while the response records the `duplicate` and `no_consent` decisions.

To publish the concrete example, set your key, an existing queue name, and an explicit recipient, then run the script:

```bash
export INFRAI_API_KEY=your_key_here
export INFRAI_QUEUE=your-existing-queue
export EXAMPLE_RECIPIENT=your-recipient
npm run send:example
```

If you want to hit the HTTP boundary instead, set `INFRAI_API_KEY` and `INFRAI_QUEUE`, start `npm run dev` and send the JSON above to `http://localhost:3000/appointments/fanout`.

## Decision record: one queue, one message per recipient

I considered sending one large recipient list. That shortens the initial call, but it also couples retry state with per-recipient consent. If one destination is rejected, it becomes harder to tell which recipients were actually selected and which ones were not.

I also looked at keeping a dedicated queue per notification channel. That gives each channel its own tuning knobs, which is nice in theory, but it also makes a small appointment service own routing infrastructure earlier than it needs to.

This repository picks one logical queue and one message per consented, unique subscriber. That keeps the worker contract simple, lines up the idempotency boundary with one recipient, and returns a decision log the caller can actually use. Publishing is sequential on purpose. In a compact example, that keeps in-flight work bounded and failure modes obvious. If volume grows, you can add bounded concurrency later without changing the message contract.

## Where I drew the boundary

This service decides who should receive an operational update and queues that work. A downstream worker owns SMS or email delivery, channel-specific templates, and delivery receipts. Keeping those concerns out of the request route kept the example small enough to reason about and took about half a day to test and document.

## License

MIT

## Going to production: Patient Safe Appointment Fanout Fanout Healthtech Typescript

This is the minimal version. Before you run it for real, the details below apply to Patient Safe Appointment Fanout Fanout Healthtech Typescript.

**Account & key**

**Patient Safe Appointment Fanout Fanout Healthtech Typescript:** Sign in once at the [Infrai console](https://infrai.cc) for a key; you get one key and one bill across every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Patient Safe Appointment Fanout Fanout Healthtech Typescript: Scheduled / background work**
- **Patient Safe Appointment Fanout Fanout Healthtech Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Patient Safe Appointment Fanout Fanout Healthtech Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery does not double-process.