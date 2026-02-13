import { Hono } from "hono"
import { get } from "../db"

const invoice = new Hono()

function prevYM(year: number, month: number) {
  let y = year
  let m = month - 1
  if (m === 0) {
    m = 12
    y -= 1
  }
  return { year: y, month: m }
}

invoice.get("/", async (c) => {
  const tenantId = Number(c.req.query("tenantId"))
  const year = Number(c.req.query("year"))
  const month = Number(c.req.query("month"))

  if (![tenantId, year, month].every(Number.isFinite)) {
    return c.json({ message: "tenantId/year/month required" }, 400)
  }

  // 1) tenant（把 numeric 全 cast 成 float8）
  const tenant = await get<any>(
    `
      SELECT
        id,
        room,
        name,
        electricity_rate::float8 as "electricityRate",
        water_rate::float8 as "waterRate",
        rent::float8 as rent,
        created_at as "createdAt"
      FROM tenants
      WHERE id=?
    `,
    [tenantId]
  )

  if (!tenant) return c.json({ message: "Tenant not found" }, 404)

  // 2) 当月记录（numeric cast）
  const record = await get<any>(
    `
      SELECT
        id,
        tenant_id as "tenantId",
        year,
        month,
        electricity,
        water,
        electricity_fee::float8 as "electricityFee",
        water_fee::float8 as "waterFee",
        total::float8 as total,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM records
      WHERE tenant_id=? AND year=? AND month=?
    `,
    [tenantId, year, month]
  )

  // 3) 上月记录（用于计算用量）
  const p = prevYM(year, month)
  const previous = await get<any>(
    `
      SELECT
        id,
        tenant_id as "tenantId",
        year,
        month,
        electricity,
        water,
        electricity_fee::float8 as "electricityFee",
        water_fee::float8 as "waterFee",
        total::float8 as total,
        updated_at as "updatedAt"
      FROM records
      WHERE tenant_id=? AND year=? AND month=?
    `,
    [tenantId, p.year, p.month]
  )

  // 4) 计算用量（如果当月无 record，就返回 0）
  const usage = {
    electricity: record
      ? Math.max(0, Number(record.electricity ?? 0) - Number(previous?.electricity ?? 0))
      : 0,
    water: record
      ? Math.max(0, Number(record.water ?? 0) - Number(previous?.water ?? 0))
      : 0,
  }

  return c.json({
    tenant,
    record: record ?? null,
    previous: previous ?? null,
    usage,
  })
})

export default invoice
