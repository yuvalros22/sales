import * as XLSX from 'xlsx';
import prisma from './lib/db';

async function main() {
  const wb = XLSX.readFile('packages.xls');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  let count = 0;
  for (const row of data as any[]) {
    const itemCode = String(row['קוד פריט'] || '').trim();
    const itemName = String(row['שם פריט'] || '').trim();
    const packageSizeStr = String(row['כמות באריזה'] || '').trim();
    const packageSize = parseInt(packageSizeStr, 10);
    
    if (!itemCode || !itemName || isNaN(packageSize)) {
      continue;
    }
    
    await prisma.baseItem.upsert({
      where: { itemCode },
      update: { itemName, packageSize },
      create: { itemCode, itemName, packageSize }
    });
    count++;
  }
  
  console.log(`Successfully imported ${count} base items.`);
}

main().catch(console.error);
