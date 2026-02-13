import { Hono } from "hono"
import { cors } from "hono/cors"
import { serve } from "@hono/node-server"
import { migrate } from "./migrate"

import tenants from "./routes/tenants"
import records from "./routes/records"
import invoice from "./routes/invoice"
import { seedTenantsIfEmpty } from "./seed"

await migrate()
await seedTenantsIfEmpty()

const app = new Hono()

app.use(
  "*",
  cors({
    // 在 Docker + Nginx 反代后通常同域，不需要 CORS
    // 开发期允许全部更省事
    origin: "*",
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
)

app.get("/health", (c) => c.json({ ok: true }))

app.route("/api/tenants", tenants)
app.route("/api/records", records)
app.route("/api/invoice", invoice)

const port = Number(process.env.PORT ?? 3001)

serve({
  fetch: app.fetch,
  port,
  hostname: "0.0.0.0", // ✅ 局域网/Docker 必须
})

console.log(`API listening on http://0.0.0.0:${port}`)
