import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDB from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || !['admin','agent'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const db = getDB();
  const orders = await db.execute(`
    SELECT o.*, u.name as agent_name, u.username
    FROM orders o JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `);
  
  const rows: any[] = [];
  for (const order of orders.rows as any[]) {
    const items = await db.execute({ sql: 'SELECT * FROM order_items WHERE order_id = ?', args: [order.id] });
    for (const item of items.rows as any[]) {
      rows.push({
        'תאריך': order.created_at,
        'סוכן': order.agent_name,
        'לקוח': order.customer_name || '',
        'מספר עגלה': order.cart_number || '',
        'מספר הזמנה': order.order_number || '',
        'מספר שורה': order.line_number || '',
        'הזמנת יצור': order.prod_order_number || '',
        'שורת יצור': order.prod_line_number || '',
        'קוד פריט': item.item_code,
        'שם פריט': item.item_name,
        'קוד דגם': item.model_code,
        'שם דגם': item.model_name,
        'איכות': item.quality,
        'פריחה': item.bloom_pct,
        'כמות אריזות': item.packages,
        'כמות יחידות': item.units,
        'גודל אריזה': item.package_size,
      });
    }
  }
  
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'הזמנות');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="orders.xlsx"',
    }
  });
}
