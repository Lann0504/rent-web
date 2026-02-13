import { Hono } from "hono"
import { z } from "zod"
import { all, get, run } from "../db"

const records = new Hono()

const UpsertRecordSchema = z.object({
  tenantId: z.number().int().positive(),
  year: z.number().int().min(1970).max(3000),
  month: z.number().int().min(1).max(12),

  electricity: z.number().nonnegative(),
  water: z.number().nonnegative(),

  electricityFee: z.number(),
  waterFee: z.number(),
  total: z.number(),
})

records.get("/", async (c) => {
  const tenantIdStr = c.req.query("tenantId")
  const yearStr = c.req.query("year")
  const monthStr = c.req.query("month")

  const tenantId = tenantIdStr ? Number(tenantIdStr) : undefined
  const year = yearStr ? Number(yearStr) : undefined
  const month = monthStr ? Number(monthStr) : undefined

  const where: string[] = []
  const params: any[] = []

  if (tenantId !== undefined) {
    if (!Number.isFinite(tenantId)) return c.json({ message: "Invalid tenantId" }, 400)
    where.push("r.tenant_id=?")
    params.push(tenantId)
  }
  if (year !== undefined) {
    if (!Number.isFinite(year)) return c.json({ message: "Invalid year" }, 400)
    where.push("r.year=?")
    params.push(year)
  }
  if (month !== undefined) {
    if (!Number.isFinite(month)) return c.json({ message: "Invalid month" }, 400)
    where.push("r.month=?")
    params.push(month)
  }

  const sql = `
    SELECT
      r.id,
      r.tenant_id as "tenantId",
      t.room as room,
      t.name as name,
      t.rent::float8 as rent,
      t.electricity_rate::float8 as "electricityRate",
      t.water_rate::float8 as "waterRate",
      r.year, r.month,
      r.electricity, r.water,
      r.electricity_fee::float8 as "electricityFee",
      r.water_fee::float8 as "waterFee",
      r.total::float8 as total,
      r.created_at as "createdAt",
      r.updated_at as "updatedAt"
    FROM records r
    JOIN tenants t ON t.id = r.tenant_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY r.year DESC, r.month DESC, CAST(t.room as INTEGER) ASC, t.room ASC
  `

  const rows = await all(sql, params)
  return c.json(rows)
})

records.get("/recent", async (c) => {
  const limitStr = c.req.query("limit") ?? "5"
  const limit = Math.max(1, Math.min(50, Number(limitStr) || 5))

  const rows = await all(
    `
      SELECT
        r.id,
        r.tenant_id as "tenantId",
        t.room as room,
        t.name as name,
        r.year, r.month,
        r.total::float8 as total,
        r.updated_at as "updatedAt"
      FROM records r
      JOIN tenants t ON t.id = r.tenant_id
      ORDER BY r.updated_at DESC
      LIMIT ?
    `,
    [limit]
  )

  return c.json(rows)
})

records.get("/previous", async (c) => {
  const tenantId = Number(c.req.query("tenantId"))
  const year = Number(c.req.query("year"))
  const month = Number(c.req.query("month"))

  if (![tenantId, year, month].every(Number.isFinite)) {
    return c.json({ message: "tenantId/year/month required" }, 400)
  }

  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth === 0) {
    prevMonth = 12
    prevYear = year - 1
  }

  const row = await get(
    `
      SELECT
        r.id,
        r.tenant_id as "tenantId",
        r.year, r.month,
        r.electricity, r.water,
        r.electricity_fee::float8 as "electricityFee",
        r.water_fee::float8 as "waterFee",
        r.total::float8 as total,
        r.updated_at as "updatedAt"
      FROM records r
      WHERE r.tenant_id=? AND r.year=? AND r.month=?
    `,
    [tenantId, prevYear, prevMonth]
  )

  return c.json(row ?? null)
})

records.put("/", async (c) => {
  const body = UpsertRecordSchema.parse(await c.req.json())

  // ✅ 让 DB 自己写 now()，不依赖客户端时间
  await run(
    `
    INSERT INTO records
      (tenant_id, year, month, electricity, water, electricity_fee, water_fee, total, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, now(), now())
    ON CONFLICT(tenant_id, year, month) DO UPDATE SET
      electricity=excluded.electricity,
      water=excluded.water,
      electricity_fee=excluded.electricity_fee,
      water_fee=excluded.water_fee,
      total=excluded.total,
      updated_at=now()
    `,
    [
      body.tenantId,
      body.year,
      body.month,
      body.electricity,
      body.water,
      body.electricityFee,
      body.waterFee,
      body.total,
    ]
  )

  return c.json({ ok: true })
})

export default records
