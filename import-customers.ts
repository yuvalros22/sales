import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function importCustomers() {
  const filePath = '210626-cust_dstn_agent_210626.xls';
  console.log(`Reading ${filePath}...`);
  
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Skip header row
  const dataRows = rows.slice(1).filter(r => r && r[0]);
  console.log(`Found ${dataRows.length} customers in the excel file.`);
  
  let imported = 0;
  
  for (const row of dataRows) {
    try {
      const code = String(row[0]).trim();
      const name = String(row[1]).trim();
      let agentName = String(row[3]).trim();
      if (agentName === 'undefined' || agentName === 'null') agentName = '';
      const isActiveRaw = String(row[4]).trim();
      const isActive = isActiveRaw === 'כ';

      await prisma.customer.upsert({
        where: { customerCode: code },
        update: {
          customerName: name,
          agentName: agentName || null,
          isActive: isActive
        },
        create: {
          customerCode: code,
          customerName: name,
          agentName: agentName || null,
          isActive: isActive
        }
      });
      imported++;
      if (imported % 100 === 0) {
        console.log(`Imported ${imported} customers...`);
      }
    } catch (e: any) {
      console.error(`Failed to import row: ${row}`, e.message);
    }
  }
  
  console.log(`Import completed. Successfully imported ${imported} customers.`);
}

importCustomers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
