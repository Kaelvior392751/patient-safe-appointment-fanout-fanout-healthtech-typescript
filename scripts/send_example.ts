import { appointmentFanoutSchema, fanOutAppointment } from "../src/appointment_fanout.js";

const destination = process.env.EXAMPLE_RECIPIENT;
if (!destination) throw new Error("EXAMPLE_RECIPIENT is required");

const input = appointmentFanoutSchema.parse({
  appointment_id: "apt_2026_09_18_1030",
  event: "rescheduled",
  starts_at: "2026-09-21T10:30:00+08:00",
  subscribers: [
    { subscriber_id: "caregiver_17", destination, consented: true }
  ]
});

console.log(JSON.stringify(await fanOutAppointment(input), null, 2));
