import { get, run, flush } from "./db"

export async function seedTenantsIfEmpty() {
  const row = await get<{ c: number }>("SELECT COUNT(1) as c FROM tenants")
  if ((row?.c ?? 0) > 0) return

  const now = new Date().toISOString()

  const seeds: Array<{
    room: string
    name: string
    electricity_rate: number
    water_rate: number
    rent: number
  }> = [
    { room: "102", name: "102", electricity_rate: 1, water_rate: 4.5, rent: 800 },
    { room: "201", name: "201", electricity_rate: 1, water_rate: 4.5, rent: 620 },
    { room: "202", name: "202", electricity_rate: 1, water_rate: 4.5, rent: 520 },
    { room: "203", name: "203", electricity_rate: 1, water_rate: 4.5, rent: 520 },
    { room: "204", name: "204", electricity_rate: 1, water_rate: 4.5, rent: 620 },
    { room: "301", name: "301", electricity_rate: 1, water_rate: 4.5, rent: 620 },
    { room: "302", name: "302", electricity_rate: 1, water_rate: 4.5, rent: 520 },
    { room: "303", name: "303", electricity_rate: 1, water_rate: 4.5, rent: 520 },
    { room: "304", name: "304", electricity_rate: 1, water_rate: 4.5, rent: 620 },
    { room: "401", name: "401", electricity_rate: 1, water_rate: 4.5, rent: 620 },
    { room: "402", name: "402", electricity_rate: 1, water_rate: 4.5, rent: 520 },
  ]

  for (const t of seeds) {
    await run(
      `INSERT INTO tenants (room, name, electricity_rate, water_rate, rent, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [t.room, t.name ?? "", t.electricity_rate, t.water_rate, t.rent, now]
    )
  }

  await flush()
}
