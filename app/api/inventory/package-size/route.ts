import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDB from '@/lib/db';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { itemCode, modelCode, quality, bloomPct, packageSize } = await req.json();
  const db = getDB();
  
  await db.execute({
    sql: `UPDATE inventory SET package_size = ? 
          WHERE item_code = ? AND model_code = ? AND quality = ? AND bloom_pct = ?`,
    args: [packageSize, itemCode, modelCode, quality, bloomPct]
  });
  
  return NextResponse.json({ ok: true });
}
