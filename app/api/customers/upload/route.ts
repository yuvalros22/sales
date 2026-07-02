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

    // Sync to DB
    const result = await prisma.$transaction(async (tx) => {
      const incomingCodes = customers.map(c => c.customerCode);
      
      const { count: deleted } = await tx.customer.deleteMany({
        where: {
          customerCode: { notIn: incomingCodes }
        }
      });

      let processed = 0;

      for (const c of customers) {
        await tx.customer.upsert({
          where: { customerCode: c.customerCode },
          update: { customerName: c.customerName, agentName: c.agentName },
          create: { customerCode: c.customerCode, customerName: c.customerName, agentName: c.agentName }
        });
        processed++;
      }

      return { processed, deleted };
    }, {
      maxWait: 10000,
      timeout: 60000
    });

    return NextResponse.json({
      added: result.processed,
      updated: result.processed,
      deleted: result.deleted
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'שגיאה בעיבוד הקובץ: ' + error.message }, { status: 500 });
  }
}
