import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import * as xlsx from 'xlsx';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const wb = xlsx.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    let currentAgent = null;
    const customers = [];

    for (const row of rows) {
      if (!row || !Array.isArray(row)) continue;

      // Group header identifying agent
      const col0 = String(row[0] || '').trim();
      if (
        col0 && 
        col0 !== 'undefined' &&
        !col0.includes('Total') && 
        !col0.includes('תחומי הדוח') && 
        !col0.includes('טווח') && 
        isNaN(Number(col0))
      ) {
        currentAgent = col0;
      }

      // Customer row
      const col1 = String(row[1] || '').trim(); // customerCode
      const col2 = String(row[2] || '').trim(); // customerName

      if (
        col1 && col1 !== 'Total' && col1 !== 'undefined' &&
        col2 && col2 !== 'Total' && col2 !== 'undefined' &&
        !col2.includes('תחומי הדוח')
      ) {
        // Validation for code
        if (/^\d+$/.test(col1) || col1.length > 2) {
          customers.push({
            customerCode: col1,
            customerName: col2,
            agentName: currentAgent
          });
        }
      }
    }

    if (customers.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו לקוחות תקינים בקובץ.' }, { status: 400 });
    }

    // Sync to DB (Optimized for remote DB)
    const existingCustomers = await prisma.customer.findMany();
    const existingMap = new Map(existingCustomers.map(c => [c.customerCode, c]));
    
    const incomingCodes = customers.map(c => c.customerCode);
    const toDelete = existingCustomers.filter(c => !incomingCodes.includes(c.customerCode)).map(c => c.customerCode);
    
    const toCreate = [];
    const toUpdate = [];

    for (const c of customers) {
      const ext = existingMap.get(c.customerCode);
      if (!ext) {
        toCreate.push({ customerCode: c.customerCode, customerName: c.customerName, agentName: c.agentName });
      } else if (ext.customerName !== c.customerName || ext.agentName !== c.agentName) {
        toUpdate.push({ customerCode: c.customerCode, customerName: c.customerName, agentName: c.agentName });
      }
    }

    if (toDelete.length > 0) {
      await prisma.customer.deleteMany({ where: { customerCode: { in: toDelete } } });
    }

    if (toCreate.length > 0) {
      await prisma.customer.createMany({ data: toCreate, skipDuplicates: true });
    }

    for (let i = 0; i < toUpdate.length; i += 50) {
      const chunk = toUpdate.slice(i, i + 50);
      await Promise.all(chunk.map(c => 
        prisma.customer.update({
          where: { customerCode: c.customerCode },
          data: { customerName: c.customerName, agentName: c.agentName }
        })
      ));
    }

    return NextResponse.json({
      added: toCreate.length,
      updated: toUpdate.length,
      deleted: toDelete.length
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'שגיאה בעיבוד הקובץ: ' + error.message }, { status: 500 });
  }
}
