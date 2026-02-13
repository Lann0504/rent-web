import fs from "node:fs"
import path from "node:path"
import initSqlJs from "sql.js"

const dataDir = path.join(process.cwd(), "data")
const dbFile = path.join(dataDir, "app.sqlite")

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}
ensureDir(dataDir)

let SQL: any | null = null
let db: any | null = null

let saveTimer: NodeJS.Timeout | null = null
function scheduleSave() {
  if (!db) return
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const binary = db!.export()
    fs.writeFileSync(dbFile, Buffer.from(binary))
  }, 120)
}

async function initDb() {
  if (db) return db

  SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
  })

  if (fs.existsSync(dbFile)) {
    const buf = fs.readFileSync(dbFile)
    db = new SQL.Database(new Uint8Array(buf))
  } else {
    db = new SQL.Database()
  }

  // 初始化 schema
  const schemaPath = path.join(process.cwd(), "src", "schema.sql")
  const schemaSql = fs.readFileSync(schemaPath, "utf-8")
  db.run(schemaSql)
  scheduleSave()

  return db
}

// 统一：写入
export async function run(sql: string, params: any[] = []) {
  const d = await initDb()
  d.run(sql, params)
  scheduleSave()
}

// 统一：查询多行
export async function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const d = await initDb()
  const stmt = d.prepare(sql)
  stmt.bind(params)

  const rows: T[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as T)

  stmt.free()
  return rows
}

// 统一：查询单行
export async function get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const d = await initDb()
  const stmt = d.prepare(sql)
  stmt.bind(params)

  const ok = stmt.step()
  const row = ok ? (stmt.getAsObject() as T) : null

  stmt.free()
  return row
}

// 可选：立即落盘（比如你想在 seed 后马上写）
export async function flush() {
  await initDb()
  if (!db) return
  const binary = db.export()
  fs.writeFileSync(dbFile, Buffer.from(binary))
}
