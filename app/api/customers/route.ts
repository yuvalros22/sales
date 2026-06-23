import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { customerName: 'asc' }
  });
  
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { customerCode, customerName, agentName, isActive } = await req.json();
  const newCustomer = await prisma.customer.upsert({
    where: { customerCode },
    update: { customerName, agentName, isActive: isActive ?? true },
    create: { customerCode, customerName, agentName, isActive: isActive ?? true }
  });

  return NextResponse.json(newCustomer);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  await prisma.customer.delete({ where: { customerCode: code } });
  return NextResponse.json({ ok: true });
}
