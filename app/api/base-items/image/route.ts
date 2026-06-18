import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { itemCode, imageUrl } = await req.json();

    if (!itemCode || !imageUrl) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const updatedItem = await prisma.baseItem.update({
      where: { itemCode },
      data: { imageUrl }
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Failed to update image:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
