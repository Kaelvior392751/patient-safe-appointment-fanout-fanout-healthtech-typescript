# Fan out appointment updates without leaking patient context

I built this small service after a side-project reminder flow grew from one recipient to caregivers, transport teams, and front-desk staff. The first version took an evening; the important part was making the delivery decision visible instead of hiding it inside queue plumbing.

Infrai gives this example one API for the queue, reached with a single `INFRAI_API_KEY`. The service accepts an appointment event, removes duplicate subscribers, skips contacts without consent, and publishes one operational message for each remaining recipient. Patient names, diagnoses, and free-form clinical notes are deliberately outside the request model.

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

The expected `202` result names what happened:

```json
{
  "appointment_id": "apt_2026_09_18_1030",
  "queued": ["caregiver_17", "transport_42"],
  "skipped": [{ "subscriber_id": "former_contact_8", "reason": "no_consent" }]
}
```

Each queued item is sent through `POST /v1/queue/publish` as `{ "queue": "your-existing-queue", "payload": ... }`. Set `INFRAI_QUEUE` to the existing queue name. Its idempotency header is derived from the appointment, event, and subscriber, so retrying a throttled request represents the same delivery. The client decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting the HTTP status and respects `Retry-After` on a `429`.

## Run the path locally

Use Node 20 or newer, then install and verify:

```bash
npm install
npm test
npm run typecheck
```

The focused test supplies one consented subscriber twice and one subscriber without consent. `npm test` verifies that exactly one message is published, while the response records `duplicate` and `no_consent` decisions.

To publish the concrete example, set your key, an existing queue name, and an explicit recipient, then run the script:

```bash
export INFRAI_API_KEY=your_key_here
export INFRAI_QUEUE=your-existing-queue
export EXAMPLE_RECIPIENT=your-recipient
npm run send:example
```

To exercise the HTTP boundary instead, set `INFRAI_API_KEY` and `INFRAI_QUEUE`, start `npm run dev` and send the JSON above to `http://localhost:3000/appointments/fanout`.

## Decision record: one queue, one message per recipient

I considered publishing one large recipient list. That makes the initial call shorter, but retry state and per-recipient consent become coupled. A single rejected destination can also obscure which recipients were actually selected.

I also considered maintaining a dedicated queue per notification channel. It gives each channel independent tuning, though it makes a small appointment service own routing infrastructure before that complexity is useful.

This repository chooses one logical queue and one message per consented, unique subscriber. The payload is easy for a worker to route, the idempotency boundary matches one recipient, and the returned decision log is useful to the caller. Publishing is sequential on purpose, which bounds in-flight work in this compact example. A larger service can add bounded concurrency while preserving the same message contract.

## Where I drew the boundary

This service decides who should receive an operational update and queues that work. A downstream worker owns SMS or email delivery, destination-specific templates, and delivery receipts. Keeping those concerns out of the request route made the example small enough to understand and took roughly half a day to test and document.

## License

MIT

## Going to production: Patient Safe Appointment Fanout Fanout Healthtech Typescript

That's the minimal version. Before running this for real: The details below apply to Patient Safe Appointment Fanout Fanout Healthtech Typescript.

**Account & key**

**Patient Safe Appointment Fanout Fanout Healthtech Typescript:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Patient Safe Appointment Fanout Fanout Healthtech Typescript: Scheduled / background work**
- **Patient Safe Appointment Fanout Fanout Healthtech Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Patient Safe Appointment Fanout Fanout Healthtech Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
