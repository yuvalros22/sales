import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const config = await prisma.appConfig.findUnique({ where: { id: 'default' } });
  if (!config) {
    const newConfig = await prisma.appConfig.create({ data: { id: 'default', storeOpen: true } });
    return NextResponse.json(newConfig);
  }
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { storeOpen } = await req.json();
    const config = await prisma.appConfig.upsert({
      where: { id: 'default' },
      update: { storeOpen },
      create: { id: 'default', storeOpen }
    });
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to update config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
