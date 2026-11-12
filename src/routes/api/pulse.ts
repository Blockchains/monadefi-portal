import { createFileRoute } from "@tanstack/react-router";
import { pulseGet, pulseOptions, pulsePost } from "@/lib/pulse/http";

export const Route = createFileRoute("/api/pulse")({
  server: {
    handlers: {
      GET: () => pulseGet(),
      POST: ({ request }) => pulsePost(request),
      OPTIONS: () => pulseOptions(),
    },
  },
});
