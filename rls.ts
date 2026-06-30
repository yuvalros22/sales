import prisma from './lib/db';

async function main() {
  const result: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
  `);
  
  for (const row of result) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${row.table_name}" ENABLE ROW LEVEL SECURITY;`);
    console.log(`RLS Enabled on table: ${row.table_name}`);
  }
  console.log('RLS Enabled on all public tables');
}

main().catch(console.error);
