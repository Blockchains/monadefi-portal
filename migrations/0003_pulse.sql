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
);

create index if not exists pulse_events_ts_idx on pulse_events (ts desc);
create index if not exists pulse_events_kind_ts_idx on pulse_events (kind, ts desc);
