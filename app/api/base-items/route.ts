import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const items = await prisma.baseItem.findMany({
    orderBy: { itemName: 'asc' }
  });
  
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { itemCode, itemName, packageSize, potSize, category } = await req.json();
  const newItem = await prisma.baseItem.upsert({
    where: { itemCode },
    update: { itemName, packageSize: Number(packageSize), potSize, category },
    create: { itemCode, itemName, packageSize: Number(packageSize), potSize, category }
  });

  return NextResponse.json(newItem);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  await prisma.baseItem.delete({ where: { itemCode: code } });
  return NextResponse.json({ ok: true });
}
