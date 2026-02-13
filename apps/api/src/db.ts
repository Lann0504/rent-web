import postgres from "postgres"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required, e.g. postgres://user:pass@host:5432/db")
}

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

/**
 * 兼容旧 sqlite 风格：把 `?` 转成 Postgres 的 $1/$2/...
 * 这样 routes 里现有 SQL 基本不用改
 */
function normalizePlaceholders(query: string) {
  let i = 0
  return query.replace(/\?/g, () => `$${++i}`)
}

export async function run(query: string, params: any[] = []) {
  const q = normalizePlaceholders(query)
  await sql.unsafe(q, params)
}

export async function all<T = any>(query: string, params: any[] = []): Promise<T[]> {
  const q = normalizePlaceholders(query)
  return (await sql.unsafe(q, params)) as unknown as T[]
}

export async function get<T = any>(query: string, params: any[] = []): Promise<T | null> {
  const rows = await all<T>(query, params)
  return rows[0] ?? null
}

// Postgres 不需要 flush
export async function flush() {
  return
}

// 可选：优雅退出
export async function close() {
  await sql.end({ timeout: 5 })
}
