import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(promotions);
  } catch (error) {
    console.error('Failed to fetch promotions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'admin' && role !== 'agent')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const promotionsData = await req.json(); // Array of { itemCode, itemName, price }
    if (!Array.isArray(promotionsData)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Use transaction to delete and recreate promotions
    await prisma.$transaction([
      prisma.promotion.deleteMany(),
      prisma.promotion.createMany({
        data: promotionsData.map((promo: any) => ({
          itemCode: String(promo.itemCode),
          itemName: String(promo.itemName),
          price: parseFloat(promo.price) || 0,
        }))
      })
    ]);

    const updatedPromotions = await prisma.promotion.findMany({
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(updatedPromotions);
  } catch (error) {
    console.error('Failed to save promotions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
