import prisma from './lib/db';

async function main() {
  const tables = ['User', 'BaseItem', 'InventoryItem', 'Order', 'OrderItem'];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
  }
  console.log('RLS Enabled on all tables');
}

main().catch(console.error);
