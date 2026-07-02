import * as XLSX from 'xlsx';
import prisma from './lib/db';

async function main() {
  const filePath = 'עציצים מעושכן.xls';
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  
  // Try reading as array of arrays first to check headers, or just use json
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  // Assuming row 0 is headers or data starts at 0, let's just parse
  // We'll iterate from row 1 to skip headers if they exist, but let's check
  
  let count = 0;
  
  // First, delete all existing base items as requested
  console.log('Deleting existing base items...');
  await prisma.baseItem.deleteMany({});
  
  console.log('Importing new base items...');
  const itemsToCreate = [];
  for (let i = 1; i < data.length; i++) { // Skip header row 0
    const row = data[i] as any[];
    if (!row || row.length === 0) continue;
    
    const itemCode = String(row[0] || '').trim();
    const itemName = String(row[1] || '').trim();
    const potSize = String(row[2] || '').trim();
    const category = String(row[3] || '').trim();
    const packageSizeStr = String(row[4] || '').trim();
    let packageSize = parseInt(packageSizeStr, 10);
    
    if (!itemCode || !itemName) {
      continue;
    }
    
    if (isNaN(packageSize) || packageSize <= 0) {
      packageSize = 1; // fallback
    }
    
    itemsToCreate.push({
      itemCode,
      itemName,
      potSize: potSize ? potSize : null,
      category: category ? category : null,
      packageSize
    });
  }
  
  // Use createMany to insert all items at once
  if (itemsToCreate.length > 0) {
    const batchSize = 1000;
    for (let i = 0; i < itemsToCreate.length; i += batchSize) {
      const batch = itemsToCreate.slice(i, i + batchSize);
      await prisma.baseItem.createMany({
        data: batch,
        skipDuplicates: true
      });
      count += batch.length;
    }
  }
  
  console.log(`Successfully imported ${count} base items.`);
}

main().catch(console.error);
