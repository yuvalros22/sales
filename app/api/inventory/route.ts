import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDB from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const db = getDB();
  const result = await db.execute('SELECT * FROM inventory ORDER BY item_name, model_name');
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || !['admin','agent'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { items } = await req.json();
  const db = getDB();
  
  // Clear existing inventory and replace
  await db.execute('DELETE FROM inventory');
  
  for (const item of items) {
    const { randomUUID } = await import('crypto');
    await db.execute({
      sql: `INSERT OR REPLACE INTO inventory 
        (id, item_code, item_name, model_code, model_name, quality, bloom_pct, quantity, package_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        item.itemCode, item.itemName, item.modelCode, item.modelName,
        item.quality, item.bloomPct, item.quantity, item.packageSize || 1
      ]
    });
  }
  
  return NextResponse.json({ ok: true, count: items.length });
}
