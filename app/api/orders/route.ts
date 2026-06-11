import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDB from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const db = getDB();
  const role = (session.user as any)?.role;
  const userId = (session as any)?.userId;
  
  let sql = `
    SELECT o.*, u.name as user_name, u.username, u.role as user_role
    FROM orders o 
    JOIN users u ON o.user_id = u.id
  `;
  let args: any[] = [];
  
  if (role === 'customer') {
    sql += ' WHERE o.user_id = ?';
    args = [userId];
  }
  
  sql += ' ORDER BY o.created_at DESC';
  const orders = await db.execute({ sql, args });
  
  const ordersWithItems = await Promise.all(
    orders.rows.map(async (order: any) => {
      const items = await db.execute({
        sql: 'SELECT * FROM order_items WHERE order_id = ?',
        args: [order.id]
      });
      return { ...order, items: items.rows };
    })
  );
  
  return NextResponse.json(ordersWithItems);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const db = getDB();
  const userId = (session as any)?.userId;
  const { customerName, cartNumber, orderNumber, lineNumber, prodOrderNumber, prodLineNumber, items } = await req.json();
  
  // Validate stock for all items atomically
  for (const item of items) {
    const stock = await db.execute({
      sql: 'SELECT quantity, package_size FROM inventory WHERE item_code=? AND model_code=? AND quality=? AND bloom_pct=?',
      args: [item.itemCode, item.modelCode, item.quality, item.bloomPct]
    });
    
    if (stock.rows.length === 0) {
      return NextResponse.json({ error: `פריט ${item.itemName} לא נמצא במלאי` }, { status: 400 });
    }
    
    const inv = stock.rows[0] as any;
    const needed = item.packages * item.packageSize;
    
    if (inv.quantity < needed) {
      return NextResponse.json({ 
        error: `אין מספיק מלאי עבור ${item.itemName}. זמין: ${inv.quantity} יחידות, נדרש: ${needed} יחידות` 
      }, { status: 400 });
    }
  }
  
  // All checks passed - create order
  const orderId = randomUUID();
  
  await db.execute({
    sql: `INSERT INTO orders (id, user_id, customer_name, cart_number, order_number, line_number, prod_order_number, prod_line_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [orderId, userId, customerName || null, cartNumber || null, orderNumber || null, lineNumber || null, prodOrderNumber || null, prodLineNumber || null]
  });
  
  for (const item of items) {
    const units = item.packages * item.packageSize;
    await db.execute({
      sql: `INSERT INTO order_items (id, order_id, item_code, item_name, model_code, model_name, quality, bloom_pct, packages, units, package_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), orderId, item.itemCode, item.itemName, item.modelCode, item.modelName, item.quality, item.bloomPct, item.packages, units, item.packageSize]
    });
    
    // Deduct from inventory
    await db.execute({
      sql: 'UPDATE inventory SET quantity = quantity - ? WHERE item_code=? AND model_code=? AND quality=? AND bloom_pct=?',
      args: [units, item.itemCode, item.modelCode, item.quality, item.bloomPct]
    });
  }
  
  return NextResponse.json({ ok: true, orderId });
}
