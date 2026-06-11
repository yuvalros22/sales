import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import getDB from '@/lib/db';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDB();
  const result = await db.execute('SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC');
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { username, password, name, role } = await req.json();
  const db = getDB();
  const hashed = await bcrypt.hash(password, 10);
  
  try {
    await db.execute({
      sql: 'INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)',
      args: [randomUUID(), username, hashed, name, role]
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
  const db = getDB();
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
  return NextResponse.json({ ok: true });
}
