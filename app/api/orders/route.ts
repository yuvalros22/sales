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
  
  // Pre-fetch all relevant inventory items in ONE query
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: {
      OR: items.map((item: any) => ({
        itemCode: item.itemCode,
        modelCode: item.modelCode,
        quality: item.quality,
        bloomPct: item.bloomPct
      }))
    }
  });

  // Validate stock locally
  for (const item of items) {
    const inv = inventoryItems.find((i: any) => 
      i.itemCode === item.itemCode && 
      i.modelCode === item.modelCode && 
      i.quality === item.quality && 
      i.bloomPct === item.bloomPct
    );
    
    if (!inv) {
      return NextResponse.json({ error: `פריט ${item.itemName} לא נמצא במלאי` }, { status: 400 });
    }
    
    if (inv.quantity < item.packages) {
      return NextResponse.json({ 
        error: `אין מספיק מלאי עבור ${item.itemName}. זמין: ${inv.quantity} אריזות, נדרש: ${item.packages} אריזות` 
      }, { status: 400 });
    }
  }

  // Execute order creation and all inventory deductions in a SINGLE transaction
  const operations: any[] = [];

  operations.push(prisma.order.create({
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
  }));

  for (const item of items) {
    const inv = inventoryItems.find((i: any) => 
      i.itemCode === item.itemCode && 
      i.modelCode === item.modelCode && 
      i.quality === item.quality && 
      i.bloomPct === item.bloomPct
    );
    operations.push(prisma.inventoryItem.update({
      where: { id: inv!.id },
      data: { quantity: { decrement: item.packages } }
    }));
  }

  const results = await prisma.$transaction(operations);
  const newOrder = results[0];
  
  return NextResponse.json({ ok: true, orderId: newOrder.id });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const role = (session.user as any)?.role;
  if (!['admin', 'agent'].includes(role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, isEntered, cartNumber } = body;

  const dataToUpdate: any = {};
  if (isEntered !== undefined) dataToUpdate.isEntered = isEntered;
  if (cartNumber !== undefined) dataToUpdate.cartNumber = cartNumber;

  await prisma.order.update({
    where: { id },
    data: dataToUpdate
  });

  return NextResponse.json({ ok: true });
}
