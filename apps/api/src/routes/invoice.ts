import { Hono } from "hono"
import { get } from "../db"

const invoice = new Hono()

invoice.get("/", async (c) => {
  const tenantId = Number(c.req.query("tenantId"))
  const year = Number(c.req.query("year"))
  const month = Number(c.req.query("month"))

  if (![tenantId, year, month].every(Number.isFinite)) {
    return c.json({ message: "tenantId/year/month required" }, 400)
  }

  const tenant = await get<any>(
    `SELECT id, room, name, electricity_rate as electricityRate, water_rate as waterRate, rent
     FROM tenants WHERE id=?`,
    [tenantId]
  )
  if (!tenant) return c.json({ message: "Tenant not found" }, 404)

  const record = await get<any>(
    `SELECT tenant_id as tenantId, year, month, electricity, water,
            electricity_fee as electricityFee, water_fee as waterFee, total
     FROM records
     WHERE tenant_id=? AND year=? AND month=?`,
    [tenantId, year, month]
  )

  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth === 0) {
    prevMonth = 12
    prevYear = year - 1
  }

  const previous = await get<any>(
    `SELECT tenant_id as tenantId, year, month, electricity, water
     FROM records
     WHERE tenant_id=? AND year=? AND month=?`,
    [tenantId, prevYear, prevMonth]
  )

  const prevEle = Number(previous?.electricity ?? 0)
  const prevWat = Number(previous?.water ?? 0)
  const curEle = Number(record?.electricity ?? 0)
  const curWat = Number(record?.water ?? 0)

  const electricityUsage = Math.max(0, curEle - prevEle)
  const waterUsage = Math.max(0, curWat - prevWat)

  return c.json({
    tenant,
    record: record ?? null,
    previous: previous ?? null,
    usage: { electricity: electricityUsage, water: waterUsage },
  })
})

export default invoice
