import { createServer } from "node:http";
import { ZodError } from "zod";
import { appointmentFanoutSchema, fanOutAppointment } from "./appointment_fanout.js";
import { InfraiError } from "./infrai_queue.js";

const port = Number(process.env.PORT ?? 3000);

class InvalidRequestBodyError extends Error {}

function readJson(request: NodeJS.ReadableStream): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body is too large"));
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new InvalidRequestBodyError("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");

  if (request.method !== "POST" || request.url !== "/appointments/fanout") {
    response.writeHead(404).end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const input = appointmentFanoutSchema.parse(await readJson(request));
    const result = await fanOutAppointment(input);
    response.writeHead(202).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof InvalidRequestBodyError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid_request" }));
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.writeHead(error.status).end(JSON.stringify({ error: error.code }));
      return;
    }
    console.error(error);
    response.writeHead(502).end(JSON.stringify({ error: "notification_queue_unavailable" }));
  }
});

server.listen(port, () => {
  console.log(`Appointment notification service listening on http://localhost:${port}`);
});
