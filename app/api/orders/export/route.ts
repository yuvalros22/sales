import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || !['admin','agent'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const orders = await prisma.order.findMany({
    include: { user: true, items: true },
    orderBy: { createdAt: 'desc' }
  });
  
  const rows: any[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      rows.push({
        'תאריך הזמנה': order.createdAt.toISOString().split('T')[0],
        'סוכן': order.user.name,
        'לקוח': order.customerName || '',
        'תאריך יעד לקבלה': order.deliveryDate ? order.deliveryDate.toISOString().split('T')[0] : '',
        'הוקלד למעלה': order.isEntered ? 'כן' : 'לא',
        'מספר עגלה': order.cartNumber || '',
        'מספר הזמנה': order.orderNumber || '',
        'מספר שורה': order.lineNumber || '',
        'הזמנת יצור': order.prodOrderNumber || '',
        'שורת יצור': order.prodLineNumber || '',
        'קוד פריט': item.itemCode,
        'שם פריט': item.itemName,
        'קוד דגם': item.modelCode,
        'שם דגם': item.modelName,
        'איכות': item.quality,
        'פריחה': item.bloomPct,
        'כמות אריזות': item.packages,
        'כמות יחידות': item.units,
        'גודל אריזה': item.packageSize,
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
