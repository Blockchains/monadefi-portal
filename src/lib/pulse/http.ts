import { emptyPulse, type PulseSnapshot } from "@/lib/pulse/shape";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  "cache-control": "no-store",
};

export function pulseOptions(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function pulseJson(body: PulseSnapshot, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

function pulseEmpty(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export async function pulseGet(): Promise<Response> {
  try {
    const { readPulse } = await import("@/lib/pulse/store.server");
    return pulseJson(await readPulse());
  } catch (error) {
    console.error("[pulse] read failed", error);
    return pulseJson(emptyPulse());
  }
}

export async function pulsePost(request: Request): Promise<Response> {
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(length) && length > 8_000) return pulseEmpty();
    const text = await request.text();
    if (!text || text.length > 8_000) return pulseEmpty();
    const body = JSON.parse(text) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return pulseEmpty();
    const { recordHit } = await import("@/lib/pulse/store.server");
    await recordHit(body as Record<string, unknown>);
  } catch (error) {
    console.error("[pulse] ingest failed", error);
  }
  return pulseEmpty();
}
