import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";
import { emptyPulse, emptySpark, type PulseCount, type PulseHit, type PulseSnapshot } from "@/lib/pulse/shape";

export type HitInput = {
  path?: unknown;
  ref?: unknown;
  sid?: unknown;
  ua?: unknown;
  lang?: unknown;
  tz?: unknown;
  vw?: unknown;
  utm?: unknown;
  kind?: unknown;
};

const BOT =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|headless|lighthouse|wget|curl\/|python-requests|go-http-client|axios|bytespider|petalbot|semrush|ahrefs|bingpreview|yandex/i;

let schema: Promise<void> | null = null;
let lastPrune = 0;

function text(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, max);
}

export function isBotUa(ua: string): boolean {
  if (ua.length < 12) return true;
  return BOT.test(ua);
}

function cleanPath(raw: unknown): string {
  let value = text(raw, 240);
  if (!value) return "/";
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const url = new URL(value);
      value = `${url.pathname}${url.hash}`;
    }
  } catch {
    /* keep the raw path */
  }
  if (!value.startsWith("/")) value = `/${value}`;
  return value.slice(0, 180) || "/";
}

function cleanRef(raw: unknown): string {
  const value = text(raw, 300);
  if (!value) return "(direct)";
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host === "monadefi.com" || host.endsWith(".monadefi.com") || host.endsWith(".grok.me")) {
      return "(direct)";
    }
    return host.slice(0, 120);
  } catch {
    return value.slice(0, 120) || "(direct)";
  }
}

function cleanKind(raw: unknown): "view" | "beat" | "waitlist" | null {
  const kind = text(raw, 16);
  if (kind === "view" || kind === "beat" || kind === "waitlist") return kind;
  return null;
}

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function ensureSchema(): Promise<void> {
  schema ??= (async () => {
    const sql = await getSql();
    await sql`
      create table if not exists pulse_events (
        id bigserial primary key,
        ts timestamptz not null default now(),
        kind text not null,
        path text not null,
        ref text not null,
        sid_hash text not null,
        device text not null,
        lang text not null,
        tz text not null,
        vw integer,
        utm text not null default ''
      )
    `;
    await sql`create index if not exists pulse_events_ts_idx on pulse_events (ts desc)`;
    await sql`create index if not exists pulse_events_kind_ts_idx on pulse_events (kind, ts desc)`;
  })().catch((error) => {
    schema = null;
    throw error;
  });
  return schema;
}

function deviceOf(ua: string, vw: number | null): string {
  const lower = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(lower)) return "tablet";
  if (/mobi|iphone|android/.test(lower)) return "mobile";
  if (vw !== null && vw > 0 && vw < 768) return "mobile";
  return "desktop";
}

function hashSid(sid: string): string {
  return createHash("sha256").update(sid).digest("hex");
}

async function maybePrune(): Promise<void> {
  const now = Date.now();
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  const sql = await getSql();
  await sql`delete from pulse_events where kind <> 'waitlist' and ts < now() - interval '48 hours'`;
}

/** Store a hit. Bots and junk are dropped with no error. Raw sid is never stored. */
export async function recordHit(input: HitInput): Promise<void> {
  const ua = text(input.ua, 180);
  if (isBotUa(ua)) return;
  const kind = cleanKind(input.kind);
  const sid = text(input.sid, 80);
  if (!kind || sid.length < 8) return;
  const vwRaw = Number(input.vw);
  const vw = Number.isFinite(vwRaw) ? Math.max(0, Math.min(10_000, Math.round(vwRaw))) : null;
  await ensureSchema();
  const sql = await getSql();
  await sql`
    insert into pulse_events (kind, path, ref, sid_hash, device, lang, tz, vw, utm)
    values (
      ${kind},
      ${cleanPath(input.path)},
      ${cleanRef(input.ref)},
      ${hashSid(sid)},
      ${deviceOf(ua, vw)},
      ${text(input.lang, 32) || "und"},
      ${text(input.tz, 64) || "UTC"},
      ${vw},
      ${text(input.utm, 200)}
    )
  `;
  await maybePrune();
}

function counts(rows: Record<string, unknown>[]): PulseCount[] {
  return rows
    .map((row) => ({ k: String(row.k ?? ""), v: num(row.v) }))
    .filter((row) => row.k && row.v > 0)
    .slice(0, 8);
}

export async function readPulse(): Promise<PulseSnapshot> {
  await ensureSchema();
  const sql = await getSql();
  const now = new Date();
  const [totals, sparkRows, paths, refs, devices, zones, langs, feed] = await Promise.all([
    sql<{
      live_now: unknown;
      pageviews1h: unknown;
      pageviews24h: unknown;
      uniques1h: unknown;
      uniques24h: unknown;
      waitlist24h: unknown;
      waitlist_all: unknown;
    }>`
      select
        count(distinct sid_hash) filter (where ts >= now() - interval '70 seconds') as live_now,
        count(*) filter (where kind = 'view' and ts >= now() - interval '1 hour') as pageviews1h,
        count(*) filter (where kind = 'view' and ts >= now() - interval '24 hours') as pageviews24h,
        count(distinct sid_hash) filter (where kind = 'view' and ts >= now() - interval '1 hour') as uniques1h,
        count(distinct sid_hash) filter (where kind = 'view' and ts >= now() - interval '24 hours') as uniques24h,
        count(*) filter (where kind = 'waitlist' and ts >= now() - interval '24 hours') as waitlist24h,
        count(*) filter (where kind = 'waitlist') as waitlist_all
      from pulse_events
      where ts >= now() - interval '24 hours' or kind = 'waitlist'
    `,
    sql<{ h: unknown; n: unknown }>`
      select to_char(ts at time zone 'UTC', 'HH24:00') as h, count(*) as n
      from pulse_events
      where kind = 'view' and ts >= now() - interval '24 hours'
      group by 1
    `,
    sql`select path as k, count(*) as v from pulse_events where kind = 'view' and ts >= now() - interval '24 hours' group by path order by v desc limit 8`,
    sql`select ref as k, count(*) as v from pulse_events where kind = 'view' and ts >= now() - interval '24 hours' group by ref order by v desc limit 8`,
    sql`select device as k, count(*) as v from pulse_events where kind = 'view' and ts >= now() - interval '24 hours' group by device order by v desc limit 8`,
    sql`select tz as k, count(*) as v from pulse_events where kind = 'view' and ts >= now() - interval '24 hours' group by tz order by v desc limit 8`,
    sql`select lang as k, count(*) as v from pulse_events where kind = 'view' and ts >= now() - interval '24 hours' group by lang order by v desc limit 8`,
    sql<{ t: unknown; path: unknown; tz: unknown; device: unknown; ref: unknown }>`
      select ts as t, path, tz, device, ref
      from pulse_events
      where kind = 'view'
      order by ts desc
      limit 16
    `,
  ]);
  const row = totals[0];
  const spark = emptySpark(now);
  const byHour = new Map(sparkRows.map((item) => [String(item.h), num(item.n)]));
  for (const point of spark) point.n = byHour.get(point.h) ?? 0;
  const hits: PulseHit[] = feed.map((item) => ({
    t: asIso(item.t),
    path: String(item.path ?? "/"),
    tz: String(item.tz ?? "UTC"),
    device: String(item.device ?? "desktop"),
    ref: String(item.ref ?? "(direct)"),
  }));
  const base = emptyPulse(now);
  return {
    ...base,
    liveNow: num(row?.live_now),
    pageviews1h: num(row?.pageviews1h),
    pageviews24h: num(row?.pageviews24h),
    uniques1h: num(row?.uniques1h),
    uniques24h: num(row?.uniques24h),
    waitlist24h: num(row?.waitlist24h),
    waitlistAll: num(row?.waitlist_all),
    spark,
    topPaths: counts(paths),
    topRefs: counts(refs),
    devices: counts(devices),
    zones: counts(zones),
    langs: counts(langs),
    feed: hits,
  };
}
