import { createClient } from '@libsql/client';

let db: ReturnType<typeof createClient>;

function getDB() {
  if (!db) {
    db = createClient({ url: 'file:./inventory.db' });
  }
  return db;
}

export async function initDB() {
  const db = getDB();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      model_code TEXT NOT NULL,
      model_name TEXT NOT NULL,
      quality TEXT NOT NULL,
      bloom_pct TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      package_size INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(item_code, model_code, quality, bloom_pct)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      customer_name TEXT,
      cart_number TEXT,
      order_number TEXT,
      line_number TEXT,
      prod_order_number TEXT,
      prod_line_number TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      model_code TEXT NOT NULL,
      model_name TEXT NOT NULL,
      quality TEXT NOT NULL,
      bloom_pct TEXT NOT NULL,
      packages INTEGER NOT NULL,
      units INTEGER NOT NULL,
      package_size INTEGER NOT NULL
    );
  `);
}

export default getDB;
