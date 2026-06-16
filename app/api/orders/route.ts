import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const role = (session.user as any)?.role;
  const userId = (session as any)?.userId;
  
  const orders = await prisma.order.findMany({
    where: role === 'customer' ? { userId } : {},
    include: {
      user: {
        select: { name: true, username: true, role: true }
      },
      items: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json(orders.map(o => ({
    ...o,
    user_name: o.user.name,
    username: o.user.username,
    user_role: o.user.role
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const userId = (session as any)?.userId;
  const { customerName, cartNumber, orderNumber, lineNumber, prodOrderNumber, prodLineNumber, items, deliveryDate } = await req.json();
  
  // Validate stock
  for (const item of items) {
    const inv = await prisma.inventoryItem.findFirst({
      where: {
        itemCode: item.itemCode,
        modelCode: item.modelCode,
        quality: item.quality,
        bloomPct: item.bloomPct
      }
    });
    
    if (!inv) {
      return NextResponse.json({ error: `פריט ${item.itemName} לא נמצא במלאי` }, { status: 400 });
    }
    
    const needed = item.packages;
    
    if (inv.quantity < needed) {
      return NextResponse.json({ 
        error: `אין מספיק מלאי עבור ${item.itemName}. זמין: ${inv.quantity} אריזות, נדרש: ${needed} אריזות` 
      }, { status: 400 });
    }
  }
  
  // Create order
  const newOrder = await prisma.order.create({
    data: {
      userId,
      customerName: customerName || null,
      cartNumber: cartNumber || null,
      orderNumber: orderNumber || null,
      lineNumber: lineNumber || null,
      prodOrderNumber: prodOrderNumber || null,
      prodLineNumber: prodLineNumber || null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      items: {
        create: items.map((item: any) => ({
          itemCode: item.itemCode,
          itemName: item.itemName,
          modelCode: item.modelCode,
          modelName: item.modelName,
          quality: item.quality,
          bloomPct: item.bloomPct,
          packages: item.packages,
          units: item.packages * item.packageSize,
          packageSize: item.packageSize
        }))
      }
    }
  });
  
  // Deduct from inventory
  for (const item of items) {
    const inv = await prisma.inventoryItem.findFirst({
      where: {
        itemCode: item.itemCode,
        modelCode: item.modelCode,
        quality: item.quality,
        bloomPct: item.bloomPct
      }
    });

    if (inv) {
      await prisma.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: inv.quantity - item.packages }
      });
    }
  }
  
  return NextResponse.json({ ok: true, orderId: newOrder.id });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const role = (session.user as any)?.role;
  if (!['admin', 'agent'].includes(role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, isEntered } = await req.json();

  await prisma.order.update({
    where: { id },
    data: { isEntered }
  });

  return NextResponse.json({ ok: true });
}
