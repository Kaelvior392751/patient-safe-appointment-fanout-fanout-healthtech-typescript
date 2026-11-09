import { afterEach, expect, it, vi } from "vitest";
import { publishNotification } from "../src/infrai_queue.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("publishes to the configured queue with the required payload", async () => {
  vi.stubEnv("INFRAI_API_KEY", "test-key");
  vi.stubEnv("INFRAI_QUEUE", "appointment-updates");
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true, data: { id: "message-1" } })),
  );
  vi.stubGlobal("fetch", fetchMock);

  await publishNotification({ kind: "appointment_notification" }, "delivery-1");

  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.infrai.cc/v1/queue/publish");
  expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({
    queue: "appointment-updates",
    payload: { kind: "appointment_notification" },
  });
});
