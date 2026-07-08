import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const userId = (session as any)?.userId;

  // Cleanup expired reservations
  await prisma.cartReservation.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });

  const inventory = await prisma.inventoryItem.findMany({
    orderBy: [{ itemName: 'asc' }, { modelName: 'asc' }]
  });
  
  // Fetch active reservations
  const activeReservations = await prisma.cartReservation.findMany();
  
  // Create a map of reserved units by others per inventory item
  const reservedByOthersMap = new Map<string, number>();
  for (const res of activeReservations) {
    if (res.userId !== userId) {
      const current = reservedByOthersMap.get(res.inventoryItemId) || 0;
      reservedByOthersMap.set(res.inventoryItemId, current + res.units);
    }
  }
  
  const baseItems = await prisma.baseItem.findMany();
  const packageMap = new Map(baseItems.map(b => [b.itemCode, b.packageSize]));
  const imageMap = new Map(baseItems.map(b => [b.itemCode, b.imageUrl]));
  const potSizeMap = new Map(baseItems.map(b => [b.itemCode, b.potSize]));
  const categoryMap = new Map(baseItems.map(b => [b.itemCode, b.category]));
  
  const result = inventory.map(item => {
    const reservedByOthers = reservedByOthersMap.get(item.id) || 0;
    return {
      ...item,
      quantity: Math.max(0, item.quantity - reservedByOthers),
      packageSize: packageMap.get(item.itemCode) || 1,
      imageUrl: imageMap.get(item.itemCode) || null,
      potSize: potSizeMap.get(item.itemCode) || null,
      category: categoryMap.get(item.itemCode) || null
    };
  });
  
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || !['admin','agent'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { items } = await req.json();
  
  try {
    // Clear all reservations since we are fully replacing inventory (IDs will change)
    await prisma.cartReservation.deleteMany();
    await prisma.inventoryItem.deleteMany();
    
    if (items.length > 0) {
      await prisma.inventoryItem.createMany({
        data: items.map((it: any) => ({
          itemCode: it.itemCode,
          itemName: it.itemName,
          modelCode: it.modelCode,
          modelName: it.modelName,
          quality: it.quality,
          bloomPct: it.bloomPct,
          quantity: it.quantity
        })),
        skipDuplicates: true
      });
    }

    const pendingOrderItems = await prisma.orderItem.findMany({
      where: {
        order: { isEntered: false }
      }
    });

    const allInventory = await prisma.inventoryItem.findMany();
    
    const deductions = new Map<string, number>();
    for (const po of pendingOrderItems) {
      const key = `${po.itemCode}-${po.modelCode}-${po.quality}-${po.bloomPct}`;
      deductions.set(key, (deductions.get(key) || 0) + po.units);
    }

    const updates = [];
    for (const item of allInventory) {
      const key = `${item.itemCode}-${item.modelCode}-${item.quality}-${item.bloomPct}`;
      const toDeduct = deductions.get(key);
      if (toDeduct && toDeduct > 0) {
        updates.push(prisma.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: item.quantity - toDeduct }
        }));
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    return NextResponse.json({ ok: true, count: items.length });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה בעדכון מלאי' }, { status: 500 });
  }
}
