import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { itemCode, packageSize, itemName } = await req.json();
  
  await prisma.baseItem.upsert({
    where: { itemCode },
    update: { packageSize },
    create: {
      itemCode,
      itemName: itemName || 'Unknown',
      packageSize
    }
  });
  
  return NextResponse.json({ ok: true });
}
