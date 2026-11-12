export type PulsePoint = { h: string; n: number };
export type PulseCount = { k: string; v: number };
export type PulseHit = { t: string; path: string; tz: string; device: string; ref: string };

export type PulseSnapshot = {
  generatedAt: string;
  liveNow: number;
  pageviews1h: number;
  pageviews24h: number;
  uniques24h: number;
  uniques1h: number;
  waitlist24h: number;
  waitlistAll: number;
  spark: PulsePoint[];
  topPaths: PulseCount[];
  topRefs: PulseCount[];
  devices: PulseCount[];
  zones: PulseCount[];
  langs: PulseCount[];
  feed: PulseHit[];
};

export function hourLabel(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:00`;
}

/** 24 UTC hour buckets, oldest first, ending on the current hour. */
export function emptySpark(now = new Date()): PulsePoint[] {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
  start.setUTCHours(start.getUTCHours() - 23);
  const out: PulsePoint[] = [];
  for (let i = 0; i < 24; i += 1) {
    out.push({ h: hourLabel(new Date(start.getTime() + i * 3_600_000)), n: 0 });
  }
  return out;
}

export function emptyPulse(now = new Date()): PulseSnapshot {
  return {
    generatedAt: now.toISOString(),
    liveNow: 0,
    pageviews1h: 0,
    pageviews24h: 0,
    uniques24h: 0,
    uniques1h: 0,
    waitlist24h: 0,
    waitlistAll: 0,
    spark: emptySpark(now),
    topPaths: [],
    topRefs: [],
    devices: [],
    zones: [],
    langs: [],
    feed: [],
  };
}
