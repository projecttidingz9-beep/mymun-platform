import { NextRequest } from "next/server";
import { getRequestActor } from "@/lib/server/auth";

/**
 * SSE stub — streams a heartbeat until client disconnects.
 * Replace with database-backed events / Redis pubsub as traffic grows.
 */
export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`));
      };
      send();
      const interval = setInterval(send, 30000);
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
