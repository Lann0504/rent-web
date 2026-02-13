import { run } from "./db"

export async function migrate() {
  await run(`
    create table if not exists tenants (
      id serial primary key,
      room text not null,
      name text,
      electricity_rate numeric not null default 0,
      water_rate numeric not null default 0,
      rent numeric not null default 0,
      created_at timestamptz not null default now()
    )
  `)

  await run(`
    create table if not exists records (
      id serial primary key,
      tenant_id int not null references tenants(id) on delete cascade,
      year int not null,
      month int not null,
      electricity int not null default 0,
      water int not null default 0,
      electricity_fee numeric not null default 0,
      water_fee numeric not null default 0,
      total numeric not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(tenant_id, year, month)
    )
  `)
}
