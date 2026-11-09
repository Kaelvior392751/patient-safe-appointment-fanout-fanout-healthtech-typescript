import { describe, expect, it, vi } from "vitest";
import { fanOutAppointment } from "../src/appointment_fanout.js";

describe("appointment fanout decision", () => {
  it("queues one operational message per consented unique subscriber", async () => {
    const publish = vi.fn().mockResolvedValue({});

    const result = await fanOutAppointment(
      {
        appointment_id: "apt_42",
        event: "rescheduled",
        starts_at: "2026-09-21T10:30:00+08:00",
        subscribers: [
          { subscriber_id: "caregiver", destination: "+1555010101", consented: true },
          { subscriber_id: "caregiver", destination: "+1555010101", consented: true },
          { subscriber_id: "transport", destination: "dispatch@example.test", consented: false },
        ],
      },
      publish,
    );

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0]).toEqual({
      kind: "appointment_notification",
      appointment_id: "apt_42",
      event: "rescheduled",
      starts_at: "2026-09-21T10:30:00+08:00",
      subscriber_id: "caregiver",
      destination: "+1555010101",
    });
    expect(result).toEqual({
      appointment_id: "apt_42",
      queued: ["caregiver"],
      skipped: [
        { subscriber_id: "caregiver", reason: "duplicate" },
        { subscriber_id: "transport", reason: "no_consent" },
      ],
    });
  });
});
