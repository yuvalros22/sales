import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { username, password, name, role } = await req.json();
  const hashed = await bcrypt.hash(password, 10);
  
  try {
    await prisma.user.create({
      data: { username, password: hashed, name, role }
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'שם משתמש כבר קיים' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { id, username, password, name, role } = await req.json();
  const updateData: any = { username, name, role };
  
  if (password && password.trim() !== '') {
    updateData.password = await bcrypt.hash(password, 10);
  }
  
  try {
    await prisma.user.update({
      where: { id },
      data: updateData
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'שם משתמש כבר קיים' }, { status: 400 });
  }
}
