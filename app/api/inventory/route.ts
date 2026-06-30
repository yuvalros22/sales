import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const inventory = await prisma.inventoryItem.findMany({
    orderBy: [{ itemName: 'asc' }, { modelName: 'asc' }]
  });
  
  const baseItems = await prisma.baseItem.findMany();
  const packageMap = new Map(baseItems.map(b => [b.itemCode, b.packageSize]));
  const imageMap = new Map(baseItems.map(b => [b.itemCode, b.imageUrl]));
  const potSizeMap = new Map(baseItems.map(b => [b.itemCode, b.potSize]));
  const categoryMap = new Map(baseItems.map(b => [b.itemCode, b.category]));
  
  const result = inventory.map(item => ({
    ...item,
    packageSize: packageMap.get(item.itemCode) || 1,
    imageUrl: imageMap.get(item.itemCode) || null,
    potSize: potSizeMap.get(item.itemCode) || null,
    category: categoryMap.get(item.itemCode) || null
  }));
  
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

    for (const po of pendingOrderItems) {
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: {
          itemCode: po.itemCode,
          modelCode: po.modelCode,
          quality: po.quality,
          bloomPct: po.bloomPct
        }
      });

      if (inventoryItem) {
        await prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: inventoryItem.quantity - po.units
          }
        });
      }
    }

    return NextResponse.json({ ok: true, count: items.length });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'שגיאה בעדכון מלאי' }, { status: 500 });
  }
}
