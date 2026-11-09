import { createHash } from "node:crypto";
import { z } from "zod";
import { publishNotification } from "./infrai_queue.js";

export const appointmentFanoutSchema = z.object({
  appointment_id: z.string().min(1).max(120),
  event: z.enum(["scheduled", "rescheduled", "cancelled"]),
  starts_at: z.string().datetime({ offset: true }),
  subscribers: z.array(
    z.object({
      subscriber_id: z.string().min(1).max(120),
      destination: z.string().min(1).max(320),
      consented: z.boolean(),
    }),
  ).min(1).max(500),
});

export type AppointmentFanout = z.infer<typeof appointmentFanoutSchema>;

export type FanoutResult = {
  appointment_id: string;
  queued: string[];
  skipped: Array<{ subscriber_id: string; reason: "no_consent" | "duplicate" }>;
};

export type Publisher = (payload: unknown, idempotencyKey: string) => Promise<unknown>;

function deliveryKey(input: AppointmentFanout, subscriberId: string): string {
  return createHash("sha256")
    .update(`${input.appointment_id}:${input.event}:${subscriberId}`)
    .digest("hex");
}

export async function fanOutAppointment(
  input: AppointmentFanout,
  publish: Publisher = publishNotification,
): Promise<FanoutResult> {
  const queued: string[] = [];
  const skipped: FanoutResult["skipped"] = [];
  const seen = new Set<string>();

  for (const subscriber of input.subscribers) {
    if (seen.has(subscriber.subscriber_id)) {
      skipped.push({ subscriber_id: subscriber.subscriber_id, reason: "duplicate" });
      continue;
    }
    seen.add(subscriber.subscriber_id);

    if (!subscriber.consented) {
      skipped.push({ subscriber_id: subscriber.subscriber_id, reason: "no_consent" });
      continue;
    }

    await publish(
      {
        kind: "appointment_notification",
        appointment_id: input.appointment_id,
        event: input.event,
        starts_at: input.starts_at,
        subscriber_id: subscriber.subscriber_id,
        destination: subscriber.destination,
      },
      deliveryKey(input, subscriber.subscriber_id),
    );
    queued.push(subscriber.subscriber_id);
  }

  return { appointment_id: input.appointment_id, queued, skipped };
}
