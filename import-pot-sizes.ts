import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const filePath = '210626-planter size active parts.xls';
  console.log(`Reading ${filePath}...`);
  
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // header: 1 returns array of arrays (rows of columns)
  const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log(`Found ${rows.length} rows in the first sheet.`);
  
  // Create a fast lookup map from the Excel
  const excelMap = new Map<string, string>();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const itemCode = row[0]?.toString().trim();
    const potSizeRaw = row[3]?.toString().trim();
    if (itemCode && potSizeRaw) {
      excelMap.set(itemCode, potSizeRaw);
    }
  }
  
  console.log(`Loaded ${excelMap.size} valid items from Excel.`);
  
  // Fetch only items that need updating
  const itemsMissingPotSize = await prisma.baseItem.findMany({
    where: { 
      potSize: null 
    },
    select: { itemCode: true }
  });
  
  console.log(`Found ${itemsMissingPotSize.length} items in DB missing potSize.`);
  
  const updates = [];
  for (const item of itemsMissingPotSize) {
    if (excelMap.has(item.itemCode)) {
      updates.push({
        itemCode: item.itemCode,
        potSize: excelMap.get(item.itemCode)!
      });
    }
  }
  
  console.log(`Found ${updates.length} matches to update. Updating now...`);
  
  let updatedCount = 0;
  for (const update of updates) {
    await prisma.baseItem.update({
      where: { itemCode: update.itemCode },
      data: { potSize: update.potSize }
    });
    updatedCount++;
    if (updatedCount % 10 === 0) console.log(`Updated ${updatedCount} / ${updates.length}`);
  }

  console.log(`\nImport complete! Updated ${updatedCount} items.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
