import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const role = (session.user as any)?.role;
  const userId = (session as any)?.userId;

  const url = new URL(req.url);
  const showAllHistory = url.searchParams.get('allHistory') === 'true';

  let dateFilter = {};
  if (!showAllHistory) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    dateFilter = {
      OR: [
        { isEntered: false }, // Always fetch active (unentered) orders
        { createdAt: { gte: thirtyDaysAgo } } // Fetch entered orders up to 30 days ago
      ]
    };
  }

  const whereClause: any = role === 'customer' ? { userId, ...dateFilter } : { ...dateFilter };
  
  const orders = await prisma.order.findMany({
    where: whereClause,
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
  
  // Validate cart number uniqueness per customer on delivery date
  if (cartNumber && cartNumber.trim() !== '' && deliveryDate) {
    const targetDate = new Date(deliveryDate);
    const existingCartOrder = await prisma.order.findFirst({
      where: {
        cartNumber: cartNumber.trim(),
        deliveryDate: targetDate,
      }
    });

    if (existingCartOrder && existingCartOrder.customerName !== customerName) {
      return NextResponse.json({ 
        error: `עגלה מספר ${cartNumber} כבר משויכת ללקוח "${existingCartOrder.customerName}" בתאריך זה` 
      }, { status: 400 });
    }
  }

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
  const userId = (session as any)?.userId;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const itemId = url.searchParams.get('itemId');
  
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Cancel/delete orders is restricted to admin and agent roles only
  if (!['admin', 'agent'].includes(role)) {
    return NextResponse.json({ error: 'רק מנהל או סוכן מורשים לבטל הזמנות.' }, { status: 403 });
  }

  if (order.isEntered) {
    return NextResponse.json({ error: 'לא ניתן למחוק הזמנה שכבר סומנה כ"הוקלדה".' }, { status: 400 });
  }

  const operations: any[] = [];

  if (itemId) {
    // Cancel specific line item
    const itemToDelete = order.items.find(i => i.id === itemId);
    if (!itemToDelete) return NextResponse.json({ error: 'Item not found in order' }, { status: 404 });

    const inv = await prisma.inventoryItem.findFirst({
      where: {
        itemCode: itemToDelete.itemCode,
        modelCode: itemToDelete.modelCode,
        quality: itemToDelete.quality,
        bloomPct: itemToDelete.bloomPct
      }
    });

    if (inv) {
      operations.push(prisma.inventoryItem.update({
        where: { id: inv.id },
        data: { quantity: { increment: itemToDelete.units } }
      }));
    }

    if (order.items.length === 1) {
      operations.push(prisma.order.delete({ where: { id } }));
    } else {
      operations.push(prisma.orderItem.delete({ where: { id: itemId } }));
    }
  } else {
    // Cancel entire order
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
  }

  await prisma.$transaction(operations);

  return NextResponse.json({ ok: true });
}
