import { Hono } from "hono"
import { cors } from "hono/cors"
import { serve } from "@hono/node-server"

import tenants from "./routes/tenants"
import records from "./routes/records"
import invoice from "./routes/invoice"
import { seedTenantsIfEmpty } from "./seed"

await seedTenantsIfEmpty()

const app = new Hono()

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173"],
    allowHeaders: ["Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
)

app.get("/health", (c) => c.json({ ok: true }))

app.route("/api/tenants", tenants)
app.route("/api/records", records)
app.route("/api/invoice", invoice)

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port })
console.log(`API listening on http://localhost:${port}`)
