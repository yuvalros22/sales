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
  const { customerName, customerCode, agentName, cartNumber, orderNumber, lineNumber, prodOrderNumber, prodLineNumber, items, deliveryDate, notes } = await req.json();
  
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

  // Fetch all active reservations for the items in the order
  const activeReservations = await prisma.cartReservation.findMany({
    where: {
      inventoryItemId: { in: inventoryItems.map(i => i.id) },
      userId: { not: userId },
      expiresAt: { gt: new Date() }
    }
  });

  const reservedByOthersMap = new Map<string, number>();
  for (const res of activeReservations) {
    const current = reservedByOthersMap.get(res.inventoryItemId) || 0;
    reservedByOthersMap.set(res.inventoryItemId, current + res.units);
  }

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
    
    const reservedByOthers = reservedByOthersMap.get(inv.id) || 0;
    const availableUnits = inv.quantity - reservedByOthers;
    const requestedUnits = item.packages * item.packageSize;

    if (availableUnits < requestedUnits) {
      const availablePackages = Math.floor(availableUnits / item.packageSize);
      return NextResponse.json({ 
        error: `אין מספיק מלאי פנוי עבור ${item.itemName}. זמין: ${availablePackages} אריזות, נדרש: ${item.packages} אריזות` 
      }, { status: 400 });
    }
  }

  // Execute order creation and all inventory deductions in a SINGLE transaction
  const operations: any[] = [];

  operations.push(prisma.order.create({
    data: {
      userId,
      customerName: customerName || null,
      customerCode: customerCode || null,
      agentName: agentName || null,
      cartNumber: cartNumber || null,
      orderNumber: orderNumber || null,
      lineNumber: lineNumber || null,
      prodOrderNumber: prodOrderNumber || null,
      prodLineNumber: prodLineNumber || null,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      notes: notes || null,
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
      data: { quantity: { decrement: item.packages * item.packageSize } }
    }));
  }

  // Clear all reservations for this user since they checked out
  operations.push(prisma.cartReservation.deleteMany({
    where: { userId }
  }));

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

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const role = (session.user as any)?.role;
  if (!['admin', 'agent'].includes(role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (order.isEntered) {
    return NextResponse.json({ error: 'לא ניתן למחוק הזמנה שכבר סומנה כ"הוקלדה".' }, { status: 400 });
  }

  const operations: any[] = [];

  // Restore inventory
  for (const item of order.items) {
    const inv = await prisma.inventoryItem.findFirst({
      where: {
        itemCode: item.itemCode,
        modelCode: item.modelCode,
        quality: item.quality,
        bloomPct: item.bloomPct
      }
    });
    if (inv) {
      operations.push(prisma.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: { increment: item.units } }
      }));
    }
  }

  operations.push(prisma.order.delete({ where: { id } }));

  await prisma.$transaction(operations);

  return NextResponse.json({ ok: true });
}
