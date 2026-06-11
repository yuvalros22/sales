import { NextResponse } from 'next/server';
import { seedDB } from '@/lib/seed';

export async function GET() {
  try {
    await seedDB();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
