PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  electricity_rate REAL NOT NULL,
  water_rate REAL NOT NULL,
  rent INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,

  electricity REAL NOT NULL DEFAULT 0,
  water REAL NOT NULL DEFAULT 0,

  electricity_fee REAL NOT NULL DEFAULT 0,
  water_fee REAL NOT NULL DEFAULT 0,

  total REAL NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  UNIQUE(tenant_id, year, month),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
