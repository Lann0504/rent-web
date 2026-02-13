import { Hono } from "hono"
import { z } from "zod"
import { all, get, run } from "../db"

const tenants = new Hono()

const TenantCreateSchema = z.object({
  room: z.string().min(1),
  name: z.string().default(""),
  electricityRate: z.number().nonnegative(),
  waterRate: z.number().nonnegative(),
  rent: z.number().int().nonnegative(),
})

const TenantPatchSchema = z.object({
  room: z.string().min(1).optional(),
  name: z.string().optional(),
  electricityRate: z.number().nonnegative().optional(),
  waterRate: z.number().nonnegative().optional(),
  rent: z.number().int().nonnegative().optional(),
})

tenants.get("/", async (c) => {
  const rows = await all(
    `SELECT
       id,
       room,
       name,
       electricity_rate as electricityRate,
       water_rate as waterRate,
       rent,
       created_at as createdAt
     FROM tenants
     ORDER BY CAST(room as INTEGER) ASC, room ASC`
  )
  return c.json(rows)
})

tenants.post("/", async (c) => {
  const body = TenantCreateSchema.parse(await c.req.json())
  const now = new Date().toISOString()

  await run(
    `INSERT INTO tenants (room, name, electricity_rate, water_rate, rent, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [body.room, body.name ?? "", body.electricityRate, body.waterRate, body.rent, now]
  )

  // sql.js 没有 lastInsertRowid 的便捷返回：用查询拿一下
  const row = await get<{ id: number }>(
    `SELECT id FROM tenants WHERE room=?`,
    [body.room]
  )

  return c.json({ id: row?.id ?? null })
})

tenants.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ message: "Invalid id" }, 400)

  const patch = TenantPatchSchema.parse(await c.req.json())

  const cur = await get<any>(
    `SELECT id, room, name, electricity_rate as electricityRate, water_rate as waterRate, rent
     FROM tenants WHERE id=?`,
    [id]
  )
  if (!cur) return c.json({ message: "Tenant not found" }, 404)

  const next = {
    room: patch.room ?? cur.room,
    name: patch.name ?? cur.name,
    electricityRate: patch.electricityRate ?? cur.electricityRate,
    waterRate: patch.waterRate ?? cur.waterRate,
    rent: patch.rent ?? cur.rent,
  }

  await run(
    `UPDATE tenants
     SET room=?, name=?, electricity_rate=?, water_rate=?, rent=?
     WHERE id=?`,
    [next.room, next.name, next.electricityRate, next.waterRate, next.rent, id]
  )

  return c.json({ ok: true })
})

tenants.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"))
  if (!Number.isFinite(id)) return c.json({ message: "Invalid id" }, 400)

  const before = await get<{ c: number }>(
    `SELECT COUNT(1) as c FROM tenants WHERE id=?`,
    [id]
  )
  if ((before?.c ?? 0) === 0) return c.json({ message: "Tenant not found" }, 404)

  await run(`DELETE FROM tenants WHERE id=?`, [id])
  return c.json({ ok: true })
})

export default tenants
