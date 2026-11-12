import { createFileRoute } from "@tanstack/react-router";
import { countVisit, readVisits } from "@/server/visit-base";

function visitsJson(total: number): Response {
  return new Response(JSON.stringify({ total }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/visits")({
  server: {
    handlers: {
      GET: () => visitsJson(readVisits()),
      POST: () => visitsJson(countVisit()),
    },
  },
});
