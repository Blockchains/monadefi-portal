create table if not exists vaults (
  id text primary key,
  name text not null,
  address text not null,
  owner_address text not null,
  agent_address text not null,
  budget_wei text not null,
  cap_wei text not null,
  spent_wei text not null,
  balance_wei text not null,
  gas_wei text not null,
  paused boolean not null default false,
  services text not null,
  payees text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists used_requests (
  vault_id text not null references vaults (id),
  req_key text not null,
  primary key (vault_id, req_key)
);

create table if not exists simulations (
  id serial primary key,
  vault_id text not null references vaults (id),
  action text not null,
  label text not null,
  recipient text not null default '',
  amount_wei text not null,
  status text not null,
  code text,
  reason text not null,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists simulations_vault_idx on simulations (vault_id, id desc);

insert into vaults (
  id, name, address, owner_address, agent_address,
  budget_wei, cap_wei, spent_wei, balance_wei, gas_wei,
  paused, services, payees
) values (
  'showcase',
  'Showcase vault',
  '0x379e0C3Ecba46d62dAdCf26dBecd0F26A2cdCA97',
  '0xc0c4E411e41bECAD6DA860F67063C2D6363a6113',
  '0x3aa2aCE2a2dA4bE5FE4309cB175D394A63Fb5fCC',
  '200000000000000000',
  '50000000000000000',
  '162000000000000000',
  '250000000000000000',
  '120000000000000000',
  false,
  'pay,uniswap,pancake,kintsu,apriori,magma,wmon',
  ''
);

insert into used_requests (vault_id, req_key) values ('showcase', 'pp-replay');

insert into simulations (vault_id, action, label, recipient, amount_wei, status, code, reason, applied, created_at) values
  ('showcase', 'pay', 'Pay an approved address', '0xc0c4E411e41bECAD6DA860F67063C2D6363a6113', '10000000000000000', 'pass', null, 'Every rule holds. The vault would execute this call.', true, now() - interval '2 hours'),
  ('showcase', 'uniswap', 'Swap on Uniswap v3', '0x379e0C3Ecba46d62dAdCf26dBecd0F26A2cdCA97', '30000000000000000', 'pass', null, 'Every rule holds. The vault would execute this call.', true, now() - interval '90 minutes'),
  ('showcase', 'kintsu', 'Stake with Kintsu', '0x379e0C3Ecba46d62dAdCf26dBecd0F26A2cdCA97', '20000000000000000', 'pass', null, 'Every rule holds. The vault would execute this call.', true, now() - interval '70 minutes'),
  ('showcase', 'x-cap', 'Spend twice the cap', '0xc0c4E411e41bECAD6DA860F67063C2D6363a6113', '100000000000000000', 'fail', 'PerActionCapExceeded', 'This action is above the per-action cap. One call cannot quietly exceed the limit you set.', false, now() - interval '40 minutes'),
  ('showcase', 'x-stranger', 'Pay a stranger', '0x000000000000000000000000000000000000dEaD', '10000000000000000', 'fail', 'RecipientNotAllowed', 'That address is not an approved payee. Payments only go to people you listed.', false, now() - interval '28 minutes'),
  ('showcase', 'x-drain', 'Move USDC with transfer()', '0x000000000000000000000000000000000000dEaD', '0', 'fail', 'ForbiddenSelector', 'approve, transfer, and permit are forbidden. An agent cannot move tokens out of the vault.', false, now() - interval '16 minutes');
